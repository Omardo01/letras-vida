import type { Design } from "./design";
import type { Slide } from "./slides";

/** Qué muestra la salida cuando no hay versículo. */
export type IdleMode = "black" | "background" | "logo" | "logo-black";

export const IDLE_OPTIONS: { mode: IdleMode; label: string; hint: string }[] = [
  { mode: "black", label: "Negro", hint: "Pantalla completamente negra" },
  { mode: "background", label: "Fondo", hint: "Solo el color de fondo del diseño" },
  { mode: "logo", label: "Logo", hint: "Logo centrado sobre el fondo del diseño" },
  { mode: "logo-black", label: "Logo sobre negro", hint: "Logo centrado sobre negro" },
];

/** Lo que la pantalla de salida necesita para dibujar (o quedar en reposo). */
export interface LiveState {
  seq: number;
  at: number;
  slide: Slide | null;
  design: Design;
  /** Cómo se ve la salida cuando `slide` es null. */
  idle?: IdleMode;
  /** Fondo en movimiento (id en IndexedDB) detrás de todo; null = sin fondo. */
  background?: { id: string; kind: "video" | "image" } | null;
}

/** Qué tramo de la composición muestra una ventana de salida. */
export interface Split {
  part: number;
  of: number;
}

export interface OutputInfo extends Split {
  id: string;
  /** Nombre puesto por el usuario ("Pantalla izquierda del salón"). */
  name: string;
  /** Tamaño de la ventana en píxeles físicos (lo que de verdad manda la tarjeta de video). */
  width: number;
  height: number;
  cal: Calibration;
}

/**
 * Cómo se acomoda el tramo de esta salida dentro de su ventana. Sirve cuando
 * un monitor (p. ej. por adaptador DP) sale a otra resolución o proporción, o
 * la tele recorta los bordes (overscan): se ajusta hasta que la unión cuadre.
 */
export interface Calibration {
  /** contain = sin deformar, con bandas negras · cover = llena recortando · stretch = llena deformando. */
  fit: "contain" | "cover" | "stretch";
  /** Tamaño general (1 = 100 %). */
  zoom: number;
  /** Ancho y alto por separado (1 = 100 %), para compensar una tele que deforma. */
  sx: number;
  sy: number;
  /** Desplazamiento en fracción de la ventana (0.01 = 1 %). */
  dx: number;
  dy: number;
}

export const DEFAULT_CAL: Calibration = { fit: "contain", zoom: 1, sx: 1, sy: 1, dx: 0, dy: 0 };

export const FIT_OPTIONS: { fit: Calibration["fit"]; label: string; hint: string }[] = [
  { fit: "contain", label: "Encajar", hint: "Sin deformar; bandas negras si la pantalla tiene otra proporción" },
  { fit: "cover", label: "Llenar", hint: "Sin deformar; llena la pantalla recortando lo que sobre" },
  { fit: "stretch", label: "Estirar", hint: "Llena la pantalla deformando; úsalo si la tele ya deforma la señal" },
];

/** Ajustes que comparten todas las salidas. */
export interface LiveLayout {
  /** Proporción (ancho / alto) de cada tramo cuando hay pantallas unidas. */
  aspect: number;
  /** Muestra la carta de ajuste en vez del versículo. */
  pattern: boolean;
}

export const DEFAULT_LAYOUT: LiveLayout = { aspect: 16 / 9, pattern: false };

export const ASPECT_OPTIONS: { label: string; aspect: number }[] = [
  { label: "16:9", aspect: 16 / 9 },
  { label: "16:10", aspect: 16 / 10 },
  { label: "4:3", aspect: 4 / 3 },
  { label: "21:9", aspect: 64 / 27 },
];

/** "16:9", "16:10"… o el número si no es una proporción conocida. */
export function aspectLabel(w: number, h: number): string {
  const a = w / h;
  const known = [...ASPECT_OPTIONS, { label: "5:4", aspect: 5 / 4 }, { label: "32:9", aspect: 32 / 9 }].find((o) => Math.abs(o.aspect - a) / o.aspect < 0.01);
  return known ? known.label : `${a.toFixed(2)}:1`;
}

