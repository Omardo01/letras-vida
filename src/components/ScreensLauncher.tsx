import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { splitLabel, type LiveLayout, type OutputInfo } from "../lib/live";
import {
  autoFullscreenAllowed,
  commonAspect,
  defaultSelection,
  loadScreenPlan,
  planOutputs,
  saveScreenPlan,
  watchScreens,
  windowManagementState,
  type DetectedScreen,
  type LaunchMode,
  type PlannedOutput,
  type WindowManagementState,
} from "../lib/screens";

interface Props {
  outputs: Record<string, OutputInfo>;
  layout: LiveLayout;
  onLayout: (layout: LiveLayout) => void;
  /** Abre las salidas; devuelve cuántas bloqueó el navegador. */
  onLaunch: (plan: PlannedOutput[]) => number;
  onClose: () => void;
  onIdentify: () => void;
}

/**
 * Detecta los monitores conectados, deja confirmar cuáles son salidas y lanza
 * una ventana por monitor, ya colocada, con su tramo y a pantalla completa.
 */
export function ScreensLauncher({ outputs, layout, onLayout, onLaunch, onClose, onIdentify }: Props) {
  const [perm, setPerm] = useState<WindowManagementState | null>(null);
  const [screens, setScreens] = useState<DetectedScreen[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<LaunchMode>(() => loadScreenPlan()?.mode ?? "joined");
  const [autoFs, setAutoFs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launched, setLaunched] = useState<PlannedOutput[] | null>(null);
  const stop = useRef<(() => void) | null>(null);

  const detect = async () => {
    setError(null);
    try {
      stop.current?.();
      let first = true;
      stop.current = await watchScreens((list) => {
        const initial = first;
        first = false;
        setScreens(list);
        setSelected((prev) => {
          const kept = prev.filter((k) => list.some((s) => s.key === k));
          return initial || !kept.length ? defaultSelection(list, loadScreenPlan()) : kept;
        });
      });
      setPerm("granted");
    } catch {
      setPerm(await windowManagementState());
      setError("Chrome no dio permiso para ver los monitores.");
    }
  };

  useEffect(() => {
    // Con el permiso ya concedido, los monitores aparecen solos (sin preguntar).
    windowManagementState().then((state) => {
      setPerm(state);
      if (state === "granted") detect();
    });
    autoFullscreenAllowed().then(setAutoFs);
    return () => stop.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plan = screens ? planOutputs(screens, selected, mode) : [];
  const order = new Map(plan.map((p, i) => [p.screen.key, i + 1]));
  const coversControl = plan.some((p) => p.screen.isCurrent);
  // Unidas con resoluciones distintas: la de menos píxeles (típico de un adaptador) se ve menos nítida.
  const sharpest = Math.max(0, ...plan.map((p) => p.screen.pixelWidth * p.screen.pixelHeight));
  const lowRes = mode === "joined" && plan.length > 1 ? plan.filter((p) => p.screen.pixelWidth * p.screen.pixelHeight < sharpest * 0.9) : [];
  const best = plan.find((p) => p.screen.pixelWidth * p.screen.pixelHeight === sharpest)?.screen;

  const toggle = (key: string) => setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const launch = () => {
    if (!plan.length) return;
    setError(null);
    saveScreenPlan({ selected, mode });
    const aspect = mode === "joined" && plan.length > 1 ? commonAspect(plan.map((p) => p.screen)) : null;
    if (aspect && Math.abs(aspect - layout.aspect) > 0.001) onLayout({ ...layout, aspect });
    const blocked = onLaunch(plan);
    setLaunched(plan);
    if (blocked) {
      setError(
        `El navegador bloqueó ${blocked === plan.length ? "las ventanas" : `${blocked} de ${plan.length} ventanas`}. ` +
          "En la barra de dirección haz clic en el ícono de ventanas emergentes bloqueadas → «Permitir siempre» y vuelve a lanzar.",
      );
    }
  };

  if (perm === "unsupported") {
    return (
      <p className="rounded-lg border border-warn/40 bg-amber-50 px-3 py-2 text-xs text-warn">
        Este navegador no puede abrir una ventana en cada monitor. Usa <b>Chrome</b> o <b>Edge</b> para lanzarlas solas; mientras, ábrelas a mano abajo.
      </p>
    );
  }

  if (!screens) {
    return (
      <div className="space-y-2 rounded-lg border border-accent/30 bg-blue-50/50 p-3">
        <p className="text-xs text-ink">
          Detecta los monitores y proyectores conectados, confirma cuáles son de salida y lánzalos: cada ventana se abre en su monitor y se pone a pantalla completa.
        </p>
        <button onClick={detect} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white hover:brightness-110">
          Detectar pantallas
        </button>
        {perm === "prompt" && <p className="text-[11px] text-muted">Chrome preguntará si permites «administrar ventanas en todas tus pantallas»: elige <b>Permitir</b>.</p>}
        {(perm === "denied" || error) && (
          <p className="text-[11px] text-bad">
            {error ?? "El permiso está bloqueado."} Actívalo en el candado de la barra de dirección → <b>Administración de ventanas</b> → Permitir, y vuelve a detectar.
          </p>
        )}
      </div>
    );
  }

  // Mapa a escala de cómo están acomodados los monitores en el sistema.
  const minX = Math.min(...screens.map((s) => s.left));
  const minY = Math.min(...screens.map((s) => s.top));
  const bw = Math.max(...screens.map((s) => s.left + s.width)) - minX;
  const bh = Math.max(...screens.map((s) => s.top + s.height)) - minY;
  const outputList = launched?.map((p, i) => ({ p, o: outputs[`letrasvida-live-${i + 1}`] }));

  return (
    <div className="space-y-2.5 rounded-lg border border-accent/30 bg-blue-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-ink">
          {screens.length === 1 ? "1 pantalla conectada" : `${screens.length} pantallas conectadas`}
          <span className="font-normal text-muted"> · toca las que son de salida</span>
        </p>
        <button onClick={detect} className="text-[11px] text-muted underline underline-offset-2 hover:text-ink">Volver a detectar</button>
      </div>

      <div className="relative mx-auto" style={{ width: `min(100%, ${(150 * bw) / bh}px)`, aspectRatio: `${bw} / ${bh}` }}>
        {screens.map((s) => {
          const n = order.get(s.key);
          return (
            <button
              key={s.key}
              onClick={() => toggle(s.key)}
              title={`${s.label} · ${s.pixelWidth}×${s.pixelHeight}`}
              className={clsx(
                "absolute flex flex-col items-center justify-center overflow-hidden rounded-md border-2 text-center transition-colors",
                n ? "border-accent bg-accent text-white" : "border-line bg-panel text-muted hover:border-accent/50",
              )}
              style={{
                left: `calc(${((s.left - minX) / bw) * 100}% + 2px)`,
                top: `calc(${((s.top - minY) / bh) * 100}% + 2px)`,
                width: `calc(${(s.width / bw) * 100}% - 4px)`,
                height: `calc(${(s.height / bh) * 100}% - 4px)`,
              }}
            >
              <span className="text-lg font-bold leading-none">{n ? (mode === "joined" ? n : "✓") : "—"}</span>
              {s.isCurrent && <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-80">control</span>}
            </button>
          );
        })}
      </div>

      <ul className="space-y-1">
        {screens.map((s) => {
          const p = plan.find((x) => x.screen.key === s.key);
          return (
            <li key={s.key}>
              <label className="flex cursor-pointer flex-wrap items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-panel">
                <input type="checkbox" checked={Boolean(p)} onChange={() => toggle(s.key)} className="accent-accent" />
                <span className="font-semibold">{s.label}</span>
                <span className="text-muted tabular-nums">{s.pixelWidth}×{s.pixelHeight}</span>
                {s.isCurrent && <span className="rounded bg-ink/10 px-1.5 py-0.5 text-[10px] font-semibold">aquí está este control</span>}
                {s.isPrimary && !s.isCurrent && <span className="rounded bg-ink/10 px-1.5 py-0.5 text-[10px] font-semibold">principal</span>}
                {p && <span className="ml-auto font-semibold text-accent">{p.split.of > 1 ? splitLabel(p.split) : "Imagen completa"}</span>}
              </label>
            </li>
          );
        })}
      </ul>

      {plan.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["joined", "Unidas en una imagen ancha"],
              ["mirror", "La misma imagen en cada una"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={clsx("rounded-lg border px-2.5 py-1 text-xs font-semibold", mode === m ? "border-accent bg-accent text-white" : "border-line bg-panel hover:border-accent/60")}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {screens.length === 1 && !plan.length && (
        <p className="text-[11px] text-warn">Solo se ve la pantalla de este control. Conecta los monitores o proyectores y pulsa «Volver a detectar» (o márcala para hacer una prueba).</p>
      )}
      {lowRes.length > 0 && best && (
        <p className="text-[11px] text-warn">
          {lowRes.map((p) => `${p.screen.label}, ${splitLabel(p.split).toLowerCase()}, recibe ${p.screen.pixelWidth}×${p.screen.pixelHeight}`).join("; ")} y {best.label} {best.pixelWidth}×{best.pixelHeight}: se verá menos nítida.
          Es la señal que sale del adaptador; revisa en la configuración de pantallas del sistema que esté a su resolución máxima (o usa un adaptador 4K).
          Tamaño y unión se corrigen con <b>Ajustar</b> en esa salida, abajo; el ajuste queda guardado con esa tele.
        </p>
      )}
      {coversControl && <p className="text-[11px] text-warn">La salida va a tapar este control en su pantalla. Mueve el control a otro monitor o desmarca esa pantalla.</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={launch} disabled={!plan.length} className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-40">
          {plan.length ? `Lanzar en ${plan.length === 1 ? "1 pantalla" : `${plan.length} pantallas`}` : "Elige al menos una pantalla"}
        </button>
        {launched && (
          <>
            <button onClick={onIdentify} className="rounded-lg border border-line bg-panel px-2.5 py-1 text-xs font-semibold hover:border-accent/60">Identificar</button>
            <button
              onClick={() => {
                onClose();
                setLaunched(null);
              }}
              className="rounded-lg border border-line bg-panel px-2.5 py-1 text-xs font-semibold hover:border-bad/50 hover:text-bad"
            >
              Cerrar salidas
            </button>
          </>
        )}
      </div>

      {error && <p className="text-[11px] text-bad">{error}</p>}

      {outputList && (
        <ul className="space-y-0.5 text-xs">
          {outputList.map(({ p, o }, i) => (
            <li key={i} className="flex items-baseline gap-2">
              <span className={clsx("h-2 w-2 shrink-0 rounded-full", !o ? "bg-line" : o.fullscreen ? "bg-good" : "bg-warn")} />
              <span className="text-muted">
                <b className="text-ink">{p.split.of > 1 ? splitLabel(p.split) : `Salida ${i + 1}`}</b> · {p.screen.label} —{" "}
                {!o ? "abriendo…" : o.fullscreen ? "a pantalla completa" : "falta un clic en esa pantalla para ponerla a pantalla completa"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!autoFs && (
        <details className="text-[11px] text-muted">
          <summary className="cursor-pointer">Cada pantalla pide un clic para ponerse a pantalla completa. ¿Sin clics?</summary>
          <p className="mt-1">
            El navegador solo deja entrar a pantalla completa sin un clic si el sitio está autorizado por la política <code>AutomaticFullscreenAllowedForUrls</code> de Chrome o Edge.
            Con eso configurado una vez en la PC de la iglesia, «Lanzar» deja todo listo sin tocar las pantallas.
          </p>
        </details>
      )}
    </div>
  );
}
