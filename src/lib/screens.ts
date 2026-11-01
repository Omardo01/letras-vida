import type { Split } from "./live";

/*
 * Monitores conectados vía Window Management API (Chrome/Edge). Con el permiso
 * "Administración de ventanas" el control sabe qué pantallas hay, abre cada
 * salida directamente en la suya y la pone a pantalla completa ahí mismo.
 */

interface ScreenDetailed extends Screen {
  readonly left: number;
  readonly top: number;
  readonly availLeft: number;
  readonly availTop: number;
  readonly isPrimary: boolean;
  readonly isInternal: boolean;
  readonly devicePixelRatio: number;
  readonly label: string;
}

interface ScreenDetails extends EventTarget {
  readonly screens: readonly ScreenDetailed[];
  readonly currentScreen: ScreenDetailed;
}

declare global {
  interface Window {
    getScreenDetails?: () => Promise<ScreenDetails>;
  }
  interface FullscreenOptions {
    /** Window Management API: pantalla en la que se pone a pantalla completa. */
    screen?: Screen;
  }
}

/** Un monitor tal como lo ve el control (coordenadas globales en píxeles CSS). */
export interface DetectedScreen {
  /** Identidad estable mientras no se reacomoden los monitores. */
  key: string;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Píxeles reales (lo que manda la tarjeta de video). */
  pixelWidth: number;
  pixelHeight: number;
  isPrimary: boolean;
  isInternal: boolean;
  /** Es la pantalla donde está la ventana de control. */
  isCurrent: boolean;
}

export const screensSupported = () => typeof window !== "undefined" && typeof window.getScreenDetails === "function";

export type WindowManagementState = "granted" | "prompt" | "denied" | "unsupported";

export async function windowManagementState(): Promise<WindowManagementState> {
  if (!screensSupported()) return "unsupported";
  try {
    const s = await navigator.permissions.query({ name: "window-management" as PermissionName });
    return s.state;
  } catch {
    return "prompt";
  }
}

/**
 * ¿Puede esta página ponerse a pantalla completa sin un clic? Solo si el
 * navegador lo permite por política (AutomaticFullscreenAllowedForUrls).
 */
export async function autoFullscreenAllowed(): Promise<boolean> {
  try {
    const s = await navigator.permissions.query({ name: "fullscreen" as PermissionName, allowWithoutGesture: true } as PermissionDescriptor);
    return s.state === "granted";
  } catch {
    return false;
  }
}

export const screenKey = (s: { label: string; left: number; top: number; width: number; height: number }) => `${s.label}|${s.left},${s.top}|${s.width}x${s.height}`;

function toDetected(s: ScreenDetailed, current: ScreenDetailed): DetectedScreen {
  const dpr = s.devicePixelRatio || 1;
  return {
    key: screenKey(s),
    label: s.label || (s.isInternal ? "Pantalla integrada" : "Monitor"),
    left: s.left,
    top: s.top,
    width: s.width,
    height: s.height,
    pixelWidth: Math.round(s.width * dpr),
    pixelHeight: Math.round(s.height * dpr),
    isPrimary: s.isPrimary,
    isInternal: s.isInternal,
    isCurrent: s === current,
  };
}

/** De izquierda a derecha (y de arriba abajo si están apilados), como se acomodaron en el sistema. */
export const byPosition = (a: { left: number; top: number }, b: { left: number; top: number }) => a.left - b.left || a.top - b.top;

/**
 * Pide (la primera vez) el permiso y devuelve los monitores. `onChange` se
 * llama cuando se conecta o desconecta uno, o la ventana cambia de monitor.
 */
export async function watchScreens(onChange: (screens: DetectedScreen[]) => void): Promise<() => void> {
  const details = await window.getScreenDetails!();
  const emit = () => onChange(details.screens.map((s) => toDetected(s, details.currentScreen)).sort(byPosition));
  emit();
  details.addEventListener("screenschange", emit);
  details.addEventListener("currentscreenchange", emit);
  return () => {
    details.removeEventListener("screenschange", emit);
    details.removeEventListener("currentscreenchange", emit);
  };
}

/** Busca, desde una ventana de salida, el monitor que le tocó (por su esquina). */
export async function findScreen(left: number, top: number): Promise<Screen | null> {
  if (!screensSupported() || (await windowManagementState()) !== "granted") return null;
  try {
    const details = await window.getScreenDetails!();
    return details.screens.find((s) => s.left === left && s.top === top) ?? null;
  } catch {
    return null;
  }
}

