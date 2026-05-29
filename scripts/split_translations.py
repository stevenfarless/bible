#!/usr/bin/env python3
"""
split_translations.py

Reads each translations/{T}/{T}_bible.json monolith and writes:
  - translations/{T}/{BookName}.json   (one file per book, 66 per translation)
  - translations/{T}/{T}_search_index.json  (flat ref->lowercased text)

Run via GitHub Actions workflow: .github/workflows/split-translations.yml
"""

import json
import re
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

# Extra aliases for known variant spellings (canonical -> stored key).
# The fuzzy matcher below handles most cases automatically; this list
# catches things that differ in ways the normaliser can't guess.
BOOK_KEY_ALIASES = {
    'Song of Solomon': 'Song Of Solomon',
    'Psalm':           'Psalms',
}

# Normalise a key for fuzzy matching:
#   lowercase, collapse whitespace, strip punctuation,
#   replace leading digit-word prefixes ("1 " -> "1", "III " -> "3 ").
_ROMAN = {'i': '1', 'ii': '2', 'iii': '3', 'iv': '4'}

def _normalise(s: str) -> str:
    s = s.lower().strip()
    # Roman numeral prefix: "iii john" -> "3 john"
    m = re.match(r'^(i{1,3}v?|iv)\s+', s)
    if m:
        s = _ROMAN.get(m.group(1), m.group(1)) + ' ' + s[m.end():]
    s = re.sub(r'\s+', ' ', s)
    return s


def _build_key_map(bible: dict) -> dict:
    """Return {normalised_key: actual_key} for every key in bible."""
    return {_normalise(k): k for k in bible}


def _resolve(bible: dict, key_map: dict, canonical: str):
    """
    Try to find chapter data for `canonical` in `bible`.
    Lookup order:
      1. Exact canonical name.
      2. Known alias from BOOK_KEY_ALIASES.
      3. Case-insensitive / normalised fuzzy match via key_map.
    Returns (actual_key, chapter_dict) or None.
    """
    candidates = [canonical]
    alias = BOOK_KEY_ALIASES.get(canonical)
    if alias:
        candidates.append(alias)
    # Add the reverse alias too (e.g. "Psalms" when canonical is "Psalm")
    for stored_alias in BOOK_KEY_ALIASES.values():
        if stored_alias not in candidates:
            candidates.append(stored_alias)

    # Fuzzy fallback via normalised key map
    norm_canonical = _normalise(canonical)
    fuzzy_key = key_map.get(norm_canonical)
    if fuzzy_key and fuzzy_key not in candidates:
        candidates.append(fuzzy_key)

    for candidate in candidates:
        if candidate not in bible:
            continue
        data = bible[candidate]
        if not isinstance(data, dict):
            continue

        first_key = next(iter(data.keys()), '')

        if first_key.isdigit():
            # Standard: { "1": { "1": "verse" }, ... }
            return candidate, data

        # Nested one level: { "BookName": { "1": { "1": "verse" } } }
        first_val = data.get(first_key)
        if isinstance(first_val, dict):
            nested_key = next(iter(first_val.keys()), '')
            if nested_key.isdigit():
                return candidate, first_val

        print(f'    WARNING: unrecognised structure for "{candidate}" '
              f'(first key: "{first_key}"), skipping', flush=True)

    return None


def _unwrap_envelope(bible: dict) -> dict:
    """
    Some monoliths wrap everything under a single top-level key, e.g.
      { "KJV": { "Genesis": {...}, ... } }
    If the dict has exactly one key whose value is a dict containing
    what looks like book data, unwrap it.
    """
    if len(bible) != 1:
        return bible
    only_key, only_val = next(iter(bible.items()))
    if not isinstance(only_val, dict):
        return bible
    # If the inner dict's first key looks like a book name (not a digit),
    # treat this as an envelope.
    first_inner = next(iter(only_val.keys()), '')
    if first_inner and not first_inner.isdigit():
        print(f'    Detected single-key envelope "{only_key}", unwrapping.', flush=True)
        return only_val
    return bible


def split_translation(translation: str, translations_dir: Path) -> bool:
    monolith_path = translations_dir / translation / f'{translation}_bible.json'
    if not monolith_path.exists():
        print(f'  SKIP {translation}: {monolith_path} not found', flush=True)
        return False

    print(f'  Loading {monolith_path} ...', flush=True)
    with open(monolith_path, encoding='utf-8') as f:
        bible = json.load(f)

    bible = _unwrap_envelope(bible)
    key_map = _build_key_map(bible)

    out_dir = translations_dir / translation
    search_index = {}
    books_written = 0
    books_missing = []

    for book in BOOK_ORDER:
        result = _resolve(bible, key_map, book)
        if result is None:
            books_missing.append(book)
            continue

        actual_key, chapters = result

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
        # Print actual top-level keys to aid diagnosis
        sample_keys = list(bible.keys())[:20]
        print(f'  WARNING {translation}: missing books: {books_missing}', flush=True)
        print(f'  DEBUG {translation}: top-level keys sample: {sample_keys}', flush=True)

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
