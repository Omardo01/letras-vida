import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { chapterInfo, VERSIONS, type VersionAbbr } from "./lib/bible";
import { DESIGN_KEY, loadDesign, PRESETS, type Design } from "./lib/design";
import { loadOptions, loadText, OPTS_KEY, TEXT_KEY } from "./lib/options";
import { parseMessage } from "./lib/references";
import { buildSlides, type Slide } from "./lib/slides";
import { useLive } from "./hooks/useLive";
import { LivePanel } from "./components/LivePanel";
import { BackgroundsPanel } from "./components/BackgroundsPanel";

/**
 * /envivo — ventana de control para el servicio: cita rápida, pantallas
 * unidas, reposo y fondos. Separada de la página de versículos para no
 * mezclar la preparación del domingo con la operación en vivo.
 */
export function LiveControlPage() {
  const [design, setDesign] = useState<Design>(loadDesign);
  const [opts, setOpts] = useState(loadOptions);
  const [text, setText] = useState(loadText);
  const [today, setToday] = useState<Slide[]>([]);
  const [tab, setTab] = useState<"citas" | "fondos">("citas");
  const live = useLive(design);

  // Lo que se cambie en la página principal (diseño, opciones, citas) llega aquí solo.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DESIGN_KEY) setDesign(loadDesign());
      if (e.key === OPTS_KEY) setOpts(loadOptions());
      if (e.key === TEXT_KEY) setText(loadText());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const version: VersionAbbr = opts.versions[0];
  const resolve = useCallback(
    (t: string) => buildSlides(parseMessage(t), { versions: [version], maxChars: opts.maxChars, verseNumbers: opts.verseNumbers }),
    [version, opts.maxChars, opts.verseNumbers],
  );
  const info = useCallback((bookId: string, chapter: number) => chapterInfo(version, bookId, chapter), [version]);

  // Citas de hoy: las pegadas en la página principal, listas con un clic.
  const items = useMemo(() => parseMessage(text), [text]);
  useEffect(() => {
    let cancelled = false;
    if (!items.length) {
      setToday([]);
      return;
    }
    resolve(text).then((s) => !cancelled && setToday(s.filter((x) => !x.error)));
    return () => {
      cancelled = true;
    };
  }, [items, text, resolve]);

  const presetName = PRESETS.find((p) => Object.entries(p.values).every(([k, v]) => design[k as keyof Design] === v))?.name ?? "personalizado";

  return (
    <main className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Control en vivo</h1>
          <p className="text-xs text-muted">
            Versión {VERSIONS.find((v) => v.abbr === version)?.short} · diseño {presetName} ·{" "}
            <a href="/" className="underline underline-offset-2 hover:text-ink">cambiar en Versículos</a>
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-line bg-panel p-1 text-sm">
          {(["citas", "fondos"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={clsx("rounded-lg px-3 py-1 font-semibold", tab === t ? "bg-accent text-white" : "text-muted hover:text-ink")}>
              {t === "citas" ? "Citas" : "Fondos"}
              {t === "fondos" && live.background && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-white/80 align-middle" />}
            </button>
          ))}
        </div>
      </header>

      {tab === "citas" ? (
        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-accent-2/40 bg-panel p-4">
            <LivePanel
              connected={live.connected}
              current={live.current}
              resolve={resolve}
              chapterInfo={info}
              onShow={live.show}
              onClear={live.clear}
              onOpenOutput={live.openOutput}
              onIdentify={live.identify}
              onSwap={live.swap}
              onAssign={live.assign}
              onRename={live.rename}
              outputs={live.outputs}
              idle={live.idle}
              onIdle={live.setIdle}
              layout={live.layout}
              onLayout={live.setLayout}
              onCalibrate={live.calibrate}
            />
          </section>

          <section className="rounded-2xl border border-line bg-panel p-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-accent">Citas de hoy</h2>
            {today.length === 0 ? (
              <p className="text-xs text-muted">Las citas que pegues en la página de Versículos aparecen aquí como botones.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {today.map((s, i) => {
                  const on = live.current?.id === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => live.show(s)}
                        className={clsx("w-full rounded-xl border px-3 py-2 text-left transition-colors", on ? "border-good bg-green-50" : "border-line hover:border-accent/60")}
                      >
                        <span className="block text-xs font-bold text-accent">{String(i + 1).padStart(2, "0")} · {s.label || "Título"}{on ? " · en pantalla" : ""}</span>
                        <span className="line-clamp-2 text-sm">{s.text}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <section className="rounded-2xl border border-line bg-panel p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-accent">Fondos de pantalla</h2>
          <BackgroundsPanel active={live.background} onSelect={live.setBackground} />
        </section>
      )}
    </main>
  );
}
