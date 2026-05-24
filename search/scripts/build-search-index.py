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
    """Fetch each book individually from RTDB and return a flat ref->text dict."""
    index = {}
    translation_ref = db.reference(f"translations/{translation}")

    for book in BOOK_LOAD_ORDER:
        book_data = translation_ref.child(book).get()

        if not book_data or not isinstance(book_data, dict):
            print(f"  SKIP {book} (no data or unexpected type: {type(book_data).__name__})")
            continue

        verse_count = 0
        for ch_key, chapter_data in book_data.items():
            if not isinstance(chapter_data, dict):
                continue
            # Firebase may return integer keys or string keys
            ch_str = str(ch_key)
            for v_key, text in chapter_data.items():
                v_str = str(v_key)
                if not v_str.isdigit() or int(v_str) < 1:
                    continue
                if not text:
                    continue
                ref = f"{book} {ch_str}:{v_str}"
                index[ref] = str(text).lower()
                verse_count += 1

        print(f"  {book}: {verse_count} verses", flush=True)

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

    print(f"\nTotal verses indexed: {len(index)}")
    print(f"Writing to /searchIndex/{translation}...")
    db.reference(f"searchIndex/{translation}").set(index)
    print("Done.")


if __name__ == "__main__":
    main()
