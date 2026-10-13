import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { VERSIONS, type VersionAbbr } from "./lib/bible";
import { loadOptions, loadText, saveOptions, saveText, type Options, type Size } from "./lib/options";
import { ensureFont, loadDesign, saveDesign, type Design } from "./lib/design";
import { downloadBlob, zipFiles } from "./lib/download";
import { loadLogo, renderPng } from "./lib/render";
import { parseMessage } from "./lib/references";
import { buildSlides, slideFileName, type Slide } from "./lib/slides";
import { renderVideo, videoSupported, type VideoMode } from "./lib/video";
import { DesignPanel } from "./components/DesignPanel";
import { SlideCanvas, type SlideCanvasHandle } from "./components/SlideCanvas";
import { OfflinePanel } from "./components/OfflinePanel";
import { useLive } from "./hooks/useLive";
import { CONTROL_PATH } from "./lib/live";

const PNG_SIZES = [
  { label: "Dos 4K unidas · 7680×2160", w: 7680, h: 2160 },
  { label: "3840×1080", w: 3840, h: 1080 },
  { label: "1920×540", w: 1920, h: 540 },
  { label: "16:9 · 1920×1080", w: 1920, h: 1080 },
  { label: "Personalizado…", w: 0, h: 0 },
];
const VIDEO_SIZES = [
  { label: "3840×1080 (recomendado)", w: 3840, h: 1080 },
  { label: "1920×540", w: 1920, h: 540 },
  { label: "7680×2160 (si el navegador puede)", w: 7680, h: 2160 },
  { label: "Personalizado…", w: 0, h: 0 },
];
const CUSTOM_PNG = PNG_SIZES.length - 1;
const CUSTOM_VIDEO = VIDEO_SIZES.length - 1;

function SizeInputs({ value, onChange, even }: { value: Size; onChange: (s: Size) => void; even?: boolean }) {
  const clean = (n: number) => {
    const v = Math.max(64, Math.min(16384, Math.round(n) || 0));
    return even ? v - (v % 2) : v;
  };
  return (
    <div className="mt-1 flex items-center gap-2">
      <input type="number" min={64} max={16384} value={value.w} onChange={(e) => onChange({ ...value, w: parseInt(e.target.value, 10) || 0 })} onBlur={() => onChange({ w: clean(value.w), h: clean(value.h) })} className="w-full rounded border border-line bg-panel px-2 py-1.5 tabular-nums" aria-label="Ancho" />
      <span className="text-muted">×</span>
      <input type="number" min={64} max={16384} value={value.h} onChange={(e) => onChange({ ...value, h: parseInt(e.target.value, 10) || 0 })} onBlur={() => onChange({ w: clean(value.w), h: clean(value.h) })} className="w-full rounded border border-line bg-panel px-2 py-1.5 tabular-nums" aria-label="Alto" />
      <span className="shrink-0 text-xs text-muted">px</span>
    </div>
  );
}

const EXAMPLE = "Mateo 5:5\nSalmos 23:1-3\nLas bienaventuranzas\n1 Corintios 13:4-7";

