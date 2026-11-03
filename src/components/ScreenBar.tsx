import { useEffect, useState } from "react";
import clsx from "clsx";
import { BUILTIN_BACKGROUNDS, listBackgrounds, type Background } from "../lib/backgrounds";
import { IDLE_OPTIONS, type IdleMode } from "../lib/live";
import type { Slide } from "../lib/slides";

type BgChoice = { id: string; kind: "video" | "image" } | null;

interface Props {
  current: Slide | null;
  idle: IdleMode;
  /** Quita el versículo y deja ese modo en pantalla. */
  onIdle: (mode: IdleMode) => void;
  background: BgChoice;
  onBackground: (bg: BgChoice) => void;
  /** Cambia cuando pueden haber subido fondos nuevos (vuelve a leer la lista). */
  refreshKey: string;
}

const ICONS: Record<IdleMode, string> = { background: "▦", logo: "◉", "logo-anim": "✦", "logo-black": "◐", black: "■" };

/**
 * Barra fija del control: qué hay en las teles y, con un clic, solo el
 * fondo, el logo (quieto o animado) o negro, y qué fondo corre detrás.
 */
export function ScreenBar({ current, idle, onIdle, background, onBackground, refreshKey }: Props) {
  const [mine, setMine] = useState<Background[]>([]);
  useEffect(() => {
    listBackgrounds().then(setMine);
  }, [refreshKey]);

  const idleLabel = IDLE_OPTIONS.find((o) => o.mode === idle)?.label ?? "";
  const bgName = background ? (BUILTIN_BACKGROUNDS.find((b) => b.id === background.id)?.name ?? mine.find((b) => b.id === background.id)?.name ?? "fondo propio") : null;

  return (
    <section className="sticky top-0 z-20 -mx-1 mb-4 space-y-2 rounded-2xl border border-line bg-panel/95 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto min-w-0 text-sm">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">En pantalla</span>
          <p className="flex items-center gap-1.5 truncate font-semibold">
            <span className="h-2 w-2 shrink-0 rounded-full bg-good" />
            {current ? (
              <span className="truncate">{current.label || current.text.slice(0, 40)}</span>
            ) : (
              <span>
                {ICONS[idle]} {idleLabel}
              </span>
            )}
            {bgName && idle !== "black" && idle !== "logo-black" && <span className="truncate text-xs font-normal text-muted">· fondo {bgName}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {IDLE_OPTIONS.map((o) => {
            const live = !current && idle === o.mode;
            const next = Boolean(current) && idle === o.mode;
            return (
              <button
                key={o.mode}
                onClick={() => onIdle(o.mode)}
                title={`${o.hint}${next ? " · es lo que sale al limpiar" : ""}`}
                className={clsx(
                  "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                  live ? "border-good bg-green-50 text-good ring-2 ring-good/25" : next ? "border-dashed border-accent/70 text-accent" : "border-line hover:border-accent/60",
                )}
              >
                <span aria-hidden className="text-base leading-none">{ICONS[o.mode]}</span>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <span className="shrink-0 text-xs font-semibold text-muted">Fondo:</span>
        <button
          onClick={() => onBackground(null)}
          className={clsx("h-12 shrink-0 rounded-lg border px-3 text-xs font-semibold", !background ? "border-accent bg-blue-50 text-accent ring-2 ring-accent/25" : "border-line hover:border-accent/60")}
        >
          Sin fondo
        </button>
        {[...BUILTIN_BACKGROUNDS.map((b) => ({ id: b.id, kind: b.kind as "video" | "image", name: b.name, poster: b.poster as string | undefined })), ...mine.map((b) => ({ id: b.id, kind: b.kind, name: b.name, poster: undefined }))].map((b) => {
          const on = background?.id === b.id;
          return (
            <button
              key={b.id}
              onClick={() => onBackground({ id: b.id, kind: b.kind })}
              title={b.name}
              className={clsx("relative h-12 w-36 shrink-0 overflow-hidden rounded-lg border bg-slate-800", on ? "border-accent ring-2 ring-accent/40" : "border-line hover:border-accent/60")}
            >
              {b.poster && <img src={b.poster} alt="" onError={(e) => (e.currentTarget.style.display = "none")} className="absolute inset-0 h-full w-full object-cover" />}
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-0.5 text-left text-[11px] font-semibold text-white">
                {on ? "● " : ""}
                {b.name}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
