import { useEffect, useRef, useState } from "react";
import { ensureFont, loadDesign, type Design } from "./lib/design";
import { loadCalibration, loadLayout, loadOutputName, loadSplit, LocalLive, outputId, saveCalibration, saveOutputName, saveSplit, SPLIT_OPTIONS, splitLabel, tramoAspect, tramoRect, type Calibration, type IdleMode, type LiveLayout, type LiveState, type OutputInfo, type Split } from "./lib/live";
import { drawPattern, drawSlide, IN_SECONDS, loadLogo, OUT_SECONDS } from "./lib/render";
import type { Slide } from "./lib/slides";
import { builtinUrl, getBackgroundBlob } from "./lib/backgrounds";

/**
 * Pantalla de salida: ocupa toda la ventana y dibuja lo que mande el control.
 * Se abre en /live (segunda ventana en la PC de ProPresenter, o como objeto
 * web dentro de un slide de ProPresenter).
 */
export function LivePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"esperando" | "conectado">("esperando");
  const [badge, setBadge] = useState<Split | null>(null);
  const [gear, setGear] = useState(false);
  const [split, setSplit] = useState<Split>(() => loadSplit(outputId()));
  const badgeTimer = useRef<number | null>(null);
  const splitRef = useRef(split);
  splitRef.current = split;
  const idRef = useRef(outputId());
  const liveRef = useRef<LocalLive | null>(null);
  const repaintRef = useRef<() => void>(() => {});
  const showBadge = () => {
    setBadge({ ...splitRef.current });
    if (badgeTimer.current) window.clearTimeout(badgeTimer.current);
    badgeTimer.current = window.setTimeout(() => setBadge(null), 5000);
  };
  const [cal, setCal] = useState<Calibration>(() => loadCalibration(outputId()));
  const calRef = useRef(cal);
  calRef.current = cal;
  const [layout, setLayout] = useState<LiveLayout>(loadLayout);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const dpr = () => window.devicePixelRatio || 1;
  const info = (): OutputInfo => ({
    id: idRef.current,
    name: nameRef.current,
    ...splitRef.current,
    width: Math.round(window.innerWidth * dpr()),
    height: Math.round(window.innerHeight * dpr()),
    cal: calRef.current,
  });
  /** Ajuste fino de esta salida (llega desde el control en vivo). */
  const calibrate = (next: Calibration) => {
    calRef.current = next;
    setCal(next);
    saveCalibration(idRef.current, next);
    repaintRef.current();
    liveRef.current?.send({ type: "hello", from: "output", output: info() });
  };
  const rename = (next: string) => {
    nameRef.current = next;
    setName(next);
    saveOutputName(idRef.current, next);
    liveRef.current?.send({ type: "hello", from: "output", output: info() });
  };
  /** Cambia el tramo de esta ventana (desde el ⚙, un atajo o el panel de control). */
  const assign = (next: Split) => {
    splitRef.current = next;
    setSplit(next);
    saveSplit(idRef.current, next);
    repaintRef.current();
    showBadge();
    liveRef.current?.send({ type: "hello", from: "output", output: info() });
  };
  const [hint, setHint] = useState(true);
  const hintTimer = useRef<number | null>(null);
  const showHint = () => {
    setHint(true);
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(false), 4000);
  };
  const current = useRef<{ slide: Slide | null; design: Design; idle: IdleMode; background: LiveState["background"] }>({ slide: null, design: loadDesign(), idle: "background", background: null });
  const [media, setMedia] = useState<{ id: string; kind: "video" | "image"; url: string } | null>(null);
  const [mediaHidden, setMediaHidden] = useState(false);
  const mediaRef = useRef<{ id: string; url: string } | null>(null);
  const startedAt = useRef(0);
  const [name, setName] = useState(() => loadOutputName(outputId()));
  const nameRef = useRef(name);
  nameRef.current = name;
  const logoRef = useRef<HTMLImageElement | null>(null);
  const anim = useRef<{ raf: number | null; cancel: () => void }>({ raf: null, cancel: () => {} });

  useEffect(() => {
    const live = new LocalLive();
    liveRef.current = live;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const fit = () => {
      canvas.width = Math.round(window.innerWidth * dpr());
      canvas.height = Math.round(window.innerHeight * dpr());
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };

    /**
     * La composición mide `of` tramos de ancho; esta ventana dibuja el tramo
     * `part` dentro del rectángulo que dicta su calibración (fuera: negro).
     * Coordenadas del dibujo: composición de `tw * of` × `r.h` píxeles CSS.
     */
    const paint = (slide: Slide | null, design: Design, t?: number, outStart?: number) => {
      const split = splitRef.current;
      const { part, of } = split;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const r = tramoRect(vw, vh, split, layoutRef.current, calRef.current);
      const tw = r.h * tramoAspect(vw, vh, split, layoutRef.current);
      const W = tw * of;
      const H = r.h;
      const hasMedia = Boolean(current.current.background);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr(), dpr());
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      ctx.translate(r.x, r.y);
      ctx.scale(r.w / tw, 1);
      ctx.translate(-(part - 1) * tw, 0);

      if (layoutRef.current.pattern) {
        drawPattern(ctx, W, H, of, design.fontFamily);
      } else if (!slide) {
        // Reposo: negro, fondo del diseño (o el video), o logo centrado sobre uno u otro.
        const idle = current.current.idle;
        const black = idle === "black" || idle === "logo-black";
        if (black || !hasMedia) {
          ctx.fillStyle = black || design.background === "transparent" ? "#000000" : design.background;
          ctx.fillRect(0, 0, W, H);
        }
        const logo = logoRef.current;
        if ((idle === "logo" || idle === "logo-black") && logo) {
          const h = Math.min(H * 0.42, (W * 0.18 * logo.naturalHeight) / logo.naturalWidth);
          const w = (h * logo.naturalWidth) / logo.naturalHeight;
          ctx.drawImage(logo, (W - w) / 2, (H - h) / 2, w, h);
        }
      } else {
        const d = hasMedia ? { ...design, background: "transparent" } : design;
        drawSlide(ctx, W, H, d, slide, logoRef.current, t == null ? undefined : { t, outStart: outStart ?? Infinity });
      }
      ctx.restore();
    };

    const stopAnim = () => {
      if (anim.current.raf) cancelAnimationFrame(anim.current.raf);
      anim.current.raf = null;
    };

    /** Saca el slide actual (si hay) y mete el nuevo, con la misma animación del video. */
    /** Carga (o quita) el fondo en movimiento desde IndexedDB. */
    const syncMedia = async (bg: LiveState["background"], at: number) => {
      if (!bg) {
        if (mediaRef.current) URL.revokeObjectURL(mediaRef.current.url);
        mediaRef.current = null;
        setMedia(null);
        return;
      }
      if (mediaRef.current?.id === bg.id) return;
      let url = builtinUrl(bg.id);
      if (!url) {
        const blob = await getBackgroundBlob(bg.id);
        if (!blob) return;
        url = URL.createObjectURL(blob);
      }
      if (mediaRef.current && !builtinUrl(mediaRef.current.id)) URL.revokeObjectURL(mediaRef.current.url);
      mediaRef.current = { id: bg.id, url };
      startedAt.current = at;
      setMedia({ id: bg.id, kind: bg.kind, url });
    };

    const transition = async (next: Slide | null, design: Design, idle: IdleMode, background: LiveState["background"], at: number) => {
      stopAnim();
      const prev = current.current.slide;
      if (design.logo !== current.current.design.logo) logoRef.current = await loadLogo(design.logo);
      if (design.fontFamily !== current.current.design.fontFamily) await ensureFont(design.fontFamily);
      current.current = { slide: next, design, idle, background };
      setMediaHidden(!next && (idle === "black" || idle === "logo-black"));
      await syncMedia(background, at);

      const run = (slide: Slide | null, seconds: number, draw: (t: number) => void) =>
        new Promise<void>((resolve) => {
          const start = performance.now();
          const tick = () => {
            const t = (performance.now() - start) / 1000;
            draw(t);
            if (t < seconds) anim.current.raf = requestAnimationFrame(tick);
            else {
              anim.current.raf = null;
              resolve();
            }
          };
          anim.current.raf = requestAnimationFrame(tick);
          void slide;
        });

      if (prev) {
        // Salida del anterior: reproducimos solo el tramo final de la animación.
        await run(prev, OUT_SECONDS + 0.05, (t) => paint(prev, design, IN_SECONDS + 10 + t, IN_SECONDS + 10));
        if (current.current.slide !== next) return; // llegó otro mientras salía
      }
      if (next) {
        await run(next, IN_SECONDS + 0.3, (t) => paint(next, design, t));
        if (current.current.slide === next) paint(next, design);
      } else {
        paint(null, design);
      }
    };

    const apply = (state: LiveState) => {
      setStatus("conectado");
      transition(state.slide, state.design, state.idle ?? "background", state.background ?? null, state.at);
    };

    fit();
    repaintRef.current = () => paint(current.current.slide, current.current.design);
    window.addEventListener("resize", () => {
      fit();
      paint(current.current.slide, current.current.design);
      live.send({ type: "hello", from: "output", output: info() });
    });

    (async () => {
      await ensureFont(current.current.design.fontFamily);
      logoRef.current = await loadLogo(current.current.design.logo);
      const last = live.last();
      if (last) apply(last);
      else paint(null, current.current.design);
      live.send({ type: "hello", from: "output", output: info() });
    })();

    const off = live.on((m) => {
      if (m.type === "state") apply(m.state);
      if (m.type === "ping") live.send({ type: "pong", output: info() });
      if (m.type === "hello" && m.from === "control") live.send({ type: "hello", from: "output", output: info() });
      if (m.type === "identify" && (!m.id || m.id === idRef.current)) showBadge();
      if (m.type === "assign" && m.id === idRef.current) assign(m.split);
      if (m.type === "rename" && m.id === idRef.current) rename(m.name);
      if (m.type === "calibrate" && m.id === idRef.current) calibrate(m.cal);
      if (m.type === "layout") {
        layoutRef.current = m.layout;
        setLayout(m.layout);
        repaintRef.current();
      }
      if (m.type === "swap" && splitRef.current.of > 1) {
        const { part, of } = splitRef.current;
        assign({ part: of - part + 1, of });
      }
    });
    showBadge();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") document.documentElement.requestFullscreen?.();
      if (e.key === "u" || e.key === "U") assign({ part: 1, of: 1 });
      if (e.key === "1" || e.key === "2") assign({ part: parseInt(e.key, 10), of: Math.max(2, splitRef.current.of) });
      if (e.key === "3") assign({ part: 3, of: 3 });
      if (e.key === "Escape") setGear(false);
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => setHint(false), 6000);
    return () => {
      off();
      live.close();
      stopAnim();
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, []);

  const rect = tramoRect(viewport.w, viewport.h, split, layout, cal);
  const tw = rect.h * tramoAspect(viewport.w, viewport.h, split, layout);

  return (
    <div
      className={hint ? "fixed inset-0 bg-black" : "fixed inset-0 cursor-none bg-black"}
      onClick={() => !gear && document.documentElement.requestFullscreen?.()}
      onMouseMove={showHint}
    >
      {media && !mediaHidden && !layout.pattern && (
        <div className="absolute overflow-hidden" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
          {/* Tramo a la proporción común y luego estirado al rectángulo: el recorte del video coincide en todas las salidas. */}
          <div className="absolute left-0 top-0 h-full origin-top-left" style={{ width: tw, transform: `scaleX(${rect.w / tw})` }}>
          {media.kind === "video" ? (
            <video
              key={media.id}
              src={media.url}
              autoPlay
              loop
              muted
              playsInline
              onLoadedMetadata={(e) => {
                // Arranca en el mismo punto en todas las ventanas (mismo reloj de inicio).
                const v = e.currentTarget;
                if (startedAt.current && v.duration && isFinite(v.duration)) v.currentTime = ((Date.now() - startedAt.current) / 1000) % v.duration;
              }}
              className="absolute top-0 h-full max-w-none object-cover"
              style={{ width: `${split.of * 100}%`, left: `${-(split.part - 1) * 100}%` }}
            />
          ) : (
            <img
              key={media.id}
              src={media.url}
              alt=""
              className="absolute top-0 h-full max-w-none object-cover"
              style={{ width: `${split.of * 100}%`, left: `${-(split.part - 1) * 100}%` }}
            />
          )}
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="absolute inset-0 block" />
      {(hint || gear) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setGear((v) => !v);
          }}
          className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2.5 py-1 text-sm text-white/90 hover:bg-black/80"
          title="Configurar esta pantalla"
        >
          ⚙ {name || idRef.current} · {splitLabel(split)}
        </button>
      )}
      {gear && (
        <div className="absolute bottom-12 left-3 w-72 rounded-xl bg-black/85 p-3 text-sm text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <label className="mb-2 block text-xs text-white/70">
            Nombre de esta pantalla
            <input
              value={name}
              onChange={(e) => rename(e.target.value)}
              placeholder={idRef.current}
              className="mt-1 w-full rounded-md border border-white/30 bg-white/10 px-2 py-1 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </label>
          <p className="mb-2 text-xs text-white/70">Esta ventana muestra:</p>
          <div className="grid grid-cols-2 gap-1.5">
            {SPLIT_OPTIONS.map((o) => {
              const active = o.split.part === split.part && o.split.of === split.of;
              return (
                <button
                  key={o.label}
                  onClick={() => assign(o.split)}
                  className={active ? "rounded-lg bg-white px-2 py-1.5 text-xs font-bold text-black" : "rounded-lg border border-white/30 px-2 py-1.5 text-xs font-semibold hover:bg-white/10"}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-white/60">Atajos: 1 / 2 = mitad izquierda / derecha · 3 = tercio 3 · U = única · F = pantalla completa</p>
        </div>
      )}
      {hint && (
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white/80">
          {name || idRef.current} · {status} · clic o F = pantalla completa
        </div>
      )}
      {badge && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-3xl bg-black/75 px-[6vw] py-[4vh] text-center text-white shadow-2xl">
            <div className="text-[18vh] font-bold leading-none">{badge.part}</div>
            {name && <div className="mt-2 text-[5vh] font-bold">{name}</div>}
            <div className="mt-1 text-[3.5vh] font-semibold text-white/85">
              {badge.of === 1 ? "Pantalla única" : badge.of === 2 ? (badge.part === 1 ? "Mitad izquierda" : "Mitad derecha") : `Tramo ${badge.part} de ${badge.of}`}
            </div>
            <div className="mt-1 text-[2.2vh] text-white/70">{idRef.current} · {Math.round(viewport.w * dpr())}×{Math.round(viewport.h * dpr())} · F = pantalla completa</div>
          </div>
        </div>
      )}
    </div>
  );
}