export default function App() {
  const [text, setText] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    const shared = [q.get("title"), q.get("text"), q.get("url")].filter(Boolean).join("\n");
    return shared || loadText();
  });
  useEffect(() => saveText(text), [text]);
  const [opts, setOpts] = useState<Options>(loadOptions);
  const [design, setDesign] = useState<Design>(loadDesign);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ step: string; fraction: number } | null>(null);
  const [showDesign, setShowDesign] = useState(false);
  const [showOffline, setShowOffline] = useState(false);
  const live = useLive(design);
  const previewRef = useRef<SlideCanvasHandle>(null);

  const items = useMemo(() => parseMessage(text), [text]);
  const references = items.filter((i) => i.kind === "reference").length;

  useEffect(() => saveDesign(design), [design]);
  useEffect(() => saveOptions(opts), [opts]);

  useEffect(() => {
    setFontsReady(false);
    ensureFont(design.fontFamily).then(() => setFontsReady(true));
  }, [design.fontFamily]);

  useEffect(() => {
    loadLogo(design.logo).then(setLogo);
  }, [design.logo]);

  // Reconstruye los slides cuando cambia el mensaje o las opciones que afectan al texto.
  useEffect(() => {
    let cancelled = false;
    if (items.length === 0) {
      setSlides([]);
      return;
    }
    setBuilding(true);
    setBuildError(null);
    buildSlides(items, { versions: opts.versions, maxChars: opts.maxChars, verseNumbers: opts.verseNumbers })
      .then((s) => {
        if (!cancelled) setSlides(s);
      })
      .catch((e) => !cancelled && setBuildError(String(e)))
      .finally(() => !cancelled && setBuilding(false));
    return () => {
      cancelled = true;
    };
  }, [items, opts.versions, opts.maxChars, opts.verseNumbers]);

  const selectedSlide = slides.find((s) => s.id === selected) ?? slides[0] ?? null;
  const png: Size = opts.pngSize === CUSTOM_PNG ? opts.pngCustom : PNG_SIZES[opts.pngSize];
  const vid: Size = opts.videoSize === CUSTOM_VIDEO ? opts.videoCustom : VIDEO_SIZES[opts.videoSize];
  const aspect = png.w > 0 && png.h > 0 ? png.w / png.h : 2000 / 563;
  const canVideo = videoSupported();

  const toggleVersion = (abbr: VersionAbbr) => {
    const has = opts.versions.includes(abbr);
    const next = has ? opts.versions.filter((v) => v !== abbr) : [...opts.versions, abbr];
    if (next.length) setOpts({ ...opts, versions: next });
  };

  const updateSlide = (id: string, patch: Partial<Slide>) => setSlides((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeSlide = (id: string) => setSlides((ss) => ss.filter((s) => s.id !== id));

  const sizesOk = png.w >= 64 && png.h >= 64 && (opts.video === "none" || (vid.w >= 64 && vid.h >= 64));
  const videoMode: VideoMode = opts.video === "none" ? "in-hold" : opts.video;

  /** Descarga un solo slide al instante, sin pasar por el ZIP. */
  const downloadOne = useCallback(
    async (slide: Slide, kind: "png" | "mp4") => {
      if (slide.error || progress) return;
      const index = slides.findIndex((x) => x.id === slide.id);
      const name = slideFileName(Math.max(0, index), slide, VERSIONS.find((v) => v.abbr === slide.version)?.short);
      try {
        if (kind === "png") {
          setProgress({ step: `PNG: ${slide.label || slide.text.slice(0, 30)}`, fraction: 0.5 });
          await new Promise((r) => setTimeout(r, 0));
          downloadBlob(await renderPng(slide, design, logo, png.w, png.h), `${name}.png`);
        } else {
          const blob = await renderVideo(slide, design, logo, { width: vid.w, height: vid.h, fps: opts.fps, mode: videoMode, hold: opts.hold }, (f) =>
            setProgress({ step: `MP4: ${slide.label || slide.text.slice(0, 30)}`, fraction: f }),
          );
          downloadBlob(blob, `${name}.mp4`);
        }
      } catch (e) {
        setBuildError(e instanceof Error ? e.message : String(e));
      } finally {
        setProgress(null);
      }
    },
    [slides, design, logo, png, vid, opts.fps, opts.hold, videoMode, progress],
  );

  const generate = useCallback(async () => {
    const usable = slides.filter((s) => !s.error && (s.text || s.label));
    if (!usable.length || !sizesOk) return;
    const files: Record<string, Blob | string> = {};
    const steps = usable.length * (opts.video === "none" ? 1 : 2);
    let done = 0;
    try {
      const shortOf = (s: Slide) => VERSIONS.find((v) => v.abbr === s.version)?.short;
      const txt: string[] = [];
      for (let i = 0; i < usable.length; i++) {
        const s = usable[i];
        const name = slideFileName(i, s, shortOf(s));
        setProgress({ step: `PNG ${i + 1}/${usable.length}: ${s.label || s.text.slice(0, 30)}`, fraction: done / steps });
        await new Promise((r) => setTimeout(r, 0));
        files[`png/${name}.png`] = await renderPng(s, design, logo, png.w, png.h);
        done++;
        txt.push([s.label, s.text].filter(Boolean).join("\n"));
        if (opts.video !== "none") {
          setProgress({ step: `Video ${i + 1}/${usable.length}: ${s.label || s.text.slice(0, 30)}`, fraction: done / steps });
          files[`mp4/${name}.mp4`] = await renderVideo(s, design, logo, { width: vid.w, height: vid.h, fps: opts.fps, mode: opts.video, hold: opts.hold }, (f) =>
            setProgress({ step: `Video ${i + 1}/${usable.length}: ${s.label || s.text.slice(0, 30)}`, fraction: (done + f) / steps }),
          );
          done++;
        }
      }
      files["propresenter.txt"] = txt.join("\n\n") + "\n";
      setProgress({ step: "Empaquetando ZIP", fraction: 1 });
      const blob = await zipFiles(files);
      downloadBlob(blob, `versiculos-${new Date().toISOString().slice(0, 10)}.zip`);
      setProgress(null);
    } catch (e) {
      setProgress(null);
      setBuildError(e instanceof Error ? e.message : String(e));
    }
  }, [slides, opts, design, logo, png, vid, sizesOk]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Versículos</h1>
          <p className="text-sm text-muted">Pega las citas del pastor y descarga los slides listos para ProPresenter.</p>
        </div>
        <div className="flex gap-1.5">
          {VERSIONS.map((v) => (
            <button
              key={v.abbr}
              onClick={() => toggleVersion(v.abbr)}
              title={v.name}
              className={clsx(
                "rounded-full border px-3 py-1 text-sm font-semibold transition-colors",
                opts.versions.includes(v.abbr) ? "border-accent bg-accent text-white" : "border-line bg-panel text-muted hover:border-accent/50",
              )}
            >
              {v.short}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[380px_1fr] lg:gap-5">
        {/* ── Columna izquierda: entrada, opciones, diseño ── */}
        <div className="contents lg:block lg:space-y-4">
          <section className="order-1 rounded-2xl border border-line bg-panel p-4 lg:order-none">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-accent">Citas</h2>
              {!text && (
                <button onClick={() => setText(EXAMPLE)} className="text-xs text-muted underline underline-offset-2 hover:text-ink">
                  Probar con un ejemplo
                </button>
              )}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Pega aquí el mensaje tal cual llega:\nJuan 3:16\nSalmos 23:1-3\nMateo 5:3-12"}
              rows={5}
              className="w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
            <p className="mt-1 text-xs text-muted">
              {references} cita{references === 1 ? "" : "s"} detectada{references === 1 ? "" : "s"}
              {items.length - references > 0 && ` · ${items.length - references} título${items.length - references === 1 ? "" : "s"}`}
              {building && " · cargando…"}
            </p>
          </section>

          <section className="order-5 space-y-3 rounded-2xl border border-line bg-panel p-4 text-sm lg:order-none">
            <h2 className="text-sm font-bold uppercase tracking-wide text-accent">Salida</h2>
            <p className="text-xs text-muted">Los slides se generan en tu dispositivo; en el celular, el video tarda más.</p>
            <label className="block">
              <span className="text-muted">Tamaño del PNG</span>
              <select value={opts.pngSize} onChange={(e) => setOpts({ ...opts, pngSize: parseInt(e.target.value, 10) })} className="mt-1 w-full rounded border border-line bg-panel px-2 py-1.5">
                {PNG_SIZES.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
              </select>
              {opts.pngSize === CUSTOM_PNG && <SizeInputs value={opts.pngCustom} onChange={(pngCustom) => setOpts({ ...opts, pngCustom })} />}
            </label>
            <label className="block">
              <span className="text-muted">Video animado</span>
              <select
                value={opts.video}
                disabled={!canVideo}
                onChange={(e) => setOpts({ ...opts, video: e.target.value as Options["video"] })}
                className="mt-1 w-full rounded border border-line bg-panel px-2 py-1.5 disabled:opacity-50"
              >
                <option value="none">Sin video (solo PNG)</option>
                <option value="in-hold">Entrada y se queda (hold last frame)</option>
                <option value="in-hold-out">Entrada, espera y salida</option>
              </select>
              {!canVideo && <span className="text-xs text-warn">Este navegador no puede generar video; usa Chrome o Edge.</span>}
            </label>
            {opts.video !== "none" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block col-span-2">
                  <span className="text-muted">Tamaño del video</span>
                  <select value={opts.videoSize} onChange={(e) => setOpts({ ...opts, videoSize: parseInt(e.target.value, 10) })} className="mt-1 w-full rounded border border-line bg-panel px-2 py-1.5">
                    {VIDEO_SIZES.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
                  </select>
                  {opts.videoSize === CUSTOM_VIDEO && <SizeInputs value={opts.videoCustom} onChange={(videoCustom) => setOpts({ ...opts, videoCustom })} even />}
                </label>
                <label className="block">
                  <span className="text-muted">Espera (s)</span>
                  <input type="number" min={0.5} max={60} step={0.5} value={opts.hold} onChange={(e) => setOpts({ ...opts, hold: Math.max(0.5, parseFloat(e.target.value) || 3) })} className="mt-1 w-full rounded border border-line bg-panel px-2 py-1.5" />
                </label>
                <label className="block">
                  <span className="text-muted">FPS</span>
                  <select value={opts.fps} onChange={(e) => setOpts({ ...opts, fps: parseInt(e.target.value, 10) as 30 | 60 })} className="mt-1 w-full rounded border border-line bg-panel px-2 py-1.5">
                    <option value={60}>60</option>
                    <option value={30}>30</option>
                  </select>
                </label>
              </div>
            )}
            <label className="flex items-center justify-between">
              <span className="text-muted">Número de versículo en el texto</span>
              <input type="checkbox" checked={opts.verseNumbers} onChange={(e) => setOpts({ ...opts, verseNumbers: e.target.checked })} className="accent-accent" />
            </label>
            <label className="block">
              <span className="flex justify-between text-muted"><span>Máximo de letras por slide</span><span className="tabular-nums">{opts.maxChars}</span></span>
              <input type="range" min={100} max={400} step={10} value={opts.maxChars} onChange={(e) => setOpts({ ...opts, maxChars: parseInt(e.target.value, 10) })} className="mt-1 w-full accent-accent" />
            </label>
          </section>

          <section className="order-6 rounded-2xl border border-line bg-panel p-4 lg:order-none">
            <button onClick={() => setShowDesign((v) => !v)} className="flex w-full items-center justify-between text-sm font-bold uppercase tracking-wide text-accent">
              <span>Diseño</span>
              <span className="text-muted">{showDesign ? "▲" : "▼"}</span>
            </button>
            {showDesign && (
              <div className="mt-3">
                <DesignPanel design={design} onChange={setDesign} />
              </div>
            )}
          </section>

          <section className="order-7 rounded-2xl border border-line bg-panel p-4 lg:order-none">
            <button onClick={() => setShowOffline((v) => !v)} className="flex w-full items-center justify-between text-sm font-bold uppercase tracking-wide text-accent">
              <span>Sin internet</span>
              <span className="text-muted">{showOffline ? "▲" : "▼"}</span>
            </button>
            {showOffline && (
              <div className="mt-3">
                <OfflinePanel />
              </div>
            )}
          </section>
        </div>

        {/* ── Columna derecha: en vivo, vista previa y lista ── */}
        <div className="contents lg:block lg:space-y-4">
          <section className="order-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-accent-2/40 bg-panel px-4 py-3 lg:order-none">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-accent">
                En vivo {live.connected && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-good align-middle" title="Pantalla de salida conectada" />}
              </h2>
              <p className="text-xs text-muted">Control aparte para invitados: cita rápida, pantallas unidas y fondos.</p>
            </div>
            <button
              onClick={() => window.open(CONTROL_PATH, "letrasvida-control")}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white shadow-sm hover:brightness-110"
            >
              Abrir control en vivo ↗
            </button>
          </section>
          {selectedSlide ? (
            <section className="order-3 rounded-2xl border border-line bg-panel p-4 lg:order-none">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-accent">Vista previa</h2>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => previewRef.current?.play(Math.min(opts.hold, 2), false)} className="rounded-lg border border-line px-3 py-1 text-sm hover:border-accent/60">▶ Entrada</button>
                  <button onClick={() => previewRef.current?.play(Math.min(opts.hold, 2), true)} className="rounded-lg border border-line px-3 py-1 text-sm hover:border-accent/60">▶ Entrada y salida</button>
                  <button
                    onClick={() => downloadOne(selectedSlide, "png")}
                    disabled={Boolean(progress) || Boolean(selectedSlide.error) || !fontsReady || !sizesOk}
                    title={`Descargar solo este slide en PNG (${png.w}×${png.h})`}
                    className="rounded-lg bg-accent px-3 py-1 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
                  >
                    ⬇ PNG
                  </button>
                  <button
                    onClick={() => downloadOne(selectedSlide, "mp4")}
                    disabled={Boolean(progress) || Boolean(selectedSlide.error) || !fontsReady || !sizesOk || !canVideo}
                    title={`Descargar solo este slide en MP4 (${vid.w}×${vid.h})`}
                    className="rounded-lg bg-accent-2 px-3 py-1 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
                  >
                    ⬇ MP4
                  </button>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-line" style={{ background: "repeating-conic-gradient(#e9edf3 0 25%, #f7f9fc 0 50%) 0 0 / 20px 20px" }}>
                <SlideCanvas ref={previewRef} slide={selectedSlide} design={design} logo={logo} width={2000} aspect={aspect} className="block w-full" fontsReady={fontsReady} />
              </div>
              <p className="mt-2 text-xs text-muted">Así se verá el PNG a {png.w}×{png.h}. La animación es la misma que la del video.</p>
            </section>
          ) : (
            <section className="order-3 rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted lg:order-none">
              Pega una cita a la izquierda y aparecerá aquí la vista previa.
            </section>
          )}

          {buildError && <p className="order-4 rounded-lg border border-bad/30 bg-red-50 px-3 py-2 text-sm text-bad lg:order-none">{buildError}</p>}

          {slides.length > 0 && (
            <section className="order-4 rounded-2xl border border-line bg-panel p-4 lg:order-none">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-accent">{slides.length} slide{slides.length === 1 ? "" : "s"}</h2>
                {progress ? (
                  <div className="flex min-w-[260px] flex-1 items-center gap-3 sm:max-w-md">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                      <div className="h-full bg-accent transition-all" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
                    </div>
                    <span className="truncate text-xs text-muted">{progress.step}</span>
                  </div>
                ) : (
                  <button
                    onClick={generate}
                    disabled={building || !fontsReady || !sizesOk}
                    className="rounded-xl bg-accent px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
                  >
                    Descargar ZIP {opts.video === "none" ? "(PNG)" : "(PNG + MP4)"}
                  </button>
                )}
              </div>
              <ul className="space-y-2">
                {slides.map((s, i) => (
                  <li
                    key={s.id}
                    onClick={() => setSelected(s.id)}
                    className={clsx(
                      "grid cursor-pointer gap-3 rounded-xl border p-2 transition-colors sm:grid-cols-[220px_1fr]",
                      selectedSlide?.id === s.id ? "border-accent bg-blue-50/40" : "border-line hover:border-accent/40",
                    )}
                  >
                    <div className="overflow-hidden rounded-md border border-line bg-white">
                      <SlideCanvas slide={s} design={design} logo={logo} width={880} aspect={aspect} className="block w-full" fontsReady={fontsReady} />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted">{String(i + 1).padStart(2, "0")}</span>
                        <input
                          value={s.label}
                          placeholder="Sin píldora (título)"
                          onChange={(e) => updateSlide(s.id, { label: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-sm font-semibold hover:border-line focus:border-accent focus:outline-none"
                        />
                        <label className="flex items-center gap-1 text-[11px] text-muted" title="Tamaño del texto (vacío = automático)" onClick={(e) => e.stopPropagation()}>
                          <span>Aa</span>
                          <input
                            type="number"
                            min={10}
                            max={160}
                            placeholder="auto"
                            value={s.fontSize ?? ""}
                            onChange={(e) => updateSlide(s.id, { fontSize: e.target.value === "" ? undefined : Math.max(10, Math.min(160, parseInt(e.target.value, 10) || 0)) || undefined })}
                            className="w-14 rounded border border-line bg-panel px-1 py-0.5 text-xs tabular-nums focus:border-accent focus:outline-none"
                          />
                        </label>
                        {s.version && <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold text-muted">{VERSIONS.find((v) => v.abbr === s.version)?.short}</span>}
                        {!s.error && (
                          <span className="flex gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); live.show(s); }}
                              title="Mostrar en la pantalla de salida"
                              className={clsx("rounded border px-1.5 py-0.5 text-[11px] font-semibold", live.current?.id === s.id ? "border-good bg-green-50 text-good" : "border-line text-accent hover:bg-blue-50")}
                            >
                              {live.current?.id === s.id ? "● En vivo" : "En vivo"}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); downloadOne(s, "png"); }} disabled={Boolean(progress)} title="Descargar PNG" className="rounded border border-line px-1.5 py-0.5 text-[11px] font-semibold text-accent hover:bg-blue-50 disabled:opacity-40">PNG</button>
                            {canVideo && <button onClick={(e) => { e.stopPropagation(); downloadOne(s, "mp4"); }} disabled={Boolean(progress)} title="Descargar MP4" className="rounded border border-line px-1.5 py-0.5 text-[11px] font-semibold text-accent hover:bg-blue-50 disabled:opacity-40">MP4</button>}
                          </span>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); removeSlide(s.id); }} className="text-xs text-muted hover:text-bad">Quitar</button>
                      </div>
                      {s.error ? (
                        <p className="text-xs text-bad">{s.error}</p>
                      ) : (
                        <textarea
                          value={s.text}
                          rows={2}
                          onChange={(e) => updateSlide(s.id, { text: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full resize-y rounded border border-transparent bg-transparent px-1 text-sm hover:border-line focus:border-accent focus:outline-none"
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">
                El ZIP trae una carpeta <code>png</code>{opts.video !== "none" && <>, una <code>mp4</code></>} y <code>propresenter.txt</code> (un párrafo por slide, por si prefieres importar texto y usar tu tema).
                Puedes editar el texto y la cita de cada slide antes de descargar.
              </p>
            </section>
          )}
        </div>
      </div>

      {slides.length > 0 && !progress && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel/95 p-3 backdrop-blur lg:hidden">
          <button
            onClick={generate}
            disabled={building || !fontsReady || !sizesOk}
            className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
          >
            Descargar ZIP {opts.video === "none" ? "(PNG)" : "(PNG + MP4)"}
          </button>
        </div>
      )}
      {progress && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel/95 p-3 backdrop-blur lg:hidden">
          <div className="mb-1 flex justify-between text-xs text-muted"><span className="truncate">{progress.step}</span><span>{Math.round(progress.fraction * 100)}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-bg"><div className="h-full bg-accent transition-all" style={{ width: `${Math.round(progress.fraction * 100)}%` }} /></div>
        </div>
      )}
      <div className="h-20 lg:hidden" />
    </main>
  );
}
