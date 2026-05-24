#!/usr/bin/env python3
"""
build-search-index.py

Builds a flat ref -> normalized-text search index for a given translation
and writes it to Firebase RTDB at /searchIndex/{translation}.

Usage:
    python scripts/build-search-index.py --translation BSB

Requires:
    pip install firebase-admin

Environment / file:
    /tmp/service_account.json  — Firebase service account key JSON
"""

import argparse
import json
import os
import sys
import firebase_admin
from firebase_admin import credentials, db

FIREBASE_DB_URL = "https://esv-bible-6dffb-default-rtdb.firebaseio.com"
SERVICE_ACCOUNT_PATH = "/tmp/service_account.json"

BOOK_LOAD_ORDER = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles",
    "Ezra", "Nehemiah", "Esther", "Job", "Psalm", "Proverbs",
    "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah",
    "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
    "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah",
    "Haggai", "Zechariah", "Malachi", "Matthew", "Mark", "Luke",
    "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians",
    "Galatians", "Ephesians", "Philippians", "Colossians",
    "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy",
    "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter",
    "1 John", "2 John", "3 John", "Jude", "Revelation",
]

BOOK_KEY_ALIASES = {
    "Song of Solomon": "Song Of Solomon",
}


def validate_service_account():
    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        print(f"ERROR: service account file not found at {SERVICE_ACCOUNT_PATH}", file=sys.stderr)
        sys.exit(1)
    try:
        with open(SERVICE_ACCOUNT_PATH) as f:
            sa = json.load(f)
        required = ["type", "project_id", "private_key", "client_email"]
        missing = [k for k in required if not sa.get(k)]
        if missing:
            print(f"ERROR: service account JSON missing fields: {missing}", file=sys.stderr)
            sys.exit(1)
        print(f"  Service account: {sa.get('client_email')} (project: {sa.get('project_id')})")
    except json.JSONDecodeError as e:
        print(f"ERROR: service account file is not valid JSON: {e}", file=sys.stderr)
        sys.exit(1)


def build_index(translation: str) -> dict:
    """Fetch entire translation from RTDB in one call and return a flat ref->text dict."""
    print(f"  Fetching all books for {translation} in one call...", flush=True)

    translation_data = db.reference(f"translations/{translation}").get()

    if translation_data is None:
        # Try shallow fetch to see what keys exist at translations/
        print("  WARNING: translation node returned None. Checking available translations...", flush=True)
        available = db.reference("translations").get(shallow=True)
        if available:
            print(f"  Available translation keys in RTDB: {list(available.keys())}")
        else:
            print("  ERROR: translations/ node also returned None — credentials may be invalid or RTDB rules deny access.")
        return {}

    if not isinstance(translation_data, dict):
        print(f"  ERROR: expected dict at translations/{translation}, got {type(translation_data)}")
        return {}

    print(f"  Top-level keys found: {list(translation_data.keys())[:5]}{'...' if len(translation_data) > 5 else ''}")

    index = {}
    for canonical in BOOK_LOAD_ORDER:
        # Try canonical name, then alias, then case-insensitive match
        book_data = translation_data.get(canonical)
        if book_data is None:
            alias = BOOK_KEY_ALIASES.get(canonical)
            if alias:
                book_data = translation_data.get(alias)
        if book_data is None:
            lower_map = {k.lower(): k for k in translation_data}
            resolved = lower_map.get(canonical.lower())
            if resolved:
                book_data = translation_data[resolved]

        if not book_data or not isinstance(book_data, dict):
            print(f"  SKIP {canonical} (no data)")
            continue

        verse_count = 0
        for chapter_str, chapter_data in book_data.items():
            if not isinstance(chapter_data, dict):
                continue
            for verse_str, text in chapter_data.items():
                if not str(verse_str).isdigit() or int(verse_str) < 1:
                    continue
                ref = f"{canonical} {chapter_str}:{verse_str}"
                index[ref] = str(text or "").lower()
                verse_count += 1

        print(f"  {canonical}: {verse_count} verses")

    return index


def main():
    parser = argparse.ArgumentParser(description="Build RTDB search index for a translation.")
    parser.add_argument("--translation", required=True, help="Translation abbreviation, e.g. BSB")
    args = parser.parse_args()

    translation = args.translation.strip().upper()
    print(f"Building search index for {translation}...")

    validate_service_account()

    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred, {"databaseURL": FIREBASE_DB_URL})

    index = build_index(translation)

    if not index:
        print(f"ERROR: No verses found for {translation}. Aborting.", file=sys.stderr)
        sys.exit(1)

    print(f"\nWriting {len(index)} verse entries to /searchIndex/{translation}...")
    db.reference(f"searchIndex/{translation}").set(index)
    print("Done.")


if __name__ == "__main__":
    main()
