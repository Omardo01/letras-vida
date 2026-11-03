import { REF_H, REF_W, type Design } from "./design";
import type { Slide } from "./slides";

// ── Tiempos de la animación (los de la muestra aprobada) ──
export const IN_SECONDS = 0.55;
export const OUT_SECONDS = 0.45;

// ── Geometría fija (unidades de referencia) ──
/** Borde superior de la caja: justo debajo de la franja del logo y la píldora. */
export const BOX_TOP = 122;
/** Margen interior mínimo a los lados del texto. */
export const BOX_PAD = 70;
/** Franja de arriba: centro vertical del logo y la píldora. */
const HEADER_MID = 62;
const LOGO_H = 84;
const PILL_H = 70;
/** Distancia mínima de logo y píldora al borde de la pantalla. */
const EDGE = 24;
/** Interlineado (× tamaño de letra): más apretado que el de un párrafo para que quepan letras grandes. */
const LINE_HEIGHT = 1.3;

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
    const lineHeight = fontSize * LINE_HEIGHT;
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

function rgb(color: string): number[] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (!m) return null;
  const hex = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/** Aclara (amount > 0) u oscurece (amount < 0) un color #rgb/#rrggbb; otro formato se devuelve igual. */
function shade(color: string, amount: number): string {
  const ch = rgb(color);
  if (!ch) return color;
  const target = amount > 0 ? 255 : 0;
  const a = Math.abs(amount);
  return `rgb(${ch.map((c) => Math.round(c * (1 - a) + target * a)).join(",")})`;
}

/** Luminosidad aproximada 0–1 (0.4 si el color no es hex). */
function luminance(color: string): number {
  const ch = rgb(color);
  return ch ? (0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]) / 255 : 0.4;
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
  // Las sombras no siguen la transformación del canvas: se escalan a mano (la salida en vivo dibuja ya escalada por dpr).
  const px = Math.hypot(ctx.getTransform().c, ctx.getTransform().d) || 1;
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

  // La caja manda: logo y píldora se alinean con sus bordes (sin pegarse a la orilla de la pantalla).
  const bw = design.boxWidth * S;
  const bh = design.boxHeight * S;
  const bx = (W - bw) / 2;
  const by = offY + BOX_TOP * S;
  const left = Math.max(bx, EDGE * S);
  const right = Math.min(bx + bw, W - EDGE * S);

  // Logo
  if (design.showLogo && logo) {
    const h = LOGO_H * S * design.logoScale;
    const w = (h * logo.naturalWidth) / logo.naturalHeight;
    ctx.globalAlpha = logoIn * logoOut;
    ctx.drawImage(logo, left + (1 - logoIn) * -30 * S, offY + HEADER_MID * S - h / 2, w, h);
    ctx.globalAlpha = 1;
  }

  // Píldora: a la derecha queda entera en la tele derecha; al centro la cruzaría la unión.
  if (slide.label) {
    const ph = PILL_H * S;
    const scale = 0.9 + 0.1 * pillDrop;
    const dy = (-90 * (1 - pillDrop) - 70 * (1 - pillOut)) * S;
    ctx.save();
    ctx.font = `700 ${design.pillFontSize * S}px "${design.fontFamily}", sans-serif`;
    const centered = design.pillAlign === "center";
    const width = Math.max((centered ? 520 : 300) * S, ctx.measureText(slide.label).width + 96 * S);
    ctx.globalAlpha = clamp01(pillDrop * 1.6) * pillOut;
    ctx.translate(centered ? W / 2 : right - width / 2, offY + HEADER_MID * S + dy);
    ctx.scale(scale, scale);
    ctx.shadowColor = "rgba(6, 40, 70, 0.22)";
    ctx.shadowBlur = 14 * S * px;
    ctx.shadowOffsetY = 4 * S * px;
    const pg = ctx.createLinearGradient(0, -ph / 2, 0, ph / 2);
    pg.addColorStop(0, shade(design.pillColor, 0.12));
    pg.addColorStop(1, design.pillColor);
    ctx.fillStyle = pg;
    roundRect(ctx, -width / 2, -ph / 2, width, ph, ph / 2);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = design.pillTextColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(slide.label, 0, ph * 0.04);
    ctx.restore();
  }

  // Caja: degradado vertical (nunca de lado a lado, que parecería una tele más clara que la otra) y sombra suave.
  ctx.save();
  ctx.globalAlpha = boxIn * boxOut;
  ctx.translate(bx, by);
  ctx.scale(1, 0.55 + 0.45 * boxIn * (0.6 + 0.4 * boxOut));
  const radius = design.boxRadius * S;
  ctx.save();
  ctx.shadowColor = "rgba(6, 40, 70, 0.28)";
  ctx.shadowBlur = 36 * S * px;
  ctx.shadowOffsetY = 10 * S * px;
  // Una caja clara apenas se oscurece abajo (si no, se ve gris); en una oscura el brillo casi no se pone (se vería lavada).
  const lum = luminance(design.boxColor);
  const bg = ctx.createLinearGradient(0, 0, 0, bh);
  bg.addColorStop(0, shade(design.boxColor, 0.1));
  bg.addColorStop(1, shade(design.boxColor, lum > 0.75 ? -0.04 : -0.14));
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, bw, bh, radius);
  ctx.fill();
  ctx.restore();
  // Brillo al centro de la caja, simétrico respecto a la unión.
  ctx.save();
  roundRect(ctx, 0, 0, bw, bh, radius);
  ctx.clip();
  ctx.translate(bw / 2, bh * 0.2);
  ctx.scale(bw / bh, 1);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, bh * 0.75);
  glow.addColorStop(0, `rgba(255,255,255,${0.14 * Math.min(1, Math.max(0.25, (lum - 0.1) / 0.3))})`);
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(-bh, -bh, 2 * bh, 2 * bh);
  ctx.restore();
  // Filo de luz arriba.
  ctx.save();
  roundRect(ctx, 0, 0, bw, bh, radius);
  ctx.clip();
  const rim = ctx.createLinearGradient(0, 0, 0, radius + 24 * S);
  rim.addColorStop(0, "rgba(255,255,255,0.3)");
  rim.addColorStop(1, "rgba(255,255,255,0)");
  ctx.strokeStyle = rim;
  ctx.lineWidth = 4 * S;
  ctx.stroke();
  ctx.restore();

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
  // Sombra solo bajo texto claro; bajo texto oscuro sería un halo borroso.
  if (luminance(design.textColor) > 0.5) {
    ctx.shadowColor = "rgba(0, 20, 45, 0.3)";
    ctx.shadowBlur = 10 * S * px;
    ctx.shadowOffsetY = 3 * S * px;
  }
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

