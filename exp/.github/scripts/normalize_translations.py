#!/usr/bin/env python3
"""normalize_translations.py

Reads each translation JSON file in translations/ and rewrites it to the
canonical format bible-api.js expects from Firebase RTDB:

  { "Book Name": { "1": { "1": "verse text", ... }, ... }, ... }

Handles two source formats:
  array  - { Book: [null, [null, v1, v2,...], ...] }  (BSB, KJV, LEB, MSB)
  object - { Book: { "ch": { "vs": text } } }         (ASV, NET, WEB)

Also fixes book name casing (e.g. 'Song Of Solomon' -> 'Song of Solomon')
and drops null/empty verse entries.

Skips BLB (already correct) and any folder without a .json bible file.
"""

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
TRANSLATIONS_DIR = REPO_ROOT / "translations"

BOOK_NAME_FIX = {
    "Song Of Solomon": "Song of Solomon",
}

# Translations whose source files use the array-of-arrays format.
ARRAY_FORMAT = {"BSB", "KJV", "LEB", "MSB"}
# Translations already in the correct format - skip rewriting.
SKIP = {"BLB"}


def normalize_array(data: dict) -> dict:
    out = {}
    for raw_book, chapters in data.items():
        if raw_book == "Info":
            continue
        book = BOOK_NAME_FIX.get(raw_book, raw_book)
        if not isinstance(chapters, list):
            continue
        ch_out = {}
        for ch_idx, ch_data in enumerate(chapters):
            if ch_data is None or not isinstance(ch_data, list):
                continue
            vs_out = {}
            for vs_idx, text in enumerate(ch_data):
                if vs_idx == 0:
                    continue
                if text is not None and str(text).strip():
                    vs_out[str(vs_idx)] = str(text)
            if vs_out:
                ch_out[str(ch_idx)] = vs_out
        if ch_out:
            out[book] = ch_out
    return out


def normalize_object(data: dict) -> dict:
    out = {}
    for raw_book, chapters in data.items():
        book = BOOK_NAME_FIX.get(raw_book, raw_book)
        if not isinstance(chapters, dict):
            continue
        ch_out = {}
        for ch_key, verses in chapters.items():
            if not isinstance(verses, dict):
                continue
            vs_out = {
                vs: str(text)
                for vs, text in verses.items()
                if text is not None and str(text).strip()
            }
            if vs_out:
                ch_out[ch_key] = vs_out
        if ch_out:
            out[book] = ch_out
    return out


def main():
    errors = []
    for folder in sorted(TRANSLATIONS_DIR.iterdir()):
        if not folder.is_dir():
            continue
        t = folder.name
        if t in SKIP:
            print(f"  skipping {t} (already normalized)")
            continue

        # Find the bible JSON file (e.g. KJV.json, ASV.json)
        candidates = [f for f in folder.glob("*.json") if f.stem == t]
        if not candidates:
            print(f"  skipping {t} (no {t}.json found)")
            continue
        json_path = candidates[0]

        print(f"  normalizing {json_path.relative_to(REPO_ROOT)} ...", end=" ")
        with open(json_path, "r", encoding="utf-8") as f:
            raw = json.load(f)

        if t in ARRAY_FORMAT:
            normalized = normalize_array(raw)
        else:
            normalized = normalize_object(raw)

        if not normalized:
            print(f"ERROR: output is empty")
            errors.append(t)
            continue

        books = len(normalized)
        verses = sum(len(v) for bk in normalized.values() for v in bk.values())

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(normalized, f, ensure_ascii=False, separators=(",", ":"))

        print(f"{books} books, {verses} verses")

    if errors:
        print(f"\nERROR: failed to normalize: {errors}", file=sys.stderr)
        sys.exit(1)
    else:
        print("\nAll translations normalized successfully.")


if __name__ == "__main__":
    main()
