import { describe, expect, it } from "vitest";
import { DEFAULT_CAL, DEFAULT_LAYOUT, tramoAspect, tramoRect } from "./live";

const half = (part: number) => ({ part, of: 2 });

describe("tramoRect", () => {
  it("16:9 en una pantalla 16:9 la llena", () => {
    expect(tramoRect(1920, 1080, half(1), DEFAULT_LAYOUT, DEFAULT_CAL)).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
  });

  it("una pantalla 16:10 encaja el tramo 16:9 con bandas arriba y abajo", () => {
    const r = tramoRect(1920, 1200, half(2), DEFAULT_LAYOUT, DEFAULT_CAL);
    expect(r).toEqual({ x: 0, y: 60, w: 1920, h: 1080 });
  });

  it("llenar recorta y estirar deforma", () => {
    const cover = tramoRect(1920, 1200, half(2), DEFAULT_LAYOUT, { ...DEFAULT_CAL, fit: "cover" });
    expect(cover.h).toBe(1200);
    expect(cover.w).toBeCloseTo(2133.33, 1);
    expect(tramoRect(1920, 1200, half(2), DEFAULT_LAYOUT, { ...DEFAULT_CAL, fit: "stretch" })).toEqual({ x: 0, y: 0, w: 1920, h: 1200 });
  });

  it("tamaño, ancho/alto y desplazamiento compensan el overscan", () => {
    const r = tramoRect(1920, 1080, half(1), DEFAULT_LAYOUT, { ...DEFAULT_CAL, zoom: 0.95, sx: 1.02, dx: 0.01, dy: -0.01 });
    expect(r.w).toBeCloseTo(1920 * 0.95 * 1.02);
    expect(r.h).toBeCloseTo(1080 * 0.95);
    expect(r.x).toBeCloseTo((1920 - r.w) / 2 + 19.2);
    expect(r.y).toBeCloseTo((1080 - r.h) / 2 - 10.8);
  });

  it("una ventana sola conserva su propia proporción", () => {
    expect(tramoAspect(7680, 2160, { part: 1, of: 1 }, DEFAULT_LAYOUT)).toBeCloseTo(7680 / 2160);
    expect(tramoRect(7680, 2160, { part: 1, of: 1 }, DEFAULT_LAYOUT, DEFAULT_CAL)).toEqual({ x: 0, y: 0, w: 7680, h: 2160 });
  });
});