/** Proporción del tramo: la común si hay pantallas unidas; la de la ventana si es única. */
export const tramoAspect = (winW: number, winH: number, split: Split, layout: LiveLayout) => (split.of > 1 ? layout.aspect : winW / winH);

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Rectángulo (en píxeles de la ventana) donde se dibuja el tramo de esta
 * salida. Todas las salidas partidas usan la misma proporción de tramo, así
 * que el versículo mide lo mismo y cruza la unión sin escalones aunque un
 * monitor tenga otra resolución. Una ventana sola usa su propia proporción.
 */
export function tramoRect(winW: number, winH: number, split: Split, layout: LiveLayout, cal: Calibration): Rect {
  const aspect = tramoAspect(winW, winH, split, layout);
  let w = winW;
  let h = winH;
  if (cal.fit !== "stretch") {
    h = cal.fit === "contain" ? Math.min(winW / aspect, winH) : Math.max(winW / aspect, winH);
    w = h * aspect;
  }
  w *= cal.zoom * cal.sx;
  h *= cal.zoom * cal.sy;
  return { x: (winW - w) / 2 + cal.dx * winW, y: (winH - h) / 2 + cal.dy * winH, w, h };
}

export type LiveMessage =
  | { type: "state"; state: LiveState }
  | { type: "hello"; from: "control" }
  | { type: "hello"; from: "output"; output: OutputInfo }
  | { type: "ping" }
  | { type: "pong"; output: OutputInfo }
  /** Cada salida (o solo `id`) muestra un rótulo grande con su número y lado unos segundos. */
  | { type: "identify"; id?: string }
  /** Asigna a la salida `id` el tramo que debe mostrar. */
  | { type: "assign"; id: string; split: Split }
  /** Cambia el nombre de la salida `id`. */
  | { type: "rename"; id: string; name: string }
  /** Las salidas partidas se voltean (la 1 pasa a ser la 2 y viceversa). */
  | { type: "swap" }
  /** Ajuste fino de la salida `id` (tamaño, proporción, posición). */
  | { type: "calibrate"; id: string; cal: Calibration }
  /** Proporción común y carta de ajuste, para todas las salidas. */
  | { type: "layout"; layout: LiveLayout };

export const SPLIT_OPTIONS: { label: string; split: Split }[] = [
  { label: "Pantalla única", split: { part: 1, of: 1 } },
  { label: "Izquierda (½)", split: { part: 1, of: 2 } },
  { label: "Derecha (½)", split: { part: 2, of: 2 } },
  { label: "1 de 3", split: { part: 1, of: 3 } },
  { label: "2 de 3", split: { part: 2, of: 3 } },
  { label: "3 de 3", split: { part: 3, of: 3 } },
];

export function splitLabel(s: Split): string {
  return SPLIT_OPTIONS.find((o) => o.split.part === s.part && o.split.of === s.of)?.label ?? `${s.part} de ${s.of}`;
}

const CHANNEL = "letrasvida-live";
const LAST_KEY = "letrasvida.live.last";

/**
 * Canal entre el panel de control y la ventana de salida cuando ambos viven
 * en el mismo navegador (BroadcastChannel + localStorage para quien llegue tarde).
 */
export class LocalLive {
  private bc: BroadcastChannel | null = null;
  private listeners = new Set<(m: LiveMessage) => void>();

  constructor() {
    if (typeof BroadcastChannel !== "undefined") {
      this.bc = new BroadcastChannel(CHANNEL);
      this.bc.onmessage = (e) => this.listeners.forEach((l) => l(e.data as LiveMessage));
    }
  }

  send(m: LiveMessage) {
    this.bc?.postMessage(m);
    if (m.type === "state") {
      try {
        localStorage.setItem(LAST_KEY, JSON.stringify(m.state));
      } catch {
        /* sin espacio */
      }
    }
  }

