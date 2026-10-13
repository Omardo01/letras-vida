import { ALIAS_TO_ID, BOOK_BY_ID, BOOK_PATTERN, normalize } from "./books";

export interface VerseRange {
  chapter: number;
  /** Sin `from` = capítulo completo. */
  from?: number;
  to?: number;
  /** Rango que cruza de capítulo (Juan 3:16-4:2). */
  toChapter?: number;
}

export interface Reference {
  kind: "reference";
  bookId: string;
  bookName: string;
  ranges: VerseRange[];
  /** Fragmento original del mensaje. */
  raw: string;
}

export interface TitleItem {
  kind: "title";
  text: string;
  raw: string;
}

export type ParsedItem = Reference | TitleItem;

/**
 * Lee lo que sigue al nombre de un libro: "3:16-18,20; 4:1", "23", "23-24", "3.16".
 * Gramática: capítulo ( ':' versos )? ( ';' capítulo ':' versos )*
 */
class RangeReader {
  private i = 0;
  private readonly s: string;
  constructor(s: string) {
    this.s = s;
  }

  get consumed() {
    return this.i;
  }

  private ws() {
    while (this.s[this.i] === " ") this.i++;
  }

  private peek(re: RegExp): RegExpExecArray | null {
    this.ws();
    return re.exec(this.s.slice(this.i));
  }

  private num(): number | null {
    const m = this.peek(/^\d{1,3}/);
    if (!m) return null;
    this.i += m[0].length;
    return parseInt(m[0], 10);
  }

  private sepVerse(): boolean {
    // ':' o '.' entre capítulo y versículo
    const m = this.peek(/^[:.]/);
    if (m) this.i += 1;
    return Boolean(m);
  }

  private dash(): boolean {
    const m = this.peek(/^[-–—]/);
    if (m) this.i += 1;
    return Boolean(m);
  }

  read(): VerseRange[] {
    const out: VerseRange[] = [];
    let chapter = this.num();
    if (chapter == null) return out;
    for (;;) {
      if (this.sepVerse()) {
        let any = false;
        for (;;) {
          const from = this.num();
          if (from == null) break;
          any = true;
          let to = from;
          let toChapter: number | undefined;
          if (this.dash()) {
            const a = this.num();
            if (a != null && this.peek(/^[:.]\s*\d/)) {
              this.sepVerse();
              to = this.num() ?? a;
              toChapter = a;
            } else if (a != null) {
              to = Math.max(a, from);
            }
          }
          out.push({ chapter, from, to, toChapter });
          // ", 20" → otro versículo; ", 4:1" → otro capítulo (lo maneja el bucle externo)
          if (this.peek(/^,\s*\d{1,3}(?![:.\d])/)) {
            this.i += 1;
            continue;
          }
          break;
        }
        if (!any) out.push({ chapter });
      } else if (this.peek(/^[-–—]\s*\d/)) {
        this.dash();
        const c2 = this.num()!;
        for (let c = chapter; c <= Math.max(c2, chapter); c++) out.push({ chapter: c });
      } else {
        out.push({ chapter });
      }
      // "; 4:1" o ", 4:1" → mismo libro, otro capítulo
      if (this.peek(/^[;,]\s*\d{1,3}\s*[:.]\s*\d/)) {
        this.i += 1;
        chapter = this.num()!;
        continue;
      }
      break;
    }
    return out;
  }
}

/** Recorre el mensaje línea por línea: citas → referencias; el resto → títulos. */
export function parseMessage(text: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const norm = normalize(line);
    let found = 0;
    const re = new RegExp(BOOK_PATTERN.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(norm))) {
      const bookId = ALIAS_TO_ID.get(m[1].replace(/\s/g, ""));
      if (!bookId) continue;
      const reader = new RangeReader(norm.slice(m.index + m[0].length));
      const ranges = reader.read();
      if (ranges.length === 0) continue; // nombre suelto sin capítulo ("Juan dijo…")
      found++;
      const end = m.index + m[0].length + reader.consumed;
      items.push({
        kind: "reference",
        bookId,
        bookName: BOOK_BY_ID.get(bookId)!.name,
        ranges,
        raw: norm.slice(m.index, end).trim(),
      });
      re.lastIndex = end;
    }
    if (found === 0) items.push({ kind: "title", text: line, raw: line });
  }
  return items;
}

export function formatRange(r: VerseRange): string {
  if (r.from == null) return `${r.chapter}`;
  if (r.toChapter != null) return `${r.chapter}:${r.from}-${r.toChapter}:${r.to}`;
  return r.to != null && r.to !== r.from ? `${r.chapter}:${r.from}-${r.to}` : `${r.chapter}:${r.from}`;
}

/** "Mateo 5:3-6,9; 6:1" */
export function formatReference(bookName: string, ranges: VerseRange[]): string {
  const parts: string[] = [];
  let last: number | null = null;
  for (const r of ranges) {
    if (r.chapter === last && r.from != null && r.toChapter == null) {
      parts[parts.length - 1] += `,${formatRange(r).split(":")[1]}`;
    } else {
      parts.push(formatRange(r));
    }
    last = r.toChapter ?? r.chapter;
  }
  return `${bookName} ${parts.join("; ")}`;
}
