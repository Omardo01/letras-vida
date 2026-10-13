#!/usr/bin/env python3
"""Convierte los snapshots de mrk214 (data/*.json) al formato compacto que carga la app.

Salida: public/bibles/<ABBR>.json →
  { abbr, name, copyright, books: [ { id, name, chapters: [ [verso1, verso2, ...], ... ] } ] }
Un versículo ausente en una traducción queda como cadena vacía.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data"
OUT = ROOT / "public" / "bibles"
OUT.mkdir(parents=True, exist_ok=True)

VERSIONS = {"RVR1960": "Reina-Valera 1960", "LBLA": "La Biblia de las Américas", "NBLA": "Nueva Biblia de las Américas"}

def clean(lines):
    text = " ".join(l.strip() for l in lines if l.strip())
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s+([,.;:!?»)\]])", r"\1", text)   # "humildes , pues" → "humildes, pues"
    text = re.sub(r"([(¡¿«\[])\s+", r"\1", text)
    text = text.lstrip("»").strip()                    # marca de continuación de cita
    return text

for abbr, name in VERSIONS.items():
    d = json.loads((SRC / f"{abbr}.json").read_text())
    books = []
    for b in d["books"]:
        seen = {}
        for ch in b["chapters"]:
            usfm = ch["chapter_usfm"]
            verses = {}
            for it in ch["items"]:
                if it["type"] != "verse":
                    continue
                for n in it["verse_numbers"]:
                    verses.setdefault(n, clean(it["lines"]))
            if verses and usfm not in seen:           # RVR1960 duplica los libros de un capítulo
                seen[usfm] = verses
        chapters = []
        for usfm in sorted(seen, key=lambda u: int(u.split(".")[1])):
            v = seen[usfm]
            chapters.append([v.get(i, "") for i in range(1, max(v) + 1)])
        books.append({"id": b["book_usfm"], "name": b["name"], "chapters": chapters})
    out = {"abbr": abbr, "name": name, "copyright": d["copyright"]["text"].strip(), "books": books}
    path = OUT / f"{abbr}.json"
    path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    n_verses = sum(len(c) for bk in books for c in bk["chapters"])
    print(f"{abbr}: {len(books)} libros, {sum(len(bk['chapters']) for bk in books)} capítulos, {n_verses} versículos → {path.stat().st_size/1e6:.1f} MB")
