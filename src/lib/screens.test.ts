import { describe, expect, it } from "vitest";
import { commonAspect, defaultSelection, planOutputs, type DetectedScreen } from "./screens";

const screen = (key: string, left: number, extra: Partial<DetectedScreen> = {}): DetectedScreen => ({
  key,
  label: key,
  left,
  top: 0,
  width: 1920,
  height: 1080,
  pixelWidth: 3840,
  pixelHeight: 2160,
  isPrimary: false,
  isInternal: false,
  isCurrent: false,
  ...extra,
});

const laptop = screen("laptop", 0, { width: 1512, height: 982, isPrimary: true, isInternal: true, isCurrent: true });
const tvLeft = screen("tv-izq", 1512);
const tvRight = screen("tv-der", 3432);

describe("planOutputs", () => {
  it("unidas: tramos de izquierda a derecha según el acomodo, no según el orden de selección", () => {
    const plan = planOutputs([laptop, tvLeft, tvRight], ["tv-der", "tv-izq"], "joined");
    expect(plan.map((p) => [p.screen.key, p.split])).toEqual([
      ["tv-izq", { part: 1, of: 2 }],
      ["tv-der", { part: 2, of: 2 }],
    ]);
  });

  it("espejo: cada monitor muestra la imagen completa", () => {
    const plan = planOutputs([laptop, tvLeft, tvRight], ["tv-izq", "tv-der"], "mirror");
    expect(plan.map((p) => p.split)).toEqual([
      { part: 1, of: 1 },
      { part: 1, of: 1 },
    ]);
  });

  it("una sola pantalla elegida es pantalla única", () => {
    expect(planOutputs([laptop, tvLeft], ["tv-izq"], "joined")[0].split).toEqual({ part: 1, of: 1 });
  });
});

describe("defaultSelection", () => {
  it("sin nada recordado elige todo menos la pantalla del control", () => {
    expect(defaultSelection([laptop, tvLeft, tvRight], null)).toEqual(["tv-izq", "tv-der"]);
  });

  it("usa lo recordado si esos monitores siguen conectados", () => {
    expect(defaultSelection([laptop, tvLeft, tvRight], { selected: ["tv-der", "proyector-viejo"], mode: "joined" })).toEqual(["tv-der"]);
  });

  it("si lo recordado ya no está, vuelve al criterio por defecto", () => {
    expect(defaultSelection([laptop, tvLeft], { selected: ["proyector-viejo"], mode: "joined" })).toEqual(["tv-izq"]);
  });
});

describe("commonAspect", () => {
  it("misma proporción → esa proporción", () => {
    expect(commonAspect([tvLeft, tvRight])).toBeCloseTo(16 / 9);
  });

  it("proporciones distintas → null", () => {
    expect(commonAspect([tvLeft, laptop])).toBeNull();
  });
});
