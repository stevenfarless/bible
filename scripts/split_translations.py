#!/usr/bin/env python3
"""
split_translations.py

Reads each translations/{T}/{T}_bible.json monolith and writes:
  - translations/{T}/{BookName}.json   (one file per book, 66 per translation)
  - translations/{T}/{T}_search_index.json  (flat ref->lowercased text)

Run via GitHub Actions workflow: .github/workflows/split-translations.yml
"""

import json
import os
import sys
from pathlib import Path

TRANSLATIONS = ['ASV', 'BLB', 'BSB', 'KJV', 'LEB', 'MSB', 'NET', 'WEB']

# Canonical book order — must match BOOK_LOAD_ORDER in bible-api.js
BOOK_ORDER = [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
    'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
    '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
    'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalm', 'Proverbs',
    'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
    'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
    'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
    'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke',
    'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians',
    'Galatians', 'Ephesians', 'Philippians', 'Colossians',
    '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy',
    'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
    '1 John', '2 John', '3 John', 'Jude', 'Revelation',
]

# Keys that differ inside the monolith JSON vs. the canonical name.
# Maps canonical -> key-as-stored-in-json.
BOOK_KEY_ALIASES = {
    'Song of Solomon': 'Song Of Solomon',
}


def find_book_data(bible: dict, canonical: str) -> tuple[str, dict] | None:
    """Return (resolved_key, chapter_dict) or None if not found."""
    for candidate in [canonical, BOOK_KEY_ALIASES.get(canonical, '')]:
        if candidate and candidate in bible:
            data = bible[candidate]
            # Some monoliths nest one level deeper: {"BookName": {"1": ...}}
            # Others store chapters directly: {"1": {"1": ...}}
            # Detect by checking whether the first value is a dict of dicts.
            if isinstance(data, dict):
                first_val = next(iter(data.values()), None)
                if isinstance(first_val, dict):
                    # Check if it looks like chapter->verse (keys are numeric strings)
                    first_key = next(iter(data.keys()), '')
                    if first_key.isdigit():
                        return candidate, data  # chapters at top level
                    # Otherwise it might be a nested book key
                    inner_val = next(iter(first_val.values()), None)
                    if isinstance(inner_val, str):
                        return candidate, first_val  # one level deeper
            return candidate, data
    return None


def split_translation(translation: str, translations_dir: Path) -> bool:
    monolith_path = translations_dir / translation / f'{translation}_bible.json'
    if not monolith_path.exists():
        print(f'  SKIP {translation}: {monolith_path} not found', flush=True)
        return False

    print(f'  Loading {monolith_path} ...', flush=True)
    with open(monolith_path, encoding='utf-8') as f:
        bible = json.load(f)

    out_dir = translations_dir / translation
    search_index = {}
    books_written = 0
    books_missing = []

    for book in BOOK_ORDER:
        result = find_book_data(bible, book)
        if result is None:
            books_missing.append(book)
            continue

        _, chapters = result

        # Write per-book file using canonical book name as filename.
        out_path = out_dir / f'{book}.json'
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(chapters, f, ensure_ascii=False, separators=(',', ':'))
        books_written += 1

        # Accumulate search index entries.
        for ch_str, verses in chapters.items():
            if not isinstance(verses, dict):
                continue
            for v_str, text in verses.items():
                try:
                    v_int = int(v_str)
                except ValueError:
                    continue
                if v_int <= 0:
                    continue
                ref = f'{book} {ch_str}:{v_str}'
                search_index[ref] = str(text).lower()

    # Write search index.
    index_path = out_dir / f'{translation}_search_index.json'
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(search_index, f, ensure_ascii=False, separators=(',', ':'))

    print(f'  {translation}: {books_written}/66 books written, '
          f'{len(search_index)} index entries', flush=True)
    if books_missing:
        print(f'  WARNING {translation}: missing books: {books_missing}', flush=True)

    return True


def main():
    repo_root = Path(__file__).resolve().parent.parent
    translations_dir = repo_root / 'translations'

    # Allow targeting a single translation via CLI arg for faster re-runs.
    targets = sys.argv[1:] if len(sys.argv) > 1 else TRANSLATIONS
    unknown = [t for t in targets if t not in TRANSLATIONS]
    if unknown:
        print(f'ERROR: unknown translations: {unknown}', file=sys.stderr)
        sys.exit(1)

    print(f'Splitting {len(targets)} translation(s): {targets}', flush=True)
    ok = 0
    for t in targets:
        print(f'\n[{t}]', flush=True)
        if split_translation(t, translations_dir):
            ok += 1

    print(f'\nDone. {ok}/{len(targets)} translations processed.')
    if ok < len(targets):
        sys.exit(1)


if __name__ == '__main__':
    main()
