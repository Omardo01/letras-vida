import { REF_H, REF_W, type Design } from "./design";
import type { Slide } from "./slides";

// ── Tiempos de la animación (los de la muestra aprobada) ──
export const IN_SECONDS = 0.55;
export const OUT_SECONDS = 0.45;

// ── Geometría fija (unidades de referencia) ──
/** Borde superior de la caja: justo debajo del logo y la píldora. */
export const BOX_TOP = 142;
/** Margen interior mínimo a los lados del texto. */
export const BOX_PAD = 70;

export interface AnimState {
  /** Segundos desde el inicio del clip. */
  t: number;
  /** Segundos en que empieza la salida; Infinity = sin salida. */
  outStart: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp01(x)));
const easeInQuad = (x: number) => clamp01(x) ** 2;
const easeInCubic = (x: number) => clamp01(x) ** 3;
/** Resorte subamortiguado (stiffness 170, damping 14, mass 0.7), forma cerrada. */
function spring(t: number): number {
  if (t <= 0) return 0;
  const omega = Math.sqrt(170 / 0.7);
  const zeta = 14 / (2 * Math.sqrt(170 * 0.7));
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t));
}

const logoCache = new Map<string, Promise<HTMLImageElement | null>>();

export function loadLogo(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  let p = logoCache.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    logoCache.set(src, p);
  }
  return p;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (ctx.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = w;
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Reparte el texto en `n` líneas de largo parecido (programación dinámica),
 * con preferencia por cortar después de coma, punto o punto y coma, como se
 * haría a mano. Cada línea respeta `maxWidth`.
 */
function balancedWrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, n: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const m = words.length;
  if (m <= n) return words;
  const space = ctx.measureText(" ").width;
  const ww = words.map((w) => ctx.measureText(w).width);
  const lineWidth = (i: number, j: number) => ww.slice(i, j).reduce((a, b) => a + b, 0) + space * (j - i - 1); // palabras [i, j)
  const target = (lineWidth(0, m) - space * (n - 1)) / n;
  const bonus = (0.22 * maxWidth) ** 2;
  // dp[k][i] = mejor costo para poner las palabras [i, m) en k líneas
  const INF = Number.POSITIVE_INFINITY;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(INF));
  const next: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(-1));
  dp[0][m] = 0;
  for (let k = 1; k <= n; k++) {
    for (let i = m - 1; i >= 0; i--) {
      for (let j = i + 1; j <= m; j++) {
        const w = lineWidth(i, j);
        if (w > maxWidth) break;
        const rest = dp[k - 1][j];
        if (rest === INF) continue;
        const last = k === 1;
        let cost = (w - target) ** 2;
        if (!last && /[,.;:!?]$/.test(words[j - 1])) cost -= bonus;
        if (cost + rest < dp[k][i]) {
          dp[k][i] = cost + rest;
          next[k][i] = j;
        }
      }
    }
  }
  if (dp[n][0] === INF) return wrap(ctx, text, maxWidth);
  const lines: string[] = [];
  for (let k = n, i = 0; k >= 1; k--) {
    const j = next[k][i];
    lines.push(words.slice(i, j).join(" "));
    i = j;
  }
  return lines;
}

