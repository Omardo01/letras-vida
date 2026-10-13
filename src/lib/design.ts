/** Plantilla visual. Las medidas van en "unidades de referencia" (lienzo 2000×563) y se escalan al tamaño real. */
export interface Design {
  background: string; // color o "transparent"
  pillColor: string;
  pillTextColor: string;
  boxColor: string;
  textColor: string;
  fontFamily: string;
  /** Tamaño máximo/mínimo del texto del versículo, en unidades de referencia. */
  maxFontSize: number;
  minFontSize: number;
  /** Tamaño máximo de los slides de título (unidades de referencia). */
  titleFontSize: number;
  pillFontSize: number;
  boxRadius: number;
  boxHeight: number;
  boxWidth: number;
  /** Ancho máximo del bloque de texto dentro de la caja (unidades de referencia). */
  textMaxWidth: number;
  logo: string | null; // dataURL o ruta
  showLogo: boolean;
  logoScale: number;
  /** Versión de las medidas por defecto con que se guardó (ver LAYOUT_VERSION). */
  layoutVersion: number;
}

export const REF_W = 2000;
export const REF_H = 563;

/**
 * Sube cuando cambian las medidas por defecto. Un diseño guardado con otra
 * versión conserva colores, fuente y logo, pero toma las medidas nuevas.
 * v3: caja y texto más grandes que la referencia original (v2 fue un paso intermedio).
 */
export const LAYOUT_VERSION = 3;
const LAYOUT_KEYS = ["maxFontSize", "minFontSize", "titleFontSize", "pillFontSize", "boxHeight", "boxWidth", "textMaxWidth"] as const;

export const DEFAULT_DESIGN: Design = {
  background: "#ffffff",
  pillColor: "#03acdb",
  pillTextColor: "#ffffff",
  boxColor: "#1178bc",
  textColor: "#ffffff",
  fontFamily: "Open Sans",
  maxFontSize: 48,
  minFontSize: 26,
  titleFontSize: 78,
  pillFontSize: 38,
  boxRadius: 22,
  boxHeight: 388,
  boxWidth: 1860,
  textMaxWidth: 1560,
  logo: `${import.meta.env.BASE_URL}logo.png`,
  showLogo: true,
  logoScale: 1,
  layoutVersion: LAYOUT_VERSION,
};

/** Diseños predeterminados: cambian colores, fuente y fondo; el logo se conserva. */
export const PRESETS: { name: string; values: Partial<Design> }[] = [
  { name: "Original", values: { background: "#ffffff", pillColor: "#03acdb", pillTextColor: "#ffffff", boxColor: "#1178bc", textColor: "#ffffff", fontFamily: "Open Sans", boxRadius: 22 } },
  { name: "Oscuro", values: { background: "#0b1220", pillColor: "#38bdf8", pillTextColor: "#0b1220", boxColor: "#1e293b", textColor: "#f8fafc", fontFamily: "Open Sans", boxRadius: 22 } },
  { name: "Dorado", values: { background: "#0f0a05", pillColor: "#d4a017", pillTextColor: "#1a1206", boxColor: "#1f1608", textColor: "#fdf3d8", fontFamily: "Montserrat", boxRadius: 16 } },
  { name: "Claro", values: { background: "#ffffff", pillColor: "#1178bc", pillTextColor: "#ffffff", boxColor: "#eef3f9", textColor: "#12203a", fontFamily: "Open Sans", boxRadius: 22 } },
  { name: "Moderno", values: { background: "#ffffff", pillColor: "#111827", pillTextColor: "#ffffff", boxColor: "#4f46e5", textColor: "#ffffff", fontFamily: "Poppins", boxRadius: 40 } },
  { name: "Transparente", values: { background: "transparent", pillColor: "#03acdb", pillTextColor: "#ffffff", boxColor: "#1178bc", textColor: "#ffffff", fontFamily: "Open Sans", boxRadius: 22 } },
];

/** Todas vienen en public/fonts (Bold, latin), así que funcionan sin internet. */
export const FONTS = [
  { name: "Open Sans", local: true },
  { name: "Montserrat", local: true },
  { name: "Poppins", local: true },
  { name: "Inter", local: true },
  { name: "Roboto", local: true },
] as { name: string; local: boolean; google?: string }[];

const loadedFonts = new Set<string>();

/** Carga la fuente elegida (Open Sans va incluida; las demás desde Google Fonts si hay red). */
export async function ensureFont(family: string): Promise<void> {
  const font = FONTS.find((f) => f.name === family);
  if (font?.google && !loadedFonts.has(family)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
    document.head.appendChild(link);
    loadedFonts.add(family);
  }
  try {
    await document.fonts.load(`700 40px "${family}"`);
  } catch {
    /* sin red: el navegador usará la fuente de respaldo */
  }
}

export const DESIGN_KEY = "versiculos.design.v1";
const KEY = DESIGN_KEY;

/** Completa un diseño guardado (o recibido en vivo) y lo lleva a las medidas actuales. */
export function normalizeDesign(saved: Partial<Design>): Design {
  const d: Design = { ...DEFAULT_DESIGN, ...saved };
  if (saved.layoutVersion !== LAYOUT_VERSION) {
    for (const k of LAYOUT_KEYS) d[k] = DEFAULT_DESIGN[k];
    d.layoutVersion = LAYOUT_VERSION;
  }
  return d;
}

export function loadDesign(): Design {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalizeDesign(JSON.parse(raw) as Partial<Design>);
  } catch {
    /* localStorage no disponible */
  }
  return DEFAULT_DESIGN;
}

export function saveDesign(d: Design) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* sin espacio (p. ej. logo enorme) — la sesión sigue funcionando */
  }
}
