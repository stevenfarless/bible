#!/usr/bin/env python3
"""convert_blb.py

Reads translations/BLB/blb.xlsx and writes:
  translations/BLB/BLB_bible.json  — { Book: { "1": { "1": "verse text", ... } } }
  translations/BLB/meta.json       — translation metadata for the registry

Actual xlsx layout (3 header rows, then data):
  col 0: row number (integer)
  col 1: reference string e.g. "Genesis 1:1"
  col 2: verse text
"""

import json
import re
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("ERROR: openpyxl is required. Run: pip install openpyxl", file=sys.stderr)
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parents[2]
XLSX_PATH = REPO_ROOT / "translations" / "BLB" / "blb.xlsx"
OUT_JSON  = REPO_ROOT / "translations" / "BLB" / "BLB_bible.json"
OUT_META  = REPO_ROOT / "translations" / "BLB" / "meta.json"

# Matches "Book Ch:Vs" where book name may start with a digit e.g. "1 Corinthians 13:4"
REF_RE = re.compile(r'^((?:\d\s+)?[A-Za-z][A-Za-z ]*?)\s+(\d+):(\d+)$')


def convert(path: Path) -> dict:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active

    bible = {}
    skipped = 0

    for row in ws.iter_rows(values_only=True):
        ref_cell  = row[1] if len(row) > 1 else None
        text_cell = row[2] if len(row) > 2 else None

        if not ref_cell or not text_cell:
            skipped += 1
            continue

        m = REF_RE.match(str(ref_cell).strip())
        if not m:
            skipped += 1
            continue

        book = m.group(1).strip()
        ch   = m.group(2)
        vs   = m.group(3)
        text = str(text_cell).strip()

        bible.setdefault(book, {}).setdefault(ch, {})[vs] = text

    wb.close()

    total = sum(len(verses) for chapters in bible.values() for verses in chapters.values())
    print(f"  {len(bible)} book(s), {total} verse(s) converted ({skipped} rows skipped)")
    return bible


def main():
    if not XLSX_PATH.exists():
        print(f"ERROR: {XLSX_PATH} not found.", file=sys.stderr)
        sys.exit(1)

    print(f"Reading {XLSX_PATH} ...")
    bible = convert(XLSX_PATH)

    if not bible:
        print("ERROR: no verses extracted. Check xlsx structure.", file=sys.stderr)
        sys.exit(1)

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
