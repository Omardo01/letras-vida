import clsx from "clsx";
import { splitLabel } from "../lib/live";
import { downloadBlob } from "../lib/download";
import { chromePolicyReg, inPositionOrder, resolvePlan, type LaunchMode, type WindowManagementState } from "../lib/screens";
import type { useScreens } from "../hooks/useScreens";

interface Props {
  scr: ReturnType<typeof useScreens>;
  onIdentify: () => void;
}

/** Nombre del tramo para el operador: con dos teles unidas, izquierda y derecha. */
const roleLabel = (part: number, of: number) => (of === 1 ? "Imagen completa" : of === 2 ? (part === 1 ? "Izquierda" : "Derecha") : splitLabel({ part, of }));

/**
 * Configuración de pantallas, como en ProPresenter: qué monitores son de
 * salida y si forman una sola imagen ancha o repiten la misma. Se guarda sola;
 * el botón «Encender pantallas» del control la usa.
 */
export function ScreenSetup({ scr, onIdentify }: Props) {
  const { perm, screens, plan, setPlan, detect, autoFs } = scr;

  if (perm === "unsupported") {
    return (
      <p className="rounded-lg border border-warn/40 bg-amber-50 px-3 py-2 text-xs text-warn">
        Este navegador no puede poner una ventana en cada monitor. Usa <b>Google Chrome</b> en la PC de las pantallas; mientras, ábrelas a mano en «Avanzado».
      </p>
    );
  }

  if (!screens) {
    return (
      <div className="space-y-2 rounded-lg border border-accent/30 bg-blue-50/50 p-3">
        <p className="text-xs text-ink">Primero hay que ver qué pantallas tiene conectadas esta PC (las teles y el monitor de operación).</p>
        <button onClick={detect} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white hover:brightness-110">
          Detectar pantallas
        </button>
        {perm === "prompt" && <p className="text-[11px] text-muted">Chrome preguntará si permites «administrar ventanas en todas tus pantallas»: elige <b>Permitir</b>.</p>}
        {perm === "denied" && (
          <p className="text-[11px] text-bad">
            El permiso está bloqueado. Actívalo en el candado de la barra de dirección → <b>Administración de ventanas</b> → Permitir, y vuelve a detectar.
          </p>
        )}
        <ChromeSetup perm={perm} autoFs={autoFs} />
      </div>
    );
  }

  const mode: LaunchMode = plan?.mode ?? "joined";
  const selected = plan?.selected ?? [];
  const { outputs: planned } = plan ? resolvePlan(screens, plan) : { outputs: [] };
  const role = new Map(planned.map((p) => [p.screen.key, p]));
  const coversControl = planned.some((p) => p.screen.isCurrent);
  // Unidas con resoluciones distintas: la de menos píxeles (típico de un adaptador) se ve menos nítida.
  const sharpest = Math.max(0, ...planned.map((p) => p.screen.pixelWidth * p.screen.pixelHeight));
  const lowRes = mode === "joined" && planned.length > 1 ? planned.filter((p) => p.screen.pixelWidth * p.screen.pixelHeight < sharpest * 0.9) : [];
  const best = planned.find((p) => p.screen.pixelWidth * p.screen.pixelHeight === sharpest)?.screen;

  const update = (patch: Partial<NonNullable<typeof plan>>) => setPlan({ selected, mode, autoStart: plan?.autoStart, ...patch });
  const toggle = (key: string) => {
    const keys = planned.map((p) => p.screen.key);
    update({ selected: inPositionOrder(screens, keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]) });
  };

  // Mapa a escala de cómo están acomodados los monitores en Windows.
  const minX = Math.min(...screens.map((s) => s.left));
  const minY = Math.min(...screens.map((s) => s.top));
  const bw = Math.max(...screens.map((s) => s.left + s.width)) - minX;
  const bh = Math.max(...screens.map((s) => s.top + s.height)) - minY;

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
          const p = role.get(s.key);
          return (
            <button
              key={s.key}
              onClick={() => toggle(s.key)}
              title={`${s.label} · ${s.pixelWidth}×${s.pixelHeight}`}
              className={clsx(
                "absolute flex flex-col items-center justify-center overflow-hidden rounded-md border-2 text-center transition-colors",
                p ? "border-accent bg-accent text-white" : "border-line bg-panel text-muted hover:border-accent/50",
              )}
              style={{
                left: `calc(${((s.left - minX) / bw) * 100}% + 2px)`,
                top: `calc(${((s.top - minY) / bh) * 100}% + 2px)`,
                width: `calc(${(s.width / bw) * 100}% - 4px)`,
                height: `calc(${(s.height / bh) * 100}% - 4px)`,
              }}
            >
              <span className="text-xs font-bold leading-tight">{p ? roleLabel(p.split.part, p.split.of) : "—"}</span>
              {s.isCurrent && <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-80">control</span>}
            </button>
          );
        })}
      </div>

      <ul className="space-y-1">
        {screens.map((s) => {
          const p = role.get(s.key);
          return (
            <li key={s.key}>
              <label className="flex cursor-pointer flex-wrap items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-panel">
                <input type="checkbox" checked={Boolean(p)} onChange={() => toggle(s.key)} className="accent-accent" />
                <span className="font-semibold">{s.label}</span>
                <span className="text-muted tabular-nums">{s.pixelWidth}×{s.pixelHeight}</span>
                {s.isCurrent && <span className="rounded bg-ink/10 px-1.5 py-0.5 text-[10px] font-semibold">aquí está este control</span>}
                {s.isPrimary && !s.isCurrent && <span className="rounded bg-ink/10 px-1.5 py-0.5 text-[10px] font-semibold">principal</span>}
                {p && <span className="ml-auto font-semibold text-accent">{roleLabel(p.split.part, p.split.of)}</span>}
              </label>
            </li>
          );
        })}
      </ul>

      {planned.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["joined", "Unidas: una sola imagen ancha"],
              ["mirror", "Espejo: la misma imagen en cada una"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => update({ mode: m })}
              className={clsx("rounded-lg border px-2.5 py-1 text-xs font-semibold", mode === m ? "border-accent bg-accent text-white" : "border-line bg-panel hover:border-accent/60")}
            >
              {label}
            </button>
          ))}
          {mode === "joined" && (
            <button
              onClick={() => update({ selected: planned.map((p) => p.screen.key).reverse() })}
              title="Si la imagen sale al revés (la izquierda en la tele derecha)"
              className="rounded-lg border border-line bg-panel px-2.5 py-1 text-xs font-semibold hover:border-accent/60"
            >
              ⇄ Intercambiar izquierda y derecha
            </button>
          )}
          <button onClick={onIdentify} className="rounded-lg border border-line bg-panel px-2.5 py-1 text-xs font-semibold hover:border-accent/60" title="Con las pantallas encendidas, cada tele muestra en grande cuál es">
            Identificar
          </button>
        </div>
      )}

      {screens.length === 1 && !planned.length && (
        <p className="text-[11px] text-warn">Solo se ve la pantalla de este control. Prende las teles, revisa que Windows las tenga en «Extender estas pantallas» y pulsa «Volver a detectar».</p>
      )}
      {lowRes.length > 0 && best && (
        <p className="text-[11px] text-warn">
          {lowRes.map((p) => `${p.screen.label} (${roleLabel(p.split.part, p.split.of).toLowerCase()}) recibe ${p.screen.pixelWidth}×${p.screen.pixelHeight}`).join("; ")} y {best.label} {best.pixelWidth}×{best.pixelHeight}: se verá menos nítida.
          Revisa en Configuración → Pantalla de Windows que esté a su resolución máxima. Tamaño y unión se corrigen con <b>Ajustar</b> en «Ajuste de la unión».
        </p>
      )}
      {coversControl && <p className="text-[11px] text-warn">La salida va a tapar este control en su pantalla. Mueve el control al monitor de operación o desmarca esa pantalla.</p>}

      <label className="flex cursor-pointer items-center gap-2 text-xs">
        <input type="checkbox" checked={Boolean(plan?.autoStart)} onChange={(e) => update({ autoStart: e.target.checked })} className="accent-accent" />
        Encender las pantallas en cuanto abra este control
      </label>

      <ChromeSetup perm={perm} autoFs={autoFs} />
    </div>
  );
}