let sheenCanvas: HTMLCanvasElement | null = null;

/**
 * Logo de reposo centrado en (cx, cy) con alto `h`. Con `t` (segundos desde
 * que apareció) entra con un rebote suave, queda respirando con un halo del
 * color de la píldora y cada 5 s lo cruza un brillo; sin `t`, quieto.
 */
export function drawLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement, cx: number, cy: number, h: number, design: Design, t?: number) {
  const w = (h * logo.naturalWidth) / logo.naturalHeight;
  if (t == null) {
    ctx.drawImage(logo, cx - w / 2, cy - h / 2, w, h);
    return;
  }
  const enter = easeOutCubic(t / 0.9);
  const settled = clamp01((t - 0.8) / 1.5); // la respiración arranca poco a poco al terminar la entrada
  const breathe = Math.sin((2 * Math.PI * t) / 6) * settled;
  const scale = (0.8 + 0.2 * spring(t * 0.85)) * (1 + 0.03 * breathe);
  const y = cy + (1 - enter) * h * 0.14 - Math.sin((2 * Math.PI * t) / 8) * settled * h * 0.025;
  const dw = w * scale;
  const dh = h * scale;

  ctx.save();
  ctx.globalAlpha = enter;
  const ch = rgb(design.pillColor) ?? [3, 172, 219];
  const halo = ctx.createRadialGradient(cx, y, 0, cx, y, dh * 1.15);
  halo.addColorStop(0, `rgba(${ch.join(",")},${0.3 + 0.08 * breathe})`);
  halo.addColorStop(1, `rgba(${ch.join(",")},0)`);
  ctx.fillStyle = halo;
  ctx.fillRect(cx - dh * 1.2, y - dh * 1.2, dh * 2.4, dh * 2.4);

  // Brillo: una franja diagonal recortada a la forma del logo (lienzo aparte, al tamaño real en píxeles).
  const s = ((t - 1.4) % 5) / 1.3;
  if (t < 1.4 || s > 1) {
    ctx.drawImage(logo, cx - dw / 2, y - dh / 2, dw, dh);
  } else {
    const m = ctx.getTransform();
    const ow = Math.max(1, Math.ceil(dw * Math.hypot(m.a, m.b)));
    const oh = Math.max(1, Math.ceil(dh * Math.hypot(m.c, m.d)));
    sheenCanvas ??= document.createElement("canvas");
    if (sheenCanvas.width !== ow || sheenCanvas.height !== oh) {
      sheenCanvas.width = ow;
      sheenCanvas.height = oh;
    }
    const o = sheenCanvas.getContext("2d")!;
    o.clearRect(0, 0, ow, oh);
    o.globalCompositeOperation = "source-over";
    o.drawImage(logo, 0, 0, ow, oh);
    o.globalCompositeOperation = "source-atop";
    const x = (-0.5 + 2 * s) * ow;
    const band = o.createLinearGradient(x, 0, x + ow * 0.45, oh);
    band.addColorStop(0, "rgba(255,255,255,0)");
    band.addColorStop(0.5, "rgba(255,255,255,0.75)");
    band.addColorStop(1, "rgba(255,255,255,0)");
    o.fillStyle = band;
    o.fillRect(0, 0, ow, oh);
    ctx.drawImage(sheenCanvas, cx - dw / 2, y - dh / 2, dw, dh);
  }
  ctx.restore();
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
