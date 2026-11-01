import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { ChapterInfo } from "../lib/bible";
import { ASPECT_OPTIONS, aspectLabel, DEFAULT_CAL, FIT_OPTIONS, IDLE_OPTIONS, SPLIT_OPTIONS, splitLabel, type Calibration, type IdleMode, type LiveLayout, type OutputInfo, type Split } from "../lib/live";
import { BOOK_BY_ID } from "../lib/books";
import { commonAspect, resolvePlan, windowManagementState, type PlannedOutput, type ScreenPlan } from "../lib/screens";
import type { Slide } from "../lib/slides";
import { useScreens } from "../hooks/useScreens";
import { ScreenSetup } from "./ScreenSetup";

interface Props {
  connected: boolean;
  current: Slide | null;
  /** Convierte lo tecleado ("Juan 3:16-18") en slides listos. */
  resolve: (text: string) => Promise<Slide[]>;
  chapterInfo: (bookId: string, chapter: number) => Promise<ChapterInfo | null>;
  onShow: (slide: Slide) => void;
  onClear: () => void;
  onOpenOutput: (screens?: number) => void;
  onLaunch: (plan: PlannedOutput[]) => number;
  onCloseOutputs: () => void;
  onIdentify: (id?: string) => void;
  onSwap: () => void;
  onAssign: (id: string, split: Split) => void;
  onRename: (id: string, name: string) => void;
  outputs: Record<string, OutputInfo>;
  idle: IdleMode;
  onIdle: (mode: IdleMode) => void;
  layout: LiveLayout;
  onLayout: (layout: LiveLayout) => void;
  onCalibrate: (id: string, cal: Calibration) => void;
}

