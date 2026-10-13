import { describe, expect, it } from "vitest";
import { formatReference, parseMessage, type Reference } from "./references";

const refs = (text: string) => parseMessage(text).filter((i): i is Reference => i.kind === "reference");
const label = (text: string) => refs(text).map((r) => formatReference(r.bookName, r.ranges));

describe("parseMessage", () => {
  it("cita simple con dos puntos o punto", () => {
    expect(label("Juan 3:16")).toEqual(["Juan 3:16"]);
    expect(label("Jn 3.16")).toEqual(["Juan 3:16"]);
    expect(label("S. Juan 3:16")).toEqual(["Juan 3:16"]);
  });

  it("rangos, listas y varios capítulos del mismo libro", () => {
    expect(label("Mateo 5:3-6")).toEqual(["Mateo 5:3-6"]);
    expect(label("Mateo 5:3-6, 9")).toEqual(["Mateo 5:3-6,9"]);
    expect(label("Mateo 5:3-6; 6:1-2")).toEqual(["Mateo 5:3-6; 6:1-2"]);
    expect(label("Juan 3:16-4:2")).toEqual(["Juan 3:16-4:2"]);
  });

  it("capítulo completo y rango de capítulos", () => {
    expect(label("Salmo 23")).toEqual(["Salmos 23"]);
    expect(refs("Salmos 23-24")[0].ranges).toEqual([{ chapter: 23 }, { chapter: 24 }]);
  });

  it("libros numerados en todas sus formas", () => {
    expect(label("1 Corintios 13:4-7")).toEqual(["1 Corintios 13:4-7"]);
    expect(label("1Co 13:4")).toEqual(["1 Corintios 13:4"]);
    expect(label("Primera de Corintios 13:4")).toEqual(["1 Corintios 13:4"]);
    expect(label("I Juan 4:8")).toEqual(["1 Juan 4:8"]);
    expect(label("2 Tim 3:16")).toEqual(["2 Timoteo 3:16"]);
  });

  it("varias citas en una línea y texto alrededor", () => {
    expect(label("Buen día, hoy: Juan 3:16, Salmos 23:1-3 y Mateo 5:5. Bendiciones")).toEqual([
      "Juan 3:16",
      "Salmos 23:1-3",
      "Mateo 5:5",
    ]);
  });

  it("líneas sin cita son títulos; nombre de libro suelto no cuenta", () => {
    const items = parseMessage("Las bienaventuranzas\nMateo 5:3\nJuan dijo que sí");
    expect(items.map((i) => i.kind)).toEqual(["title", "reference", "title"]);
  });

  it("no confunde 'es' o 'ap' dentro de palabras", () => {
    expect(refs("La paz es de Dios 3:16")).toHaveLength(0);
  });
});
