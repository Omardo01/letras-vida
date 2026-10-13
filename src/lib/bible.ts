import { BOOK_BY_ID } from "./books";
import type { VerseRange } from "./references";

export interface BibleBook {
  id: string;
  name: string;
  /** chapters[c-1][v-1] = texto del versículo ("" si la traducción lo omite). */
  chapters: string[][];
}

export interface Bible {
  abbr: string;
  name: string;
  copyright: string;
  books: BibleBook[];
}

export const VERSIONS = [
  { abbr: "RVR1960", name: "Reina-Valera 1960", short: "RVR60" },
  { abbr: "LBLA", name: "La Biblia de las Américas", short: "LBLA" },
  { abbr: "NBLA", name: "Nueva Biblia de las Américas", short: "NBLA" },
] as const;

export type VersionAbbr = (typeof VERSIONS)[number]["abbr"];

const cache = new Map<string, Promise<Bible>>();

export function loadBible(abbr: VersionAbbr): Promise<Bible> {
  let p = cache.get(abbr);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}bibles/${abbr}.json`).then(async (r) => {
      if (!r.ok) throw new Error(`No se pudo cargar ${abbr} (${r.status})`);
      return (await r.json()) as Bible;
    });
    cache.set(abbr, p);
  }
  return p;
}

export interface Verse {
  chapter: number;
  number: number;
  text: string;
}

/** Expande un rango a versículos concretos. Lanza si el capítulo o versículo no existe. */
export function resolveRange(bible: Bible, bookId: string, r: VerseRange): Verse[] {
  const book = bible.books.find((b) => b.id === bookId);
  if (!book) throw new Error(`${bookId} no está en ${bible.abbr}`);
  const chapter = (c: number) => {
    const ch = book.chapters[c - 1];
    if (!ch) throw new Error(`${book.name} no tiene capítulo ${c}`);
    return ch;
  };
  const out: Verse[] = [];
  const push = (c: number, v: number) => {
    const ch = chapter(c);
    if (v < 1 || v > ch.length) throw new Error(`${book.name} ${c} no tiene versículo ${v}`);
    if (ch[v - 1]) out.push({ chapter: c, number: v, text: ch[v - 1] });
  };

  if (r.from == null) {
    const ch = chapter(r.chapter);
    for (let v = 1; v <= ch.length; v++) push(r.chapter, v);
    return out;
  }
  const endChapter = r.toChapter ?? r.chapter;
  const endVerse = r.to ?? r.from;
  for (let c = r.chapter; c <= endChapter; c++) {
    const first = c === r.chapter ? r.from : 1;
    const last = c === endChapter ? endVerse : chapter(c).length;
    for (let v = first; v <= last; v++) push(c, v);
  }
  return out;
}

export interface ChapterInfo {
  bookName: string;
  chapter: number;
  verses: number;
  chapters: number;
}

/** Cuántos versículos tiene un capítulo y cuántos capítulos el libro. */
export async function chapterInfo(abbr: VersionAbbr, bookId: string, chapter: number): Promise<ChapterInfo | null> {
  const bible = await loadBible(abbr);
  const book = bible.books.find((b) => b.id === bookId);
  const ch = book?.chapters[chapter - 1];
  if (!book || !ch) return null;
  return { bookName: BOOK_BY_ID.get(bookId)?.name ?? book.name, chapter, verses: ch.length, chapters: book.chapters.length };
}