  on(l: (m: LiveMessage) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  /** Último estado publicado, para que la salida arranque mostrando lo actual. */
  last(): LiveState | null {
    try {
      const raw = localStorage.getItem(LAST_KEY);
      return raw ? (JSON.parse(raw) as LiveState) : null;
    } catch {
      return null;
    }
  }

  close() {
    this.bc?.close();
  }
}

export const LIVE_PATH = "/live";
export const CONTROL_PATH = "/envivo";
export const isControlPage = () => window.location.pathname.replace(/\/$/, "") === CONTROL_PATH;
export const isLivePage = () => window.location.pathname.replace(/\/$/, "") === LIVE_PATH;

/**
 * Pantallas partidas: `/live?part=1&of=2` dibuja la mitad izquierda de la
 * composición y `part=2` la derecha. Una ventana a pantalla completa en cada
 * monitor = una sola pantalla ancha, sin ProPresenter.
 */
export function splitFromUrl(): Split {
  const q = new URLSearchParams(window.location.search);
  const of = Math.max(1, Math.min(8, parseInt(q.get("of") ?? "1", 10) || 1));
  const part = Math.max(1, Math.min(of, parseInt(q.get("part") ?? "1", 10) || 1));
  return { part, of };
}

const OUTPUT_ID_KEY = "letrasvida.live.output-id";

/** Identidad estable de esta ventana de salida (por nombre de ventana, o generada y guardada). */
export function outputId(): string {
  if (window.name) return window.name;
  try {
    let id = sessionStorage.getItem(OUTPUT_ID_KEY);
    if (!id) {
      id = `salida-${Math.random().toString(36).slice(2, 6)}`;
      sessionStorage.setItem(OUTPUT_ID_KEY, id);
    }
    return id;
  } catch {
    return "salida";
  }
}

/** El tramo asignado a esta ventana: lo recordado para su id, o lo que diga la URL. */
export function loadSplit(id: string): Split {
  try {
    const raw = localStorage.getItem(`letrasvida.live.split.${id}`);
    if (raw) return JSON.parse(raw) as Split;
  } catch {
    /* ignore */
  }
  return splitFromUrl();
}

export function saveSplit(id: string, split: Split) {
  try {
    localStorage.setItem(`letrasvida.live.split.${id}`, JSON.stringify(split));
  } catch {
    /* ignore */
  }
  window.history.replaceState(null, "", split.of > 1 ? `?part=${split.part}&of=${split.of}` : window.location.pathname);
}

export function liveUrl(part?: number, of?: number): string {
  return of && of > 1 ? `${LIVE_PATH}?part=${part}&of=${of}` : LIVE_PATH;
}

export function loadOutputName(id: string): string {
  try {
    return localStorage.getItem(`letrasvida.live.name.${id}`) ?? "";
  } catch {
    return "";
  }
}

export function saveOutputName(id: string, name: string) {
  try {
    localStorage.setItem(`letrasvida.live.name.${id}`, name);
  } catch {
    /* ignore */
  }
}

const IDLE_KEY = "letrasvida.live.idle";

export function loadIdle(): IdleMode {
  try {
    const v = localStorage.getItem(IDLE_KEY) as IdleMode | null;
    return v && IDLE_OPTIONS.some((o) => o.mode === v) ? v : "background";
  } catch {
    return "background";
  }
}

export function saveIdle(mode: IdleMode) {
  try {
    localStorage.setItem(IDLE_KEY, mode);
  } catch {
    /* ignore */
  }
}

const BG_KEY = "letrasvida.live.background";

export function loadBackgroundChoice(): { id: string; kind: "video" | "image" } | null {
  try {
    const raw = localStorage.getItem(BG_KEY);
    return raw ? (JSON.parse(raw) as { id: string; kind: "video" | "image" }) : null;
  } catch {
    return null;
  }
}

export function saveBackgroundChoice(bg: { id: string; kind: "video" | "image" } | null) {
  try {
    if (bg) localStorage.setItem(BG_KEY, JSON.stringify(bg));
    else localStorage.removeItem(BG_KEY);
  } catch {
    /* ignore */
  }
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const loadCalibration = (id: string) => loadJson(`letrasvida.live.cal.${id}`, DEFAULT_CAL);
export const saveCalibration = (id: string, cal: Calibration) => saveJson(`letrasvida.live.cal.${id}`, cal);

const LAYOUT_KEY = "letrasvida.live.layout";
export const loadLayout = () => loadJson(LAYOUT_KEY, DEFAULT_LAYOUT);
export const saveLayout = (layout: LiveLayout) => saveJson(LAYOUT_KEY, layout);