export type LaunchMode = "joined" | "mirror";

export interface PlannedOutput {
  screen: DetectedScreen;
  split: Split;
}

/**
 * Qué muestra cada monitor elegido: unidas = cada uno un tramo de la imagen
 * ancha, en el orden de `selected` (el primero es el izquierdo); espejo = la
 * imagen completa en cada uno.
 */
export function planOutputs(screens: DetectedScreen[], selected: string[], mode: LaunchMode): PlannedOutput[] {
  const chosen = selected.map((k) => screens.find((s) => s.key === k)).filter((s): s is DetectedScreen => Boolean(s));
  const of = mode === "joined" ? chosen.length : 1;
  return chosen.map((screen, i) => ({ screen, split: { part: mode === "joined" ? i + 1 : 1, of } }));
}

/** Los monitores elegidos, en el orden en que están acomodados (al marcar o desmarcar uno). */
export const inPositionOrder = (screens: DetectedScreen[], keys: string[]) => screens.filter((s) => keys.includes(s.key)).sort(byPosition).map((s) => s.key);

/**
 * La configuración guardada aplicada a los monitores de ahora. Si un monitor
 * cambió de identidad (Windows lo reacomodó al apagar y prender la tele), se
 * busca otro con el mismo nombre y tamaño que no sea el del control.
 */
export function resolvePlan(screens: DetectedScreen[], plan: ScreenPlan): { outputs: PlannedOutput[]; missing: number } {
  const used = new Set<string>();
  const keys = plan.selected.map((k) => {
    const [label, , size] = k.split("|");
    const s = screens.find((x) => x.key === k && !used.has(x.key)) ?? screens.find((x) => !used.has(x.key) && !x.isCurrent && !plan.selected.includes(x.key) && x.label === label && `${x.width}x${x.height}` === size);
    if (s) used.add(s.key);
    return s?.key;
  });
  const found = keys.filter((k): k is string => Boolean(k));
  return { outputs: planOutputs(screens, found, plan.mode), missing: keys.length - found.length };
}

/** Si todos los monitores elegidos tienen la misma proporción, esa; si no, null. */
export function commonAspect(screens: { width: number; height: number }[]): number | null {
  if (!screens.length) return null;
  const a = screens[0].width / screens[0].height;
  return screens.every((s) => Math.abs(s.width / s.height - a) / a < 0.01) ? a : null;
}

/** La configuración de pantallas (como en ProPresenter): se hace una vez y se recuerda. */
export interface ScreenPlan {
  /** Monitores de salida; en «unidas», en orden de izquierda a derecha. */
  selected: string[];
  mode: LaunchMode;
  /** Encender las pantallas en cuanto se abre el control. */
  autoStart?: boolean;
}

const PLAN_KEY = "letrasvida.live.screen-plan";

export function loadScreenPlan(): ScreenPlan | null {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    return raw ? (JSON.parse(raw) as ScreenPlan) : null;
  } catch {
    return null;
  }
}

export function saveScreenPlan(plan: ScreenPlan) {
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  } catch {
    /* ignore */
  }
}

/**
 * Políticas de Chrome para la PC de salida (Windows): dejan a este sitio ver
 * los monitores, abrir varias ventanas de un clic y ponerlas a pantalla
 * completa sin tocar cada tele. Es lo que acerca el navegador a ProPresenter.
 */
export const CHROME_POLICIES = ["WindowManagementAllowedForUrls", "PopupsAllowedForUrls", "AutomaticFullscreenAllowedForUrls"] as const;

/** Archivo .reg (UTF-16 con BOM, como lo exporta regedit) con las políticas para `origin`. */
export function chromePolicyReg(origin: string): Blob {
  const lines = ["Windows Registry Editor Version 5.00", ""];
  for (const p of CHROME_POLICIES) lines.push(`[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome\\${p}]`, `"1"="${origin}"`, "");
  const text = lines.join("\r\n");
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    bytes[2 + i * 2] = c & 0xff;
    bytes[3 + i * 2] = c >> 8;
  }
  return new Blob([bytes], { type: "application/octet-stream" });
}

/** Selección inicial: la recordada si esos monitores siguen ahí; si no, todos menos el del control. */
export function defaultSelection(screens: DetectedScreen[], plan: ScreenPlan | null): string[] {
  const remembered = plan?.selected.filter((k) => screens.some((s) => s.key === k)) ?? [];
  if (remembered.length) return remembered;
  return screens.filter((s) => !s.isCurrent).map((s) => s.key);
}
