import { createStore, del, entries, get, set } from "idb-keyval";

/** Fondos de pantalla (video o imagen) guardados en IndexedDB de este navegador. */
export interface Background {
  id: string;
  name: string;
  kind: "video" | "image";
  mime: string;
  size: number;
  addedAt: number;
}

interface StoredBackground extends Background {
  blob: Blob;
}

const store = createStore("letrasvida", "backgrounds");

export async function listBackgrounds(): Promise<Background[]> {
  try {
    const all = await entries<string, StoredBackground>(store);
    return all
      .map(([, v]) => {
        const { blob: _blob, ...meta } = v;
        void _blob;
        return meta;
      })
      .sort((a, b) => a.addedAt - b.addedAt);
  } catch {
    return [];
  }
}

export async function addBackground(file: File): Promise<Background> {
  const kind: Background["kind"] = file.type.startsWith("video/") ? "video" : "image";
  const bg: StoredBackground = {
    id: `bg-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: file.name.replace(/\.[^.]+$/, ""),
    kind,
    mime: file.type,
    size: file.size,
    addedAt: Date.now(),
    blob: file,
  };
  await set(bg.id, bg, store);
  const { blob: _blob, ...meta } = bg;
  void _blob;
  return meta;
}

export async function removeBackground(id: string): Promise<void> {
  await del(id, store);
}

export async function getBackgroundBlob(id: string): Promise<Blob | null> {
  try {
    const v = await get<StoredBackground>(id, store);
    return v?.blob ?? null;
  } catch {
    return null;
  }
}

export const fmtSize = (bytes: number) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : bytes >= 1e6 ? `${(bytes / 1e6).toFixed(0)} MB` : `${(bytes / 1e3).toFixed(0)} KB`);

/** Fondos que vienen con la app (public/backgrounds); id con prefijo `builtin:`. */
export interface BuiltinBackground {
  id: string;
  name: string;
  kind: "video";
  url: string;
  /** Cuadro fijo chiquito (32:9) para elegirlo sin decodificar el video. */
  poster: string;
  size: number;
}

const builtin = (file: string, name: string, size: number): BuiltinBackground => ({
  id: `builtin:${file}`,
  name,
  kind: "video",
  url: `${import.meta.env.BASE_URL}backgrounds/${file}.mp4`,
  poster: `${import.meta.env.BASE_URL}backgrounds/posters/${file}.jpg`,
  size,
});

export const BUILTIN_BACKGROUNDS: BuiltinBackground[] = [
  builtin("aurora", "Aurora azul", 3105508),
  builtin("bokeh", "Bokeh", 4264308),
  builtin("estrellas", "Estrellas", 2431301),
  builtin("ondas", "Ondas", 9897121),
  builtin("rayos", "Rayos de luz", 4281321),
  builtin("cielo", "Cielo", 4753411),
  builtin("geometrico", "Geométrico", 11402025),
];

export const builtinUrl = (id: string) => BUILTIN_BACKGROUNDS.find((b) => b.id === id)?.url ?? null;
