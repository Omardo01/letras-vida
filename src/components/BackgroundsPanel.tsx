import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { addBackground, BUILTIN_BACKGROUNDS, fmtSize, getBackgroundBlob, listBackgrounds, removeBackground, type Background } from "../lib/backgrounds";

interface Props {
  active: { id: string; kind: "video" | "image" } | null;
  onSelect: (bg: { id: string; kind: "video" | "image" } | null) => void;
}

/** Fondos en movimiento para la pantalla de salida (video o imagen, guardados en este navegador). */
export function BackgroundsPanel({ active, onSelect }: Props) {
  const [items, setItems] = useState<Background[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlsRef = useRef(urls);
  urlsRef.current = urls;

  const refresh = async () => {
    const list = await listBackgrounds();
    setItems(list);
    // Miniaturas: un object URL por fondo (se revocan al desmontar).
    for (const bg of list) {
      if (!urlsRef.current[bg.id]) {
        const blob = await getBackgroundBlob(bg.id);
        if (blob) setUrls((u) => ({ ...u, [bg.id]: URL.createObjectURL(blob) }));
      }
    }
  };

  useEffect(() => {
    refresh();
    return () => Object.values(urlsRef.current).forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("video/") && !f.type.startsWith("image/")) {
        setError(`${f.name}: solo video o imagen.`);
        continue;
      }
      setBusy(`Guardando ${f.name}…`);
      try {
        await addBackground(f);
      } catch (e) {
        setError(`${f.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setBusy(null);
    refresh();
  };

  const remove = async (bg: Background) => {
    await removeBackground(bg.id);
    if (active?.id === bg.id) onSelect(null);
    if (urls[bg.id]) URL.revokeObjectURL(urls[bg.id]);
    setUrls((u) => {
      const { [bg.id]: _gone, ...rest } = u;
      void _gone;
      return rest;
    });
    refresh();
  };

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted">
        Se reproducen en bucle detrás del versículo en la pantalla de salida, partidos entre las pantallas unidas. Se guardan en <b>este navegador</b> (súbelos en la PC de salida). Recomendado: MP4 H.264 de <b>3840×1080</b> (los incluidos usan ese tamaño): se ve nítido en las dos 4K y la gráfica lo decodifica por hardware. Evita 7680 de ancho: casi ninguna tarjeta decodifica H.264 a 8K y se entrecorta.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110">
          {busy ?? "Agregar video o imagen"}
          <input type="file" accept="video/*,image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} disabled={Boolean(busy)} />
        </label>
        <button
          onClick={() => onSelect(null)}
          className={clsx("rounded-lg border px-3 py-1.5 text-sm font-semibold", active ? "border-line hover:border-bad/50 hover:text-bad" : "border-accent bg-blue-50 text-accent")}
        >
          Sin fondo
        </button>
      </div>
      {error && <p className="text-xs text-bad">{error}</p>}

      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Incluidos</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {BUILTIN_BACKGROUNDS.map((bg) => {
          const isActive = active?.id === bg.id;
          return (
            <li key={bg.id} className={clsx("overflow-hidden rounded-xl border", isActive ? "border-accent ring-2 ring-accent/30" : "border-line")}>
              <button onClick={() => onSelect({ id: bg.id, kind: bg.kind })} className="block w-full bg-black" title="Usar este fondo">
                <video src={bg.url} muted loop playsInline autoPlay preload="metadata" className="aspect-video w-full object-cover" />
              </button>
              <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                <span className="min-w-0 truncate font-semibold">{isActive ? "● " : ""}{bg.name}</span>
                <span className="shrink-0 text-muted">{fmtSize(bg.size)}</span>
              </div>
            </li>
          );
        })}
      </ul>

      {items.length > 0 && <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tuyos</p>}
      {items.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((bg) => {
            const isActive = active?.id === bg.id;
            return (
              <li key={bg.id} className={clsx("overflow-hidden rounded-xl border", isActive ? "border-accent ring-2 ring-accent/30" : "border-line")}>
                <button onClick={() => onSelect({ id: bg.id, kind: bg.kind })} className="block w-full bg-black" title="Usar este fondo">
                  {urls[bg.id] ? (
                    bg.kind === "video" ? (
                      <video src={urls[bg.id]} muted loop playsInline autoPlay className="aspect-video w-full object-cover" />
                    ) : (
                      <img src={urls[bg.id]} alt="" className="aspect-video w-full object-cover" />
                    )
                  ) : (
                    <div className="aspect-video w-full" />
                  )}
                </button>
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                  <span className="min-w-0 truncate font-semibold" title={bg.name}>{isActive ? "● " : ""}{bg.name}</span>
                  <span className="shrink-0 text-muted">{fmtSize(bg.size)}</span>
                  <button onClick={() => remove(bg)} className="shrink-0 text-muted hover:text-bad">Eliminar</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {items.length === 0 && <p className="text-xs text-muted">Sube tus propios videos en bucle (partículas, nubes, humo…) y aparecerán aquí junto a los incluidos.</p>}
    </div>
  );
}