/** Qué le falta a Chrome en esta PC para encender las teles sin clics, y el archivo que lo resuelve. */
function ChromeSetup({ perm, autoFs }: { perm: WindowManagementState | null; autoFs: boolean }) {
  const ready = perm === "granted" && autoFs;
  const check = (ok: boolean, label: string) => (
    <li className="flex items-center gap-1.5">
      <span className={clsx("inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white", ok ? "bg-good" : "bg-warn")}>{ok ? "✓" : "!"}</span>
      {label}
    </li>
  );
  return (
    <details open={!ready} className="rounded-lg border border-line bg-panel px-2.5 py-2 text-xs">
      <summary className="cursor-pointer font-semibold">{ready ? "Chrome listo: las teles se encienden sin clics" : "Para encender sin tocar las teles (una vez por PC)"}</summary>
      <ul className="mt-1.5 space-y-1">
        {check(perm === "granted", "Ver los monitores (Administración de ventanas)")}
        {check(autoFs, "Pantalla completa sin un clic en cada tele")}
      </ul>
      {!ready && (
        <div className="mt-2 space-y-1 text-muted">
          <p>En la PC de Windows de las pantallas, instala estos permisos de Chrome para este sitio ({window.location.origin}); también dejan abrir las dos ventanas de un solo clic:</p>
          <ol className="list-decimal space-y-0.5 pl-5">
            <li>
              <button onClick={() => downloadBlob(chromePolicyReg(window.location.origin), "permisos-chrome-letrasvida.reg")} className="font-semibold text-accent underline underline-offset-2">
                Descargar permisos-chrome-letrasvida.reg
              </button>
            </li>
            <li>Doble clic en el archivo descargado → <b>Sí</b> (pide ser administrador) → Aceptar.</li>
            <li>En Chrome escribe <code className="rounded bg-ink/10 px-1">chrome://policy</code> en la barra, pulsa <b>Volver a cargar políticas</b> y recarga este control.</li>
          </ol>
        </div>
      )}
    </details>
  );
}
