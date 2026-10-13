/** Libros de la Biblia con el nombre que va en la píldora y sus abreviaturas usuales. */
export interface Book {
  id: string;
  name: string;
  aliases: string[];
}

// Los alias se comparan normalizados (minúsculas, sin acentos ni puntos).
export const BOOKS: Book[] = [
  { id: "GEN", name: "Génesis", aliases: ["genesis", "gn", "gen"] },
  { id: "EXO", name: "Éxodo", aliases: ["exodo", "ex", "exo"] },
  { id: "LEV", name: "Levítico", aliases: ["levitico", "lv", "lev"] },
  { id: "NUM", name: "Números", aliases: ["numeros", "nm", "num"] },
  { id: "DEU", name: "Deuteronomio", aliases: ["deuteronomio", "dt", "deut", "deu"] },
  { id: "JOS", name: "Josué", aliases: ["josue", "jos"] },
  { id: "JDG", name: "Jueces", aliases: ["jueces", "jue", "jc", "jdg"] },
  { id: "RUT", name: "Rut", aliases: ["rut", "rt", "ruth"] },
  { id: "1SA", name: "1 Samuel", aliases: ["1 samuel", "1 sam", "1 s", "1sa", "1 sm"] },
  { id: "2SA", name: "2 Samuel", aliases: ["2 samuel", "2 sam", "2 s", "2sa", "2 sm"] },
  { id: "1KI", name: "1 Reyes", aliases: ["1 reyes", "1 rey", "1 re", "1 r", "1ki"] },
  { id: "2KI", name: "2 Reyes", aliases: ["2 reyes", "2 rey", "2 re", "2 r", "2ki"] },
  { id: "1CH", name: "1 Crónicas", aliases: ["1 cronicas", "1 cron", "1 cro", "1 cr", "1ch"] },
  { id: "2CH", name: "2 Crónicas", aliases: ["2 cronicas", "2 cron", "2 cro", "2 cr", "2ch"] },
  { id: "EZR", name: "Esdras", aliases: ["esdras", "esd", "ezr"] },
  { id: "NEH", name: "Nehemías", aliases: ["nehemias", "neh", "ne"] },
  { id: "EST", name: "Ester", aliases: ["ester", "est", "esther"] },
  { id: "JOB", name: "Job", aliases: ["job", "jb"] },
  { id: "PSA", name: "Salmos", aliases: ["salmos", "salmo", "sal", "slm", "sl", "ps", "psa"] },
  { id: "PRO", name: "Proverbios", aliases: ["proverbios", "prov", "pro", "pr", "pv"] },
  { id: "ECC", name: "Eclesiastés", aliases: ["eclesiastes", "ecl", "ec", "ecc", "qo"] },
  { id: "SNG", name: "Cantares", aliases: ["cantares", "cantar de los cantares", "cantar", "cnt", "cant", "ct", "sng"] },
  { id: "ISA", name: "Isaías", aliases: ["isaias", "isa", "is"] },
  { id: "JER", name: "Jeremías", aliases: ["jeremias", "jer", "jr"] },
  { id: "LAM", name: "Lamentaciones", aliases: ["lamentaciones", "lam", "lm"] },
  { id: "EZK", name: "Ezequiel", aliases: ["ezequiel", "eze", "ez", "ezq", "ezk"] },
  { id: "DAN", name: "Daniel", aliases: ["daniel", "dan", "dn"] },
  { id: "HOS", name: "Oseas", aliases: ["oseas", "os", "hos"] },
  { id: "JOL", name: "Joel", aliases: ["joel", "jl", "jol"] },
  { id: "AMO", name: "Amós", aliases: ["amos", "am", "amo"] },
  { id: "OBA", name: "Abdías", aliases: ["abdias", "abd", "ab", "oba"] },
  { id: "JON", name: "Jonás", aliases: ["jonas", "jon"] },
  { id: "MIC", name: "Miqueas", aliases: ["miqueas", "miq", "mi", "mic"] },
  { id: "NAM", name: "Nahúm", aliases: ["nahum", "nah", "na", "nam"] },
  { id: "HAB", name: "Habacuc", aliases: ["habacuc", "hab"] },
  { id: "ZEP", name: "Sofonías", aliases: ["sofonias", "sof", "sf", "zep"] },
  { id: "HAG", name: "Hageo", aliases: ["hageo", "hag", "ag"] },
  { id: "ZEC", name: "Zacarías", aliases: ["zacarias", "zac", "za", "zec"] },
  { id: "MAL", name: "Malaquías", aliases: ["malaquias", "mal", "ml"] },
  { id: "MAT", name: "Mateo", aliases: ["mateo", "san mateo", "s mateo", "mt", "mat"] },
  { id: "MRK", name: "Marcos", aliases: ["marcos", "san marcos", "s marcos", "mr", "mc", "mar", "mrk"] },
  { id: "LUK", name: "Lucas", aliases: ["lucas", "san lucas", "s lucas", "lc", "luc", "luk"] },
  { id: "JHN", name: "Juan", aliases: ["juan", "san juan", "s juan", "jn", "jua", "jhn"] },
  { id: "ACT", name: "Hechos", aliases: ["hechos", "hechos de los apostoles", "hch", "hech", "act"] },
  { id: "ROM", name: "Romanos", aliases: ["romanos", "rom", "ro", "rm"] },
  { id: "1CO", name: "1 Corintios", aliases: ["1 corintios", "1 cor", "1 co", "1co"] },
  { id: "2CO", name: "2 Corintios", aliases: ["2 corintios", "2 cor", "2 co", "2co"] },
  { id: "GAL", name: "Gálatas", aliases: ["galatas", "gal", "ga", "gl"] },
  { id: "EPH", name: "Efesios", aliases: ["efesios", "efe", "ef", "eph"] },
  { id: "PHP", name: "Filipenses", aliases: ["filipenses", "fil", "flp", "fp", "php"] },
  { id: "COL", name: "Colosenses", aliases: ["colosenses", "col", "cl"] },
  { id: "1TH", name: "1 Tesalonicenses", aliases: ["1 tesalonicenses", "1 tes", "1 ts", "1 tsl", "1th"] },
  { id: "2TH", name: "2 Tesalonicenses", aliases: ["2 tesalonicenses", "2 tes", "2 ts", "2 tsl", "2th"] },
  { id: "1TI", name: "1 Timoteo", aliases: ["1 timoteo", "1 tim", "1 ti", "1ti"] },
  { id: "2TI", name: "2 Timoteo", aliases: ["2 timoteo", "2 tim", "2 ti", "2ti"] },
  { id: "TIT", name: "Tito", aliases: ["tito", "tit", "tt"] },
  { id: "PHM", name: "Filemón", aliases: ["filemon", "flm", "film", "fmn", "phm"] },
  { id: "HEB", name: "Hebreos", aliases: ["hebreos", "heb", "he"] },
  { id: "JAS", name: "Santiago", aliases: ["santiago", "stg", "sant", "st", "jas"] },
  { id: "1PE", name: "1 Pedro", aliases: ["1 pedro", "1 ped", "1 pe", "1 p", "1pe"] },
  { id: "2PE", name: "2 Pedro", aliases: ["2 pedro", "2 ped", "2 pe", "2 p", "2pe"] },
  { id: "1JN", name: "1 Juan", aliases: ["1 juan", "1 jn", "1 j", "1jn"] },
  { id: "2JN", name: "2 Juan", aliases: ["2 juan", "2 jn", "2 j", "2jn"] },
  { id: "3JN", name: "3 Juan", aliases: ["3 juan", "3 jn", "3 j", "3jn"] },
  { id: "JUD", name: "Judas", aliases: ["judas", "jud"] },
  { id: "REV", name: "Apocalipsis", aliases: ["apocalipsis", "apoc", "ap", "rev"] },
];

