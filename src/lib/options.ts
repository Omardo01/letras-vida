import type { VersionAbbr } from "./bible";
import type { VideoMode } from "./video";

export interface Size {
  w: number;
  h: number;
}

export interface Options {
  versions: VersionAbbr[];
  maxChars: number;
  verseNumbers: boolean;
  pngSize: number;
  pngCustom: Size;
  video: "none" | VideoMode;
  videoSize: number;
  videoCustom: Size;
  fps: 30 | 60;
  hold: number;
}

export const OPTS_KEY = "versiculos.options.v1";
export const TEXT_KEY = "versiculos.text.v1";

/** v2: la caja para dos teles aguanta más texto; el máximo de letras que venía por defecto (220) sube con ella. */
const OPTS_VERSION = 2;

export const DEFAULT_OPTS: Options = {
  versions: ["RVR1960"],
  maxChars: 320,
  verseNumbers: true,
  pngSize: 0,
  pngCustom: { w: 7680, h: 2160 },
  video: "in-hold",
  videoSize: 0,
  videoCustom: { w: 3840, h: 1080 },
  fps: 60,
  hold: 3,
};

export function loadOptions(): Options {
  try {
    const raw = localStorage.getItem(OPTS_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Options> & { v?: number };
      const opts = { ...DEFAULT_OPTS, ...saved };
      if (saved.v !== OPTS_VERSION && saved.maxChars === 220) opts.maxChars = DEFAULT_OPTS.maxChars;
      return opts;
    }
  } catch {
    /* sin localStorage */
  }
  return DEFAULT_OPTS;
}

export function saveOptions(opts: Options) {
  try {
    localStorage.setItem(OPTS_KEY, JSON.stringify({ ...opts, v: OPTS_VERSION }));
  } catch {
    /* ignore */
  }
}

/** Las citas pegadas en la página principal, para que el control en vivo las tenga a mano. */
export function loadText(): string {
  try {
    return localStorage.getItem(TEXT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveText(text: string) {
  try {
    localStorage.setItem(TEXT_KEY, text);
  } catch {
    /* ignore */
  }
}
