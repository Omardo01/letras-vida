import { describe, expect, it } from "vitest";
import { chromePolicyReg, commonAspect, defaultSelection, inPositionOrder, planOutputs, resolvePlan, type DetectedScreen } from "./screens";

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
  it("unidas: tramos en el orden configurado (el primero es el izquierdo)", () => {
    const plan = planOutputs([laptop, tvLeft, tvRight], ["tv-der", "tv-izq"], "joined");
    expect(plan.map((p) => [p.screen.key, p.split])).toEqual([
      ["tv-der", { part: 1, of: 2 }],
      ["tv-izq", { part: 2, of: 2 }],
    ]);
  });

  it("al marcar monitores el orden es el del acomodo", () => {
    expect(inPositionOrder([laptop, tvLeft, tvRight], ["tv-der", "tv-izq"])).toEqual(["tv-izq", "tv-der"]);
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

describe("resolvePlan", () => {
  const tv = (left: number) => screen(`SAMSUNG|${left},0|1920x1080`, left, { label: "SAMSUNG" });

  it("usa los monitores guardados tal cual", () => {
    const [a, b] = [tv(1512), tv(3432)];
    const { outputs, missing } = resolvePlan([laptop, a, b], { selected: [a.key, b.key], mode: "joined" });
    expect(missing).toBe(0);
    expect(outputs.map((p) => p.screen.key)).toEqual([a.key, b.key]);
  });

  it("si Windows reacomodó las teles, las encuentra por nombre y tamaño", () => {
    const saved = [tv(1512).key, tv(3432).key];
    const [a, b] = [tv(1920), tv(3840)];
    const { outputs, missing } = resolvePlan([laptop, a, b], { selected: saved, mode: "joined" });
    expect(missing).toBe(0);
    expect(outputs.map((p) => [p.screen.key, p.split.part])).toEqual([
      [a.key, 1],
      [b.key, 2],
    ]);
    expect(resolvePlan([laptop, a, b], { selected: saved, mode: "joined" }).remap).toEqual([
      [saved[0], a.key],
      [saved[1], b.key],
    ]);
  });

  it("sin cambios no hay nada que pasar a otra identidad", () => {
    const [a, b] = [tv(1512), tv(3432)];
    expect(resolvePlan([laptop, a, b], { selected: [a.key, b.key], mode: "joined" }).remap).toEqual([]);
  });

  it("si el adaptador cambió la resolución de una tele, la encuentra por nombre sin moverle la otra", () => {
    const a = tv(1512);
    const b = screen("SAMSUNG|3432,0|1280x720", 3432, { label: "SAMSUNG", width: 1280, height: 720 });
    const savedB = tv(3432).key;
    const { outputs, missing, remap } = resolvePlan([laptop, a, b], { selected: [a.key, savedB], mode: "joined" });
    expect(missing).toBe(0);
    expect(outputs.map((p) => p.screen.key)).toEqual([a.key, b.key]);
    expect(remap).toEqual([[savedB, b.key]]);
  });

  it("nunca toma el monitor del control como tele", () => {
    const control = screen("SAMSUNG|0,0|1920x1080", 0, { label: "SAMSUNG", isCurrent: true });
    expect(resolvePlan([control], { selected: [tv(1920).key], mode: "joined" }).missing).toBe(1);
  });

  it("cuenta las que faltan (tele apagada)", () => {
    const [a, b] = [tv(1512), tv(3432)];
    expect(resolvePlan([laptop, a], { selected: [a.key, b.key], mode: "joined" }).missing).toBe(1);
  });
});

describe("chromePolicyReg", () => {
  it("archivo .reg en UTF-16 con las tres políticas para el sitio", async () => {
    const bytes = new Uint8Array(await chromePolicyReg("https://letrasvida.vercel.app").arrayBuffer());
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xfe]);
    const text = new TextDecoder("utf-16le").decode(bytes.slice(2));
    expect(text.startsWith("Windows Registry Editor Version 5.00\r\n")).toBe(true);
    expect(text).toContain("[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome\\AutomaticFullscreenAllowedForUrls]\r\n\"1\"=\"https://letrasvida.vercel.app\"");
    expect(text).toContain("PopupsAllowedForUrls");
    expect(text).toContain("WindowManagementAllowedForUrls");
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
