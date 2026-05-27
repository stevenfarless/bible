#!/usr/bin/env python3
"""convert_blb.py

Reads translations/BLB/blb.xlsx and writes:
  translations/BLB/BLB_bible.json  — { Book: { "1": { "1": "verse text", ... }, ... } }
  translations/BLB/meta.json       — translation metadata for the registry

The BLB xlsx from berean.bible uses one of two common layouts:
  Layout A — columns: Book | Chapter | Verse | Text
  Layout B — columns: Book | Chapter | Verse | Text  (same, different header names)

The script auto-detects column positions by header name (case-insensitive).
If no header row is found it falls back to positional order: col 0=book,
col 1=chapter, col 2=verse, col 3=text.
"""

import json
import os
import re
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("ERROR: openpyxl is required. Run: pip install openpyxl", file=sys.stderr)
    sys.exit(1)

REPO_ROOT   = Path(__file__).resolve().parents[2]
XLSX_PATH   = REPO_ROOT / "translations" / "BLB" / "blb.xlsx"
OUT_JSON    = REPO_ROOT / "translations" / "BLB" / "BLB_bible.json"
OUT_META    = REPO_ROOT / "translations" / "BLB" / "meta.json"

# Canonical NT book order for the BLB (NT-only translation).
# Used to validate/warn if unexpected book names appear.
EXPECTED_BOOKS = [
    "Matthew", "Mark", "Luke", "John", "Acts",
    "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
    "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
    "Jude", "Revelation",
]


def normalise_book(raw: str) -> str:
    """Strip leading/trailing whitespace and normalise common abbreviations."""
    s = raw.strip()
    # Some xlsx exports use abbreviated NT book names—expand the most common ones.
    abbrev_map = {
        "Mt": "Matthew", "Mk": "Mark", "Lk": "Luke", "Jn": "John",
        "Ac": "Acts", "Ro": "Romans", "Ga": "Galatians", "Ep": "Ephesians",
        "Php": "Philippians", "Col": "Colossians", "Phm": "Philemon",
        "Heb": "Hebrews", "Jas": "James", "Jud": "Jude", "Re": "Revelation",
        "1Co": "1 Corinthians", "2Co": "2 Corinthians",
        "1Th": "1 Thessalonians", "2Th": "2 Thessalonians",
        "1Ti": "1 Timothy",      "2Ti": "2 Timothy",
        "1Pe": "1 Peter",        "2Pe": "2 Peter",
        "1Jn": "1 John",         "2Jn": "2 John",  "3Jn": "3 John",
    }
    return abbrev_map.get(s, s)


def detect_columns(header_row):
    """Return (book_col, chapter_col, verse_col, text_col) indices."""
    mapping = {}
    for i, cell in enumerate(header_row):
        if cell is None:
            continue
        key = str(cell).strip().lower()
        if key in ("book", "book name", "bookname"):
            mapping["book"] = i
        elif key in ("chapter", "ch", "chap"):
            mapping["chapter"] = i
        elif key in ("verse", "v", "vs"):
            mapping["verse"] = i
        elif key in ("text", "verse text", "versetext", "content", "scripture"):
            mapping["text"] = i
    if len(mapping) == 4:
        return mapping["book"], mapping["chapter"], mapping["verse"], mapping["text"]
    # Fallback: positional
    print("WARNING: could not detect header row; assuming columns are Book, Chapter, Verse, Text (positions 0–3).")
    return 0, 1, 2, 3


def load_xlsx(path: Path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    return rows


def convert(rows):
    bible = {}
    unknown_books = set()

    # Detect header row: first row where at least one cell matches a known header keyword
    header_keywords = {"book", "chapter", "verse", "text", "book name"}
    start = 0
    col_b, col_c, col_v, col_t = 0, 1, 2, 3

    if rows:
        first = [str(c).strip().lower() if c else "" for c in rows[0]]
        if any(k in first for k in header_keywords):
            col_b, col_c, col_v, col_t = detect_columns(rows[0])
            start = 1
        else:
            print("No header row detected; treating row 1 as data.")

    for row in rows[start:]:
        if len(row) <= max(col_b, col_c, col_v, col_t):
            continue
        raw_book = row[col_b]
        raw_ch   = row[col_c]
        raw_vs   = row[col_v]
        raw_text = row[col_t]

        if not all([raw_book, raw_ch, raw_vs, raw_text]):
            continue

        book = normalise_book(str(raw_book))
        ch   = str(int(float(str(raw_ch))))
        vs   = str(int(float(str(raw_vs))))
        text = str(raw_text).strip()

        if book not in EXPECTED_BOOKS:
            unknown_books.add(book)

        bible.setdefault(book, {}).setdefault(ch, {})[vs] = text

    if unknown_books:
        print(f"WARNING: unexpected book names encountered: {sorted(unknown_books)}")
        print("These will still be included in the output.")

    return bible


def main():
    if not XLSX_PATH.exists():
        print(f"ERROR: {XLSX_PATH} not found.", file=sys.stderr)
        sys.exit(1)

    print(f"Reading {XLSX_PATH} ...")
    rows = load_xlsx(XLSX_PATH)
    print(f"  {len(rows)} rows loaded")

    bible = convert(rows)

    total_verses = sum(
        len(verses)
        for chapters in bible.values()
        for verses in chapters.values()
    )
    print(f"  {len(bible)} book(s), {total_verses} verse(s) converted")

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(bible, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Written: {OUT_JSON}")

    meta = {
        "id": "BLB",
        "label": "BLB \u2014 Berean Literal Bible",
        "copyright": (
            "The Holy Bible, Berean Literal Bible, BLB is produced in cooperation "
            "with Bible Hub, Discovery Bible, OpenBible.com, and the Berean Bible "
            "Translation Committee. This text of God\u2019s Word has been dedicated "
            "to the public domain."
        ),
    }
    with open(OUT_META, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"Written: {OUT_META}")


if __name__ == "__main__":
    main()