export const BOOK_BY_ID = new Map(BOOKS.map((b) => [b.id, b]));

/** Minúsculas, sin acentos, sin puntos; "I/II/III", "1ro/1ra/1º", "primera/segunda/tercera" → dígito. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.(?!\d)/g, " ") // "Jn." / "S. Mateo" → sin punto; "3.16" se conserva
    .replace(/\b(?:primera|primer|1ra|1ro|1º|1o|i)\b(?=\s*[a-z])/g, "1")
    .replace(/\b(?:segunda|segundo|2da|2do|2º|2o|ii)\b(?=\s*[a-z])/g, "2")
    .replace(/\b(?:tercera|tercer|3ra|3ro|3º|3o|iii)\b(?=\s*[a-z])/g, "3")
    .replace(/\b([123]) (?:de|a) (?=[a-z])/g, "$1 ") // "primera de corintios" → "1 corintios"
    .replace(/\s+/g, " ")
    .trim();
}

/** Regex con todos los alias (largos primero) para localizar libros dentro de un texto normalizado. */
export const BOOK_PATTERN: RegExp = (() => {
  const alts = BOOKS.flatMap((b) => b.aliases.map((a) => ({ a, id: b.id })))
    .sort((x, y) => y.a.length - x.a.length)
    .map(({ a }) => a.replace(/\s/g, "\\s?"));
  return new RegExp(`(?<![a-z0-9])(${alts.join("|")})(?![a-z])`, "g");
})();

export const ALIAS_TO_ID = new Map(BOOKS.flatMap((b) => b.aliases.map((a) => [a.replace(/\s/g, ""), b.id] as const)));