/** Elige el mayor tamaño de fuente con el que el texto cabe en la caja y equilibra las líneas. */
export function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  design: Design,
  S: number,
  innerW: number,
  innerH: number,
  maxFontSize = design.maxFontSize,
): { fontSize: number; lines: string[]; lineHeight: number } {
  const maxSize = Math.max(maxFontSize, design.minFontSize);
  const attempt = (size: number) => {
    const fontSize = size * S;
    ctx.font = `700 ${fontSize}px "${design.fontFamily}", sans-serif`;
    const lines = wrap(ctx, text, innerW);
    const lineHeight = fontSize * 1.45;
    const fits = lines.length * lineHeight <= innerH && lines.every((l) => ctx.measureText(l).width <= innerW);
    return { fontSize, lines, lineHeight, fits };
  };
  let result = attempt(maxSize);
  for (let size = maxSize - 1; !result.fits && size >= design.minFontSize; size -= 1) {
    result = attempt(size);
  }
  ctx.font = `700 ${result.fontSize}px "${design.fontFamily}", sans-serif`;
  const lines = result.lines.length > 1 && !text.includes("\n") ? balancedWrap(ctx, text, innerW, result.lines.length) : result.lines;
  return { fontSize: result.fontSize, lines, lineHeight: result.lineHeight };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Dibuja un slide completo en el canvas. Con `anim` aplica la entrada/salida;
 * sin él, el estado final (para el PNG y la vista previa).
 */
export function drawSlide(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  design: Design,
  slide: Slide,
  logo: HTMLImageElement | null,
  anim?: AnimState,
) {
  const S = W / REF_W;
  const offY = (H - REF_H * S) / 2; // centra el diseño si la pantalla no es 3.55:1
  const t = anim?.t ?? 10;
  const o = anim ? Math.max(0, t - anim.outStart) : 0;

  const logoIn = easeOutCubic(t / 0.35);
  const pillDrop = anim ? spring(t) : 1;
  const boxIn = easeOutExpo((t - 0.1) / 0.45);
  const textOut = 1 - easeInQuad(o / 0.2);
  const boxOut = 1 - easeInCubic((o - 0.08) / 0.32);
  const pillOut = 1 - easeInCubic((o - 0.12) / 0.3);
  const logoOut = 1 - clamp01((o - 0.1) / 0.3);

  ctx.save();
  ctx.clearRect(0, 0, W, H);
  if (design.background !== "transparent") {
    ctx.fillStyle = design.background;
    ctx.fillRect(0, 0, W, H);
  }

  // Logo
  if (design.showLogo && logo) {
    const w = 186 * S * design.logoScale;
    const h = (w * logo.naturalHeight) / logo.naturalWidth;
    ctx.globalAlpha = logoIn * logoOut;
    ctx.drawImage(logo, 12 * S + (1 - logoIn) * -30 * S, offY + 10 * S, w, h);
    ctx.globalAlpha = 1;
  }

  // Píldora
  if (slide.label) {
    const ph = 70 * S;
    const scale = 0.9 + 0.1 * pillDrop;
    const dy = (-90 * (1 - pillDrop) - 70 * (1 - pillOut)) * S;
    ctx.save();
    ctx.globalAlpha = clamp01(pillDrop * 1.6) * pillOut;
    ctx.translate(W / 2, offY + 34 * S + ph / 2 + dy);
    ctx.scale(scale, scale);
    ctx.font = `700 ${design.pillFontSize * S}px "${design.fontFamily}", sans-serif`;
    const width = Math.max(520 * S, ctx.measureText(slide.label).width + 96 * S);
    ctx.fillStyle = design.pillColor;
    roundRect(ctx, -width / 2, -ph / 2, width, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = design.pillTextColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(slide.label, 0, ph * 0.04);
    ctx.restore();
  }

  // Caja
  const bw = design.boxWidth * S;
  const bh = design.boxHeight * S;
  const bx = (W - bw) / 2;
  const by = offY + BOX_TOP * S;
  ctx.save();
  ctx.globalAlpha = boxIn * boxOut;
  ctx.translate(bx, by);
  ctx.scale(1, 0.55 + 0.45 * boxIn * (0.6 + 0.4 * boxOut));
  ctx.fillStyle = design.boxColor;
  roundRect(ctx, 0, 0, bw, bh, design.boxRadius * S);
  ctx.fill();

  // Texto
  const pad = BOX_PAD * S;
  const innerW = Math.min(bw - 2 * pad, design.textMaxWidth * S);
  const { fontSize, lines, lineHeight } = fitText(
    ctx,
    slide.error ? `⚠ ${slide.error}` : slide.text,
    design,
    S,
    innerW,
    bh - 56 * S,
    slide.fontSize ?? (slide.kind === "title" ? design.titleFontSize : design.maxFontSize),
  );
  ctx.font = `700 ${fontSize}px "${design.fontFamily}", sans-serif`;
  ctx.fillStyle = design.textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const startY = bh / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    const lineIn = anim ? easeOutCubic((t - 0.28 - i * 0.06) / 0.34) : 1;
    ctx.globalAlpha = boxIn * boxOut * lineIn * textOut;
    ctx.fillText(line, bw / 2, startY + i * lineHeight + (1 - lineIn) * 26 * S - (1 - textOut) * 16 * S);
  });
  ctx.restore();
  ctx.restore();
}

export function renderPng(slide: Slide, design: Design, logo: HTMLImageElement | null, W: number, H: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  drawSlide(ctx, W, H, design, slide, logo);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob falló"))), "image/png"));
}

const PATTERN_COLORS = ["#22d3ee", "#fbbf24", "#f472b6", "#a3e635"];

/**
 * Carta de ajuste sobre la composición completa (W×H, `of` tramos). Con todo
 * bien calibrado los cuadros son cuadrados, los círculos redondos y las
 * diagonales cruzan la unión sin escalón.
 */
export function drawPattern(ctx: CanvasRenderingContext2D, W: number, H: number, of: number, fontFamily: string) {
  const tw = W / of;
  const lw = Math.max(1, H / 360);
  ctx.save();
  ctx.fillStyle = "#101014";
  ctx.fillRect(0, 0, W, H);

  // Cuadrícula de cuadros, simétrica respecto al centro.
  const cell = H / 8;
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (let x = W / 2 - Math.ceil(W / 2 / cell) * cell; x <= W; x += cell) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = 0; y <= H + 0.5; y += cell) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();

  // Diagonales y centro de toda la composición: si hay escalón en la unión, se nota aquí.
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = lw * 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, H);
  ctx.moveTo(0, H);
  ctx.lineTo(W, 0);
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();

  // Círculo sobre cada unión: las dos mitades deben formar un círculo.
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = lw * 3;
  for (let i = 1; i < of; i++) {
    ctx.beginPath();
    ctx.arc(i * tw, H / 2, H * 0.3, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = 0; i < of; i++) {
    const color = PATTERN_COLORS[i % PATTERN_COLORS.length];
    const x0 = i * tw;
    // Marco del tramo: debe verse completo, pegado a los bordes del monitor.
    ctx.strokeStyle = color;
    ctx.lineWidth = lw * 6;
    ctx.strokeRect(x0 + lw * 3, lw * 3, tw - lw * 6, H - lw * 6);
    // Círculo grande: redondo = proporción correcta.
    ctx.lineWidth = lw * 3;
    ctx.beginPath();
    ctx.arc(x0 + tw / 2, H / 2, H * 0.4, 0, Math.PI * 2);
    ctx.stroke();
    // Número y tamaño.
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${H * 0.22}px "${fontFamily}", sans-serif`;
    ctx.fillText(String(i + 1), x0 + tw / 2, H / 2 - H * 0.02);
    ctx.font = `600 ${H * 0.035}px "${fontFamily}", sans-serif`;
    ctx.fillText(of > 1 ? `Tramo ${i + 1} de ${of}` : "Pantalla única", x0 + tw / 2, H / 2 + H * 0.15);
  }

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `600 ${H * 0.03}px "${fontFamily}", sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("Los círculos deben verse redondos, los cuadros cuadrados y las líneas seguir rectas al cruzar la unión", W / 2, H * 0.93);
  ctx.restore();
}