export function LivePanel({ connected, current, resolve, chapterInfo, onShow, onClear, onOpenOutput, onLaunch, onCloseOutputs, onIdentify, onSwap, onAssign, onRename, outputs, idle, onIdle, layout, onLayout, onCalibrate }: Props) {
  const [config, setConfig] = useState(false);
  const [tuning, setTuning] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [queue, setQueue] = useState<Slide[]>([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<(ChapterInfo & { bookId: string }) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scr = useScreens();
  const [powerMsg, setPowerMsg] = useState<string | null>(null);
  const on = Object.values(outputs);
  const notFull = on.filter((o) => !o.fullscreen).length;

  /**
   * Enciende las pantallas con la configuración guardada: una ventana por tele,
   * en su monitor, con su tramo. `auto` = al abrir el control, sin clic (solo
   * si Chrome ya tiene los permisos; si no, queda esperando el botón).
   */
  const powerOn = async (auto = false) => {
    setPowerMsg(null);
    const plan = scr.plan;
    if (!plan?.selected.length) {
      setConfig(true);
      setPowerMsg("Primero elige qué pantallas son de salida.");
      return;
    }
    if (auto && (await windowManagementState()) !== "granted") return;
    const list = await scr.current();
    if (!list) {
      setConfig(true);
      setPowerMsg("Chrome no dio permiso para ver los monitores.");
      return;
    }
    const { outputs: planned, missing } = resolvePlan(list, plan);
    if (missing || !planned.length) {
      setConfig(true);
      setPowerMsg(`No encuentro ${missing > 1 ? `${missing} de las pantallas configuradas` : "una de las pantallas configuradas"}. Revisa que las teles estén prendidas y que Windows las tenga en «Extender», o vuelve a elegirlas.`);
      return;
    }
    const aspect = plan.mode === "joined" && planned.length > 1 ? commonAspect(planned.map((p) => p.screen)) : null;
    if (aspect && Math.abs(aspect - layout.aspect) > 0.001) onLayout({ ...layout, aspect });
    const blocked = onLaunch(planned);
    if (blocked) {
      setPowerMsg(
        auto
          ? "Chrome no dejó encender las pantallas solo; pulsa «Encender pantallas»."
          : `Chrome bloqueó ${blocked === planned.length ? "las ventanas" : `${blocked} de ${planned.length} ventanas`}. Haz clic en el ícono de ventanas emergentes bloqueadas (barra de dirección) → «Permitir siempre» y vuelve a encender, o instala los permisos en ⚙ Configurar.`,
      );
    }
  };
  // Un aviso de «Encender» deja de valer en cuanto se toca la configuración.
  useEffect(() => setPowerMsg(null), [scr.plan]);
  const powerRef = useRef(powerOn);
  powerRef.current = powerOn;
  const outputsRef = useRef(outputs);
  outputsRef.current = outputs;

  // «Encender al abrir»: espera a ver si ya hay salidas vivas (control recargado) para no reabrirlas.
  useEffect(() => {
    if (!scr.plan?.autoStart) return;
    const t = window.setTimeout(() => !Object.keys(outputsRef.current).length && powerRef.current(true), 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showAt = (i: number, q = queue) => {
    if (!q[i]) return;
    setIndex(i);
    onShow(q[i]);
  };

  /** Actualiza el capítulo en contexto (botones de versículos) a partir de un slide. */
  const syncCtx = async (s: Slide | undefined) => {
    if (!s?.bookId || !s.chapter) return;
    if (ctx && ctx.bookId === s.bookId && ctx.chapter === s.chapter) return;
    const info = await chapterInfo(s.bookId, s.chapter);
    setCtx(info ? { ...info, bookId: s.bookId } : null);
  };

  const showRef = async (ref: string, replaceQueue = true) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const all = await resolve(ref);
      const slides = all.filter((s) => !s.error);
      const bad = all.find((s) => s.error);
      if (!slides.length) {
        setError(bad?.error ?? "No entendí la cita. Ejemplo: Juan 3:16-18");
        return false;
      }
      if (replaceQueue) setQueue(slides);
      showAt(0, slides);
      syncCtx(slides[0]);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const go = async () => {
    const t = text.trim();
    if (!t) return;
    if (await showRef(t)) inputRef.current?.select();
  };

  /** Un versículo más o menos que el que está en pantalla, aunque se salga de lo tecleado. */
  const stepVerse = async (delta: 1 | -1) => {
    const inQueue = queue.findIndex((q) => q.id === current?.id);
    const next = inQueue >= 0 ? inQueue + delta : -1;
    if (next >= 0 && next < queue.length) return showAt(next);
    const s = current;
    if (!s?.bookId || !s.chapter || !s.verseFrom || !s.verseTo) return;
    const name = BOOK_BY_ID.get(s.bookId)?.name ?? s.bookName ?? "";
    const info = ctx && ctx.bookId === s.bookId && ctx.chapter === s.chapter ? ctx : await chapterInfo(s.bookId, s.chapter);
    if (!info) return;
    if (delta === 1) {
      if (s.verseTo < info.verses) return showRef(`${name} ${s.chapter}:${s.verseTo + 1}`);
      if (s.chapter < info.chapters) return showRef(`${name} ${s.chapter + 1}:1`);
    } else {
      if (s.verseFrom > 1) return showRef(`${name} ${s.chapter}:${s.verseFrom - 1}`);
      if (s.chapter > 1) {
        const prev = await chapterInfo(s.bookId, s.chapter - 1);
        if (prev) return showRef(`${name} ${s.chapter - 1}:${prev.verses}`);
      }
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      go();
    } else if (e.key === "ArrowRight" && current) {
      e.preventDefault();
      stepVerse(1);
    } else if (e.key === "ArrowLeft" && current) {
      e.preventDefault();
      stepVerse(-1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClear();
    }
  };

  const onScreen = (n: number) => Boolean(current && current.bookId === ctx?.bookId && current.chapter === ctx?.chapter && current.verseFrom != null && current.verseTo != null && n >= current.verseFrom && n <= current.verseTo);

  useEffect(() => {
    // Si el slide en pantalla vino de otro lado (lista principal), no marcamos la cola pero sí el capítulo.
    if (current && !queue.some((q) => q.id === current.id)) setIndex(-1);
    syncCtx(current ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, queue]);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {on.length ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-good/40 bg-green-50 px-2.5 py-1 font-semibold text-good">
                <span className="h-2 w-2 rounded-full bg-good" />
                Pantallas encendidas
              </span>
              <button onClick={() => powerOn()} className="rounded-lg border border-line px-2.5 py-1 font-semibold hover:border-accent/60" title="Vuelve a abrirlas con la configuración guardada (p. ej. después de cambiarla)">
                Reabrir
              </button>
              <button onClick={onCloseOutputs} className="rounded-lg border border-line px-2.5 py-1 font-semibold hover:border-bad/50 hover:text-bad">
                Apagar
              </button>
            </>
          ) : (
            <button onClick={() => powerOn()} className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-bold text-white hover:brightness-110">
              ▶ Encender pantallas
            </button>
          )}
          <span className="text-muted">{planSummary(scr.plan)}</span>
          <button onClick={() => setConfig((v) => !v)} className={clsx("ml-auto rounded-lg border px-2.5 py-1 font-semibold", config ? "border-accent bg-blue-50 text-accent" : "border-line hover:border-accent/60")}>
            ⚙ Configurar pantallas
          </button>
        </div>
        {on.length > 0 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
            {on
              .sort((a, b) => a.part - b.part || a.id.localeCompare(b.id))
              .map((o) => (
                <li key={o.id} className="flex items-center gap-1.5 text-muted">
                  <span className={clsx("h-2 w-2 shrink-0 rounded-full", o.fullscreen ? "bg-good" : "bg-warn")} />
                  <b className="text-ink">{o.name || splitLabel(o)}</b>
                  {o.monitor && <span>· {o.monitor}</span>}
                  <span>· {o.fullscreen ? "pantalla completa" : "falta un clic en esa tele"}</span>
                </li>
              ))}
          </ul>
        )}
        {notFull > 0 && !scr.autoFs && (
          <p className="text-[11px] text-warn">Para no tener que hacer clic en cada tele, instala los permisos de Chrome en ⚙ Configurar pantallas.</p>
        )}
        {powerMsg && <p className="text-xs text-bad">{powerMsg}</p>}
      </div>

      {config && (
        <div className="space-y-3 rounded-xl border border-line bg-bg/60 p-3 text-sm">
          <ScreenSetup scr={scr} onIdentify={() => onIdentify()} />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted">Cuando no hay versículo:</span>
            {IDLE_OPTIONS.map((o) => (
              <button
                key={o.mode}
                onClick={() => onIdle(o.mode)}
                title={o.hint}
                className={clsx("rounded-lg border px-2.5 py-1 text-xs font-semibold", idle === o.mode ? "border-accent bg-accent text-white" : "border-line bg-panel hover:border-accent/60")}
              >
                {o.label}
              </button>
            ))}
          </div>
          <details open={on.length > 0} className="space-y-2">
            <summary className="cursor-pointer text-xs font-semibold">Ajuste de la unión entre las teles</summary>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted" title="La misma para todas las pantallas unidas: así el versículo mide igual en cada una y cruza la unión sin escalón">Proporción de cada pantalla unida:</span>
            {ASPECT_OPTIONS.map((o) => (
              <button
                key={o.label}
                onClick={() => onLayout({ ...layout, aspect: o.aspect })}
                className={clsx("rounded-lg border px-2.5 py-1 text-xs font-semibold", Math.abs(layout.aspect - o.aspect) < 0.001 ? "border-accent bg-accent text-white" : "border-line bg-panel hover:border-accent/60")}
              >
                {o.label}
              </button>
            ))}
            <button
              onClick={() => onLayout({ ...layout, pattern: !layout.pattern })}
              title="Cuadrícula, círculos y diagonales en todas las salidas para ajustar la unión"
              className={clsx("ml-auto rounded-lg border px-2.5 py-1 text-xs font-semibold", layout.pattern ? "border-warn bg-amber-100 text-warn" : "border-line bg-panel hover:border-accent/60")}
            >
              {layout.pattern ? "Quitar carta de ajuste" : "Mostrar carta de ajuste"}
            </button>
          </div>
          {Object.values(outputs).length > 0 && (
            <ul className="space-y-1.5">
              {Object.values(outputs)
                .sort((a, b) => a.id.localeCompare(b.id))
                .map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel px-2 py-1.5 text-xs">
                    <input
                      value={o.name}
                      placeholder={o.id}
                      onChange={(e) => onRename(o.id, e.target.value)}
                      title={`Nombre de la pantalla (${o.id})`}
                      className="w-40 rounded border border-transparent bg-transparent px-1 py-0.5 font-semibold hover:border-line focus:border-accent focus:outline-none"
                    />
                    {o.monitor && <span className="font-semibold text-accent" title="Monitor donde se lanzó; su ajuste se guarda con él">{o.monitor}</span>}
                    <span className="text-muted" title="Píxeles reales que recibe esa pantalla">{o.width}×{o.height} · {aspectLabel(o.width, o.height)}</span>
                    <select
                      value={`${o.part}/${o.of}`}
                      onChange={(e) => {
                        const [part, of] = e.target.value.split("/").map(Number);
                        onAssign(o.id, { part, of });
                      }}
                      className="rounded border border-line bg-panel px-1.5 py-0.5"
                    >
                      {SPLIT_OPTIONS.map((opt) => (
                        <option key={opt.label} value={`${opt.split.part}/${opt.split.of}`}>{opt.label}</option>
                      ))}
                    </select>
                    <button onClick={() => onIdentify(o.id)} className="rounded border border-line px-2 py-0.5 font-semibold hover:border-accent/60">Identificar</button>
                    <button
                      onClick={() => setTuning((v) => (v === o.id ? null : o.id))}
                      className={clsx("rounded border px-2 py-0.5 font-semibold", tuning === o.id ? "border-accent bg-blue-50 text-accent" : "border-line hover:border-accent/60")}
                    >
                      Ajustar{isTuned(o.cal) ? " •" : ""}
                    </button>
                    {o.of > 1 && Math.abs(o.width / o.height - layout.aspect) / layout.aspect > 0.01 && (
                      <p className="w-full text-[11px] text-warn">
                        Esta pantalla es {aspectLabel(o.width, o.height)} y las unidas van a {ASPECT_OPTIONS.find((a) => Math.abs(a.aspect - layout.aspect) < 0.001)?.label}.
                        Con <b>Encajar</b> queda con bandas negras pero cuadra con la otra; si la tele deforma la imagen, usa <b>Estirar</b> y revisa con la carta que los círculos salgan redondos.
                      </p>
                    )}
                    {tuning === o.id && <CalibrationEditor cal={o.cal ?? DEFAULT_CAL} onChange={(cal) => onCalibrate(o.id, cal)} />}
                  </li>
                ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">Si una tele sale más grande, más chica o desfasada, muestra la <b>carta de ajuste</b> y usa <b>Ajustar</b> en esa salida hasta que los círculos queden redondos y las líneas sigan rectas en la unión. El ajuste se guarda con esa tele.</p>
          </details>
          <details className="text-xs">
            <summary className="cursor-pointer font-semibold">Avanzado: abrir ventanas a mano</summary>
            <div className="mt-2 space-y-2">
              <p className="text-muted">Para navegadores que no detectan pantallas: abre las ventanas, arrastra cada una a su tele y pulsa <b>F</b>. Cada ventana tiene un ⚙ abajo a la izquierda (mueve el ratón) para elegir su mitad; atajos 1 / 2 / U.</p>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => onOpenOutput(1)} className="rounded-lg border border-line bg-panel px-2.5 py-1 font-semibold hover:border-accent/60">1 pantalla</button>
                <button onClick={() => onOpenOutput(2)} className="rounded-lg border border-line bg-panel px-2.5 py-1 font-semibold hover:border-accent/60" title="Dos ventanas: izquierda y derecha, una en cada monitor">2 pantallas unidas</button>
                <button onClick={() => onOpenOutput(3)} className="rounded-lg border border-line bg-panel px-2.5 py-1 font-semibold hover:border-accent/60">3 pantallas unidas</button>
                <button onClick={() => onIdentify()} disabled={!connected} className="rounded-lg border border-line bg-panel px-2.5 py-1 font-semibold hover:border-accent/60 disabled:opacity-40" title="Cada ventana muestra su número y lado en grande">
                  Identificar todas
                </button>
                <button onClick={onSwap} disabled={!connected} className="rounded-lg border border-line bg-panel px-2.5 py-1 font-semibold hover:border-accent/60 disabled:opacity-40" title="Si la izquierda quedó en el monitor derecho">
                  Intercambiar izquierda ↔ derecha
                </button>
              </div>
            </div>
          </details>
        </div>
      )}

      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Cita y Enter: Juan 3:16-18"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border-2 border-accent/40 bg-panel px-4 py-3 text-lg font-semibold focus:border-accent focus:outline-none"
        />
        <button onClick={go} disabled={busy || !text.trim()} className="rounded-xl bg-accent px-5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50">
          Mostrar
        </button>
        <button onClick={onClear} disabled={!current} className="rounded-xl border border-line px-4 text-sm font-semibold hover:border-bad/50 hover:text-bad disabled:opacity-40">
          Limpiar
        </button>
      </div>
      {error && <p className="text-xs text-bad">{error}</p>}

      {queue.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {queue.map((s, i) => (
            <button
              key={s.id}
              onClick={() => showAt(i)}
              title={s.text}
              className={clsx(
                "max-w-[220px] truncate rounded-lg border px-2.5 py-1 text-xs font-semibold",
                i === index ? "border-accent bg-accent text-white" : "border-line hover:border-accent/60",
              )}
            >
              {s.label || s.text.slice(0, 24)}
            </button>
          ))}
        </div>
      )}

      {current?.bookId && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => stepVerse(-1)} disabled={busy} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:border-accent/60 disabled:opacity-40">‹ Versículo anterior</button>
          <button onClick={() => stepVerse(1)} disabled={busy} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40">Versículo siguiente ›</button>
          <span className="text-xs text-muted">← → en el cuadro de texto hacen lo mismo · Esc limpia</span>
        </div>
      )}

      {ctx && (
        <div className="rounded-xl border border-line bg-bg/60 p-2">
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
            <button onClick={() => ctx.chapter > 1 && showRef(`${ctx.bookName} ${ctx.chapter - 1}:1`)} disabled={busy || ctx.chapter <= 1} className="rounded border border-line px-2 py-0.5 font-semibold hover:border-accent/60 disabled:opacity-40">‹ cap. {ctx.chapter - 1}</button>
            <span className="font-bold">{ctx.bookName} {ctx.chapter}</span>
            <span className="text-muted">· {ctx.verses} versículos</span>
            <button onClick={() => ctx.chapter < ctx.chapters && showRef(`${ctx.bookName} ${ctx.chapter + 1}:1`)} disabled={busy || ctx.chapter >= ctx.chapters} className="rounded border border-line px-2 py-0.5 font-semibold hover:border-accent/60 disabled:opacity-40">cap. {ctx.chapter + 1} ›</button>
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: ctx.verses }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => showRef(`${ctx.bookName} ${ctx.chapter}:${n}`)}
                disabled={busy}
                className={clsx(
                  "h-8 min-w-8 rounded-md border px-1.5 text-sm font-semibold tabular-nums transition-colors",
                  onScreen(n) ? "border-accent bg-accent text-white" : "border-line bg-panel hover:border-accent/60",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted">
        En pantalla ahora: {current ? <b>{current.label || current.text.slice(0, 40)}</b> : <span>nada (en blanco)</span>}
      </p>
    </div>
  );
}

/** «2 teles unidas en una imagen», «2 pantallas en espejo»… lo que hará «Encender». */
function planSummary(plan: ScreenPlan | null): string {
  const n = plan?.selected.length ?? 0;
  if (!n) return "Sin configurar";
  if (n === 1) return "1 pantalla";
  return plan!.mode === "joined" ? `${n} teles unidas en una sola imagen` : `${n} pantallas en espejo`;
}

const isTuned =(cal?: Calibration) => Boolean(cal) && (Object.keys(DEFAULT_CAL) as (keyof Calibration)[]).some((k) => cal![k] !== DEFAULT_CAL[k]);

const pct = (v: number) => `${(v * 100).toFixed(1).replace(/\.0$/, "")} %`;
const signedPct = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1).replace(/\.0$/, "")} %`;

const CAL_SLIDERS: { key: "zoom" | "sx" | "sy" | "dx" | "dy"; label: string; min: number; max: number; step: number; format: (v: number) => string }[] = [
  // En dos columnas: tamaño y proporción a la izquierda, posición a la derecha.
  { key: "zoom", label: "Tamaño", min: 0.7, max: 1.3, step: 0.002, format: pct },
  { key: "dx", label: "Mover ↔", min: -0.15, max: 0.15, step: 0.001, format: signedPct },
  { key: "sx", label: "Ancho", min: 0.7, max: 1.3, step: 0.002, format: pct },
  { key: "dy", label: "Mover ↕", min: -0.15, max: 0.15, step: 0.001, format: signedPct },
  { key: "sy", label: "Alto", min: 0.7, max: 1.3, step: 0.002, format: pct },
];

/** Ajuste fino de una salida: cómo encaja su tramo, tamaño, proporción y posición. */
function CalibrationEditor({ cal, onChange }: { cal: Calibration; onChange: (cal: Calibration) => void }) {
  const set = (patch: Partial<Calibration>) => onChange({ ...cal, ...patch });
  const clampTo = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v * 1000) / 1000));
  return (
    <div className="w-full space-y-2 rounded-lg border border-line bg-bg/60 p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {FIT_OPTIONS.map((f) => (
          <button
            key={f.fit}
            onClick={() => set({ fit: f.fit })}
            title={f.hint}
            className={clsx("rounded-lg border px-2.5 py-1 font-semibold", cal.fit === f.fit ? "border-accent bg-accent text-white" : "border-line bg-panel hover:border-accent/60")}
          >
            {f.label}
          </button>
        ))}
        <span className="text-[11px] text-muted">{FIT_OPTIONS.find((f) => f.fit === cal.fit)?.hint}</span>
      </div>
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {CAL_SLIDERS.map((sl) => {
          const neutral = DEFAULT_CAL[sl.key];
          const step = (dir: number) => set({ [sl.key]: clampTo(cal[sl.key] + dir * sl.step, sl.min, sl.max) });
          return (
            <label key={sl.key} className="flex items-center gap-1.5">
              <span className="w-16 shrink-0 text-muted">{sl.label}</span>
              <button type="button" onClick={() => step(-1)} className="h-6 w-6 shrink-0 rounded border border-line font-bold hover:border-accent/60" aria-label={`${sl.label} menos`}>−</button>
              <input
                type="range"
                min={sl.min}
                max={sl.max}
                step={sl.step}
                value={cal[sl.key]}
                onChange={(e) => set({ [sl.key]: Number(e.target.value) })}
                onDoubleClick={() => set({ [sl.key]: neutral })}
                className="min-w-0 flex-1 accent-accent"
              />
              <button type="button" onClick={() => step(1)} className="h-6 w-6 shrink-0 rounded border border-line font-bold hover:border-accent/60" aria-label={`${sl.label} más`}>+</button>
              <span className={clsx("w-14 shrink-0 text-right tabular-nums", cal[sl.key] !== neutral && "font-semibold text-accent")}>{sl.format(cal[sl.key])}</span>
            </label>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted">Doble clic en una barra la regresa a su valor normal.</span>
        <button onClick={() => onChange(DEFAULT_CAL)} className="rounded border border-line px-2 py-0.5 font-semibold hover:border-bad/50 hover:text-bad">Restablecer</button>
      </div>
    </div>
  );
}
