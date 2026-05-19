#!/usr/bin/env python3
import json
import os
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# ---------- SBL abbreviation -> full book name ----------
BOOK_NAMES = {
    "GEN": "Genesis", "EXO": "Exodus", "LEV": "Leviticus", "NUM": "Numbers",
    "DEU": "Deuteronomy", "JOS": "Joshua", "JDG": "Judges", "RUT": "Ruth",
    "1SA": "1 Samuel", "2SA": "2 Samuel", "1KI": "1 Kings", "2KI": "2 Kings",
    "1CH": "1 Chronicles", "2CH": "2 Chronicles", "EZR": "Ezra",
    "NEH": "Nehemiah", "EST": "Esther", "JOB": "Job", "PSA": "Psalm",
    "PRO": "Proverbs", "ECC": "Ecclesiastes", "SNG": "Song of Solomon",
    "ISA": "Isaiah", "JER": "Jeremiah", "LAM": "Lamentations",
    "EZK": "Ezekiel", "DAN": "Daniel", "HOS": "Hosea", "JOL": "Joel",
    "AMO": "Amos", "OBA": "Obadiah", "JON": "Jonah", "MIC": "Micah",
    "NAM": "Nahum", "HAB": "Habakkuk", "ZEP": "Zephaniah", "HAG": "Haggai",
    "ZEC": "Zechariah", "MAL": "Malachi",
    "MAT": "Matthew", "MRK": "Mark", "LUK": "Luke", "JHN": "John",
    "ACT": "Acts", "ROM": "Romans", "1CO": "1 Corinthians",
    "2CO": "2 Corinthians", "GAL": "Galatians", "EPH": "Ephesians",
    "PHP": "Philippians", "COL": "Colossians", "1TH": "1 Thessalonians",
    "2TH": "2 Thessalonians", "1TI": "1 Timothy", "2TI": "2 Timothy",
    "TIT": "Titus", "PHM": "Philemon", "HEB": "Hebrews", "JAS": "James",
    "1PE": "1 Peter", "2PE": "2 Peter", "1JN": "1 John", "2JN": "2 John",
    "3JN": "3 John", "JUD": "Jude", "REV": "Revelation",
    # Some sources use alternate abbreviations
    "MAR": "Mark", "JOHN": "John", "PHIL": "Philippians", "PHLM": "Philemon",
    "JAM": "James", "JUDE": "Jude",
}

def resolve_abbrev(raw: str) -> str:
    """Resolve a book abbreviation from the source file to a full book name."""
    upper = raw.upper().strip()
    if upper in BOOK_NAMES:
        return BOOK_NAMES[upper]
    # Try partial match for edge cases (e.g. "SONG" -> "Song of Solomon")
    for k, v in BOOK_NAMES.items():
        if upper.startswith(k) or k.startswith(upper):
            return v
    raise ValueError(f"Unknown book abbreviation: {raw!r}")


def main():
    source_url = os.environ["SOURCE_URL"].strip()
    copyright_url = os.environ.get("COPYRIGHT_URL", "https://www.biblegateway.com").strip()

    # Derive translation abbreviation from the filename if not supplied
    abbrev_override = os.environ.get("TRANSLATION_ABBREV", "").strip()
    if abbrev_override:
        translation = abbrev_override.upper()
    else:
        # e.g. "...NRSVUE.json" -> "NRSVUE"
        translation = Path(source_url).stem.upper()

    print(f"Fetching {source_url}")
    with urllib.request.urlopen(source_url) as resp:
        verses = json.loads(resp.read().decode("utf-8"))

    if not isinstance(verses, list):
        raise ValueError("Expected a flat JSON array at the source URL.")

    timestamp = datetime.now(timezone.utc).isoformat()
    info_block = {
        "Copyright": copyright_url,
        "Language": "English",
        "Meaningless": "1.4.0",
        "Timestamp": timestamp,
        "Translation": translation,
    }

    # Group verses: books_data[book_name][chapter_str][verse_str] = text
    books_data: dict[str, dict[str, dict[str, str]]] = {}
    unknown_books: set[str] = set()

    for entry in verses:
        raw_book = entry["book"]
        try:
            book_name = resolve_abbrev(raw_book)
        except ValueError:
            unknown_books.add(raw_book)
            continue
        chapter = str(entry["chapter"])
        verse = str(entry["verse"])
        text = entry["text"].strip()

        books_data.setdefault(book_name, {}).setdefault(chapter, {})[verse] = text

    if unknown_books:
        print(f"WARNING: skipped unknown book abbreviations: {unknown_books}")

    # Output paths
    out_dir = Path("translations") / translation
    books_dir = out_dir / f"{translation}_books"
    books_dir.mkdir(parents=True, exist_ok=True)

    # Write per-book files
    for book_name, chapters in books_data.items():
        book_obj = {"Info": info_block, book_name: chapters}
        book_path = books_dir / f"{book_name}.json"
        book_path.write_text(json.dumps(book_obj, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"  wrote {book_path}")

    # Write combined bible file
    combined: dict = {"Info": info_block}
    combined.update(books_data)
    combined_path = out_dir / f"{translation}_bible.json"
    combined_path.write_text(json.dumps(combined, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  wrote {combined_path}")

    print(f"Done. {len(books_data)} books written to translations/{translation}/")


if __name__ == "__main__":
    main()
