import { VERSIONS, type VersionAbbr } from "./bible";

export const BIBLES_CACHE = "bibles";

export const bibleUrl = (abbr: VersionAbbr) => `${import.meta.env.BASE_URL}bibles/${abbr}.json`;

export function offlineSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "caches" in window;
}

/** Qué versiones ya están guardadas en el dispositivo. */
export async function savedVersions(): Promise<Set<VersionAbbr>> {
  const saved = new Set<VersionAbbr>();
  if (!offlineSupported()) return saved;
  try {
    const cache = await caches.open(BIBLES_CACHE);
    for (const v of VERSIONS) {
      if (await cache.match(bibleUrl(v.abbr))) saved.add(v.abbr);
    }
  } catch {
    /* sin Cache Storage (modo privado) */
  }
  return saved;
}

/** Descarga las tres biblias y las deja en Cache Storage para consultarlas sin conexión. */
export async function saveBiblesOffline(onProgress?: (done: number, total: number) => void): Promise<void> {
  if (!offlineSupported()) throw new Error("Este navegador no permite guardar sin conexión.");
  const cache = await caches.open(BIBLES_CACHE);
  let done = 0;
  for (const v of VERSIONS) {
    const url = bibleUrl(v.abbr);
    const res = await fetch(url, { cache: "reload" });
    if (!res.ok) throw new Error(`No se pudo descargar ${v.abbr} (${res.status})`);
    await cache.put(url, res);
    done++;
    onProgress?.(done, VERSIONS.length);
  }
}

export async function removeBiblesOffline(): Promise<void> {
  if (!offlineSupported()) return;
  await caches.delete(BIBLES_CACHE);
}

/** Bytes usados por el sitio en este dispositivo, si el navegador lo informa. */
export async function storageUsage(): Promise<number | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    return est?.usage ?? null;
  } catch {
    return null;
  }
}

/** Deja los fondos incluidos en caché para reproducirlos sin conexión. */
export async function saveBuiltinBackgroundsOffline(urls: string[], onProgress?: (done: number, total: number) => void): Promise<void> {
  if (!offlineSupported()) throw new Error("Este navegador no permite guardar sin conexión.");
  const cache = await caches.open("backgrounds");
  let done = 0;
  for (const url of urls) {
    const res = await fetch(url, { cache: "reload" });
    if (!res.ok) throw new Error(`No se pudo descargar ${url} (${res.status})`);
    await cache.put(url, res);
    done++;
    onProgress?.(done, urls.length);
  }
}
