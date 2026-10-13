import { loadBible, resolveRange, type Verse, type VersionAbbr } from "./bible";
import { BOOK_BY_ID } from "./books";
import type { ParsedItem } from "./references";

export interface Slide {
  id: string;
  kind: "verse" | "title";
  /** Texto de la píldora ("Mateo 5:5"); vacío = sin píldora. */
  label: string;
  text: string;
  version?: VersionAbbr;
  error?: string;
  /** Tamaño de texto fijado a mano (unidades de referencia); sin valor = automático. */
  fontSize?: number;
  /** De dónde salió (para navegar por versículos en el modo en vivo). */
  bookId?: string;
  bookName?: string;
  chapter?: number;
  verseFrom?: number;
  verseTo?: number;
}

export interface BuildOptions {
  versions: VersionAbbr[];
  /** Máximo de caracteres por slide antes de partir un pasaje. */
  maxChars: number;
  verseNumbers: boolean;
}

let counter = 0;
const nextId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

function labelFor(bookName: string, verses: Verse[]): string {
  const a = verses[0];
  const b = verses[verses.length - 1];
  if (a.chapter === b.chapter) {
    return a.number === b.number ? `${bookName} ${a.chapter}:${a.number}` : `${bookName} ${a.chapter}:${a.number}-${b.number}`;
  }
  return `${bookName} ${a.chapter}:${a.number}-${b.chapter}:${b.number}`;
}

/** Agrupa versículos consecutivos sin pasarse de `maxChars`; un versículo largo va solo. */
function chunk(verses: Verse[], maxChars: number, numbers: boolean): Verse[][] {
  const groups: Verse[][] = [];
  let current: Verse[] = [];
  let len = 0;
  for (const v of verses) {
    const piece = (numbers ? `${v.number} ` : "") + v.text;
    if (current.length && len + 1 + piece.length > maxChars) {
      groups.push(current);
      current = [];
      len = 0;
    }
    current.push(v);
    len += (len ? 1 : 0) + piece.length;
  }
  if (current.length) groups.push(current);
  return groups;
}

export async function buildSlides(items: ParsedItem[], opts: BuildOptions): Promise<Slide[]> {
  const bibles = await Promise.all(opts.versions.map(loadBible));
  const slides: Slide[] = [];
  for (const item of items) {
    if (item.kind === "title") {
      slides.push({ id: nextId(), kind: "title", label: "", text: item.text });
      continue;
    }
    const bookName = BOOK_BY_ID.get(item.bookId)?.name ?? item.bookName;
    for (const bible of bibles) {
      try {
        // Cada rango se parte por separado: "5:3-6; 6:1" no debe mezclarse en un slide.
        for (const range of item.ranges) {
          const verses = resolveRange(bible, item.bookId, range);
          if (!verses.length) throw new Error(`${bookName} ${range.chapter} está vacío en ${bible.abbr}`);
          for (const group of chunk(verses, opts.maxChars, opts.verseNumbers)) {
            slides.push({
              id: nextId(),
              kind: "verse",
              label: labelFor(bookName, group),
              text: group.map((v) => (opts.verseNumbers ? `${v.number} ${v.text}` : v.text)).join(" "),
              version: bible.abbr as VersionAbbr,
              bookId: item.bookId,
              bookName,
              chapter: group[0].chapter,
              verseFrom: group[0].number,
              verseTo: group[group.length - 1].number,
            });
          }
        }
      } catch (e) {
        slides.push({
          id: nextId(),
          kind: "verse",
          label: item.raw,
          text: "",
          version: bible.abbr as VersionAbbr,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }
  return slides;
}

/** Nombre de archivo seguro: "03 - Mateo 5.3-6 RVR60". */
export function slideFileName(index: number, slide: Slide, short?: string): string {
  const base = (slide.label || slide.text.slice(0, 40) || "slide").replace(/:/g, ".").replace(/[\\/:*?"<>|]/g, "").trim();
  return `${String(index + 1).padStart(2, "0")} - ${base}${short ? ` ${short}` : ""}`;
}
