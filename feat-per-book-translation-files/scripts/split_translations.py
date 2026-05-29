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

# Maps canonical name -> known alternate key spellings.
BOOK_KEY_ALIASES = {
    'Song of Solomon': 'Song Of Solomon',
    'Psalm':           'Psalms',
}

_ROMAN = {'i': '1', 'ii': '2', 'iii': '3', 'iv': '4'}


def _normalise(s: str) -> str:
    s = s.lower().strip()
    m = re.match(r'^(i{1,3}v?|iv)\s+', s)
    if m:
        s = _ROMAN.get(m.group(1), m.group(1)) + ' ' + s[m.end():]
    s = re.sub(r'\s+', ' ', s)
    return s


def _build_key_map(bible: dict) -> dict:
    """Return {normalised_key: actual_key} for every key in bible."""
    return {_normalise(k): k for k in bible}


def _is_chapter_dict(data) -> bool:
    """True if data looks like { "1": { "1": "verse text", ... }, ... }."""
    if not isinstance(data, dict) or not data:
        return False
    first_key = next(iter(data))
    if not first_key.isdigit():
        return False
    first_val = data[first_key]
    return isinstance(first_val, dict)


def _unwrap_envelope(bible: dict) -> dict:
    """
    Unwrap a single-key envelope like { "KJV": { "Genesis": {...} } }.
    Only unwraps when the sole value's first key is non-numeric (looks
    like a book name, not a chapter number).
    """
    if len(bible) != 1:
        return bible
    only_key, only_val = next(iter(bible.items()))
    if not isinstance(only_val, dict) or not only_val:
        return bible
    first_inner = next(iter(only_val))
    if not first_inner.isdigit():
        print(f'    Detected single-key envelope "{only_key}", unwrapping.', flush=True)
        return only_val
    return bible


def _remap_numeric_index(bible: dict) -> dict:
    """
    Some monoliths index books by position: { "1": chapters, "2": chapters, ... }
    If ALL top-level keys are digit strings 1..N where N <= 66, remap
    them to canonical book names by position.
    """
    keys = list(bible.keys())
    if not keys or not all(k.isdigit() for k in keys):
        return bible
    indices = sorted(int(k) for k in keys)
    if indices[0] != 1 or indices[-1] > 66:
        return bible
    # Verify values look like chapter dicts before committing.
    first_val = bible[str(indices[0])]
    if not _is_chapter_dict(first_val):
        return bible
    print(f'    Detected numeric book index (1–{indices[-1]}), remapping to canonical names.', flush=True)
    return {BOOK_ORDER[i - 1]: bible[str(i)] for i in indices}


def _resolve(bible: dict, key_map: dict, canonical: str):
    """
    Return (actual_key, chapter_dict) for `canonical`, or None.
    Tries in order:
      1. Exact canonical name
      2. Known alias
      3. Fuzzy normalised match
      4. Upper-case variant (e.g. 'GENESIS')
    """
    candidates = [canonical]
    alias = BOOK_KEY_ALIASES.get(canonical)
    if alias:
        candidates.append(alias)

    norm_canonical = _normalise(canonical)
    fuzzy_key = key_map.get(norm_canonical)
    if fuzzy_key and fuzzy_key not in candidates:
        candidates.append(fuzzy_key)

    upper = canonical.upper()
    if upper not in candidates:
        candidates.append(upper)

    for candidate in candidates:
        if candidate not in bible:
            continue
        data = bible[candidate]
        if not isinstance(data, dict) or not data:
            continue

        first_key = next(iter(data))

        if first_key.isdigit():
            return candidate, data

        # Nested one level: { "BookName": { "1": {...} } }
        first_val = data[first_key]
        if isinstance(first_val, dict):
            nested_first = next(iter(first_val), '')
            if nested_first.isdigit():
                return candidate, first_val

        print(f'    WARNING: unrecognised structure for "{candidate}" '
              f'(first key: "{first_key}"), skipping', flush=True)

    return None


def split_translation(translation: str, translations_dir: Path) -> bool:
    monolith_path = translations_dir / translation / f'{translation}_bible.json'
    if not monolith_path.exists():
        print(f'  SKIP {translation}: {monolith_path} not found', flush=True)
        return False

    print(f'  Loading {monolith_path} ...', flush=True)
    with open(monolith_path, encoding='utf-8') as f:
        bible = json.load(f)

    bible = _unwrap_envelope(bible)
    bible = _remap_numeric_index(bible)
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

        _, chapters = result

        out_path = out_dir / f'{book}.json'
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(chapters, f, ensure_ascii=False, separators=(',', ':'))
        books_written += 1

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

    index_path = out_dir / f'{translation}_search_index.json'
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(search_index, f, ensure_ascii=False, separators=(',', ':'))

    print(f'  {translation}: {books_written}/66 books written, '
          f'{len(search_index)} index entries', flush=True)

    if books_missing:
        sample_keys = list(bible.keys())[:20]
        first_val_sample = next(iter(bible.values()), None)
        first_val_type = type(first_val_sample).__name__
        first_val_first_key = next(iter(first_val_sample), '') if isinstance(first_val_sample, dict) else ''
        print(f'  WARNING {translation}: {len(books_missing)} missing books', flush=True)
        print(f'  DEBUG top-level keys (first 20): {sample_keys}', flush=True)
        print(f'  DEBUG first value: type={first_val_type}, first_key="{first_val_first_key}"', flush=True)

    return True


def main():
    repo_root = Path(__file__).resolve().parent.parent
    translations_dir = repo_root / 'translations'

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
