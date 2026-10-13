import { useEffect, useState } from "react";
import clsx from "clsx";
import { VERSIONS, type VersionAbbr } from "../lib/bible";
import { offlineSupported, removeBiblesOffline, saveBiblesOffline, saveBuiltinBackgroundsOffline, savedVersions, storageUsage } from "../lib/offline";
import { BUILTIN_BACKGROUNDS } from "../lib/backgrounds";

export function OfflinePanel() {
  const [saved, setSaved] = useState<Set<VersionAbbr>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<number | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  const refresh = async () => {
    setSaved(await savedVersions());
    setUsage(await storageUsage());
  };

  useEffect(() => {
    refresh();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offlineSupported()) {
    return <p className="text-xs text-muted">Este navegador no permite guardar la app sin conexión (prueba Chrome o Edge).</p>;
  }

  const all = VERSIONS.every((v) => saved.has(v.abbr));

  const save = async () => {
    setBusy("Descargando 1/3…");
    setError(null);
    try {
      await saveBiblesOffline((d, t) => setBusy(`Biblias ${d}/${t}…`));
      await saveBuiltinBackgroundsOffline(BUILTIN_BACKGROUNDS.map((b) => b.url), (d, t) => setBusy(`Fondos ${d}/${t}…`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const remove = async () => {
    await removeBiblesOffline();
    refresh();
  };

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">
        La app se guarda sola en este dispositivo al abrirla. Guarda también las biblias y podrás abrir <b>esta misma dirección</b> sin internet.
      </p>
      <ul className="flex flex-wrap gap-2">
        {VERSIONS.map((v) => (
          <li key={v.abbr} className={clsx("rounded-full border px-2.5 py-0.5 text-xs font-semibold", saved.has(v.abbr) ? "border-good/40 bg-green-50 text-good" : "border-line text-muted")}>
            {saved.has(v.abbr) ? "✓ " : ""}{v.short}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={save}
          disabled={Boolean(busy) || !online}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {busy ?? (all ? "Actualizar lo guardado" : "Guardar biblias y fondos para usar sin internet")}
        </button>
        {all && !busy && (
          <button onClick={remove} className="text-xs text-muted underline underline-offset-2 hover:text-bad">Borrar</button>
        )}
      </div>
      <p className="text-xs text-muted">
        {online ? "Con conexión" : "Sin conexión — usando lo guardado"}
        {usage != null && ` · ${(usage / 1e6).toFixed(0)} MB guardados en este dispositivo`}
        {!all && " · las tres versiones y los fondos incluidos ocupan ~22 MB"}
      </p>
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}
