import { useCallback, useEffect, useRef, useState } from "react";
import type { Design } from "../lib/design";
import { liveUrl, loadBackgroundChoice, loadIdle, loadLayout, LocalLive, saveBackgroundChoice, saveIdle, saveLayout, type Calibration, type IdleMode, type LiveLayout, type LiveState, type OutputInfo, type Split } from "../lib/live";
import type { Slide } from "../lib/slides";

/** Lado "control" del modo en vivo: publica slides y sabe si hay una salida escuchando. */
export function useLive(design: Design) {
  const live = useRef<LocalLive | null>(null);
  const seq = useRef(0);
  const [current, setCurrent] = useState<Slide | null>(null);
  const currentRef = useRef<Slide | null>(null);
  currentRef.current = current;
  const [connected, setConnected] = useState(false);
  const [outputs, setOutputs] = useState<Record<string, OutputInfo & { seen: number }>>({});
  const [idle, setIdleState] = useState<IdleMode>(loadIdle);
  const idleRef = useRef(idle);
  idleRef.current = idle;
  const [background, setBackgroundState] = useState(loadBackgroundChoice);
  const backgroundRef = useRef(background);
  backgroundRef.current = background;
  const [layout, setLayoutState] = useState<LiveLayout>(loadLayout);
  const lastPong = useRef(0);
  const designRef = useRef(design);
  designRef.current = design;

  const publish = useCallback((slide: Slide | null) => {
    const state: LiveState = { seq: ++seq.current, at: Date.now(), slide, design: designRef.current, idle: idleRef.current, background: backgroundRef.current };
    live.current?.send({ type: "state", state });
    setCurrent(slide);
  }, []);

  /** Cambia el fondo en movimiento; se ve al instante (con o sin versículo). */
  const setBackground = useCallback(
    (bg: { id: string; kind: "video" | "image" } | null) => {
      backgroundRef.current = bg;
      setBackgroundState(bg);
      saveBackgroundChoice(bg);
      publish(currentRef.current);
    },
    [publish],
  );

  /** Cambia el reposo; si la pantalla está vacía, se ve al instante. */
  const setIdle = useCallback(
    (mode: IdleMode) => {
      idleRef.current = mode;
      setIdleState(mode);
      saveIdle(mode);
      if (!currentRef.current) publish(null);
    },
    [publish],
  );

  useEffect(() => {
    const l = new LocalLive();
    live.current = l;
    const off = l.on((m) => {
      if (m.type === "pong" || (m.type === "hello" && m.from === "output")) {
        lastPong.current = Date.now();
        setConnected(true);
        setOutputs((prev) => ({ ...prev, [m.output.id]: { ...m.output, seen: Date.now() } }));
      }
    });
    l.send({ type: "hello", from: "control" });
    const timer = setInterval(() => {
      l.send({ type: "ping" });
      if (Date.now() - lastPong.current > 8000) setConnected(false);
      // Olvida las salidas que dejaron de responder.
      setOutputs((prev) => {
        const alive = Object.fromEntries(Object.entries(prev).filter(([, o]) => Date.now() - o.seen < 9000));
        return Object.keys(alive).length === Object.keys(prev).length ? prev : alive;
      });
    }, 3000);
    return () => {
      off();
      clearInterval(timer);
      l.close();
      live.current = null;
    };
  }, []);

  // Si cambia el diseño mientras hay algo en pantalla, la salida se actualiza sola.
  useEffect(() => {
    if (currentRef.current) publish(currentRef.current);
  }, [design, publish]);

  /** Abre 1 ventana de salida, o `screens` ventanas (una por monitor) que juntas forman una pantalla ancha. */
  const openOutput = useCallback((screens = 1) => {
    for (let i = 1; i <= screens; i++) {
      window.open(liveUrl(i, screens), `letrasvida-live-${i}`, `popup=yes,width=${screens > 1 ? 960 : 1280},height=${screens > 1 ? 540 : 360},left=${(i - 1) * 980},top=80`);
    }
  }, []);

  const identify = useCallback((id?: string) => live.current?.send({ type: "identify", id }), []);
  const swap = useCallback(() => live.current?.send({ type: "swap" }), []);
  const assign = useCallback((id: string, split: Split) => live.current?.send({ type: "assign", id, split }), []);
  const rename = useCallback((id: string, name: string) => {
    live.current?.send({ type: "rename", id, name });
    setOutputs((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], name } } : prev));
  }, []);

  const calibrate = useCallback((id: string, cal: Calibration) => {
    live.current?.send({ type: "calibrate", id, cal });
    setOutputs((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], cal } } : prev));
  }, []);
  /** Proporción común de los tramos y carta de ajuste: van a todas las salidas. */
  const setLayout = useCallback((next: LiveLayout) => {
    setLayoutState(next);
    saveLayout(next);
    live.current?.send({ type: "layout", layout: next });
  }, []);

  return { layout, setLayout, calibrate, current, connected, outputs, idle, setIdle, background, setBackground, show: publish, clear: () => publish(null), openOutput, identify, swap, assign, rename };
}
