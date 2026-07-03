#!/usr/bin/env python3
"""Move licensed translation payloads from the repository to Firebase.

The workflow that calls this script is intentionally scoped to the bookshift
branch. It uploads licensed translation JSON to Firebase Realtime Database,
uploads search indexes to the path used by bible-api.js, and then removes
text-bearing licensed files from the branch checkout.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import sys
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, db


LICENSED_TRANSLATIONS = {
    "CSB", "ESV", "ISV", "LEB", "MEV", "NET", "NIV", "NKJV", "NLT", "NRSVUE",
}

PUBLIC_REPO_TRANSLATIONS = ["ASV", "BLB", "BSB", "KJV", "MSB", "WEB"]
DEFAULT_DATABASE_URL = "https://esv-bible-6dffb-default-rtdb.firebaseio.com"


def read_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


def parse_targets(raw: str) -> list[str]:
    parts = [part.strip().upper() for part in re.split(r"[\s,]+", raw or "") if part.strip()]
    if not parts:
        return sorted(LICENSED_TRANSLATIONS)

    unknown = [part for part in parts if part not in LICENSED_TRANSLATIONS]
    if unknown:
        allowed = ", ".join(sorted(LICENSED_TRANSLATIONS))
        raise SystemExit(f"Unsupported licensed translation(s): {', '.join(unknown)}. Allowed: {allowed}")

    return sorted(dict.fromkeys(parts))


def load_json(path: Path):
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def init_firebase(dry_run: bool) -> None:
    if dry_run:
        print("Dry run: Firebase writes are disabled.")
        return

    service_account_path = Path(os.environ.get("FIREBASE_SERVICE_ACCOUNT_FILE", "/tmp/service_account.json"))
    if not service_account_path.exists():
        raise SystemExit(f"Missing Firebase service account file: {service_account_path}")

    database_url = os.environ.get("FIREBASE_DATABASE_URL", DEFAULT_DATABASE_URL).strip() or DEFAULT_DATABASE_URL

    if not firebase_admin._apps:
        cred = credentials.Certificate(str(service_account_path))
        firebase_admin.initialize_app(cred, {"databaseURL": database_url})

    print(f"Firebase database: {database_url}")


def collect_translation_payload(translation: str) -> dict:
    trans_dir = Path("translations") / translation
    if not trans_dir.is_dir():
        raise SystemExit(f"Missing translation directory: {trans_dir}")

    payload = {}

    for file_path in sorted(trans_dir.glob("*.json")):
        if file_path.name == f"{translation}_search_index.json":
            continue

        payload[file_path.stem] = load_json(file_path)
        print(f"  loaded {file_path}")

    for subdir in sorted(path for path in trans_dir.iterdir() if path.is_dir()):
        sub_payload = {}
        for file_path in sorted(subdir.glob("*.json")):
            sub_payload[file_path.stem] = load_json(file_path)
            print(f"  loaded {file_path}")

        if sub_payload:
            payload[subdir.name] = sub_payload

    if not payload:
        raise SystemExit(f"No uploadable JSON files found for {translation}.")

    return payload


def upload_translation(translation: str, dry_run: bool) -> None:
    print(f"\n=== {translation} ===")
    payload = collect_translation_payload(translation)

    search_path = Path("translations") / translation / f"{translation}_search_index.json"
    search_payload = load_json(search_path) if search_path.exists() else None

    if dry_run:
        print(f"Dry run: would upload /translations/{translation} with {len(payload)} keys.")
        if search_payload is not None:
            print(f"Dry run: would upload /searchIndex/{translation}.")
        return

    db.reference(f"translations/{translation}").set(payload)
    print(f"Uploaded /translations/{translation} with {len(payload)} keys.")

    if search_payload is not None:
        db.reference(f"searchIndex/{translation}").set(search_payload)
        print(f"Uploaded /searchIndex/{translation}.")
    else:
        print(f"No search index found for {translation}.")


def upload_translation_index(dry_run: bool) -> None:
    catalog_path = Path("translations/index.json")
    catalog = load_json(catalog_path)
    translations = catalog.get("translations", [])

    index = []
    for entry in translations:
        translation_id = entry.get("id")
        if translation_id in LICENSED_TRANSLATIONS:
            index.append(entry)

    if dry_run:
        print(f"Dry run: would upload /translationIndex with {len(index)} licensed entries.")
        return

    db.reference("translationIndex").set(index)
    print(f"Uploaded /translationIndex with {len(index)} licensed entries.")


def mark_catalog_access() -> None:
    catalog_path = Path("translations/index.json")
    catalog = load_json(catalog_path)

    changed = False
    for entry in catalog.get("translations", []):
        translation_id = entry.get("id")
        if translation_id in LICENSED_TRANSLATIONS and entry.get("access") != "licensed":
            entry["access"] = "licensed"
            changed = True

    if changed:
        write_json(catalog_path, catalog)
        print("Marked licensed translations in translations/index.json.")
    else:
        print("translations/index.json already has licensed access markers.")


def patch_bible_api_routing() -> None:
    path = Path("bible-api.js")
    text = path.read_text(encoding="utf-8")

    next_text = text.replace(
        "const FIREBASE_TRANSLATIONS_ENABLED = false;",
        "const FIREBASE_TRANSLATIONS_ENABLED = true;",
    )

    repo_set = (
        "const REPO_TRANSLATIONS = new Set([\n"
        f"    {', '.join(json.dumps(item) for item in PUBLIC_REPO_TRANSLATIONS)},\n"
        "]);"
    )

    next_text, replacements = re.subn(
        r"const REPO_TRANSLATIONS = new Set\(\[\n.*?\n\]\);",
        repo_set,
        next_text,
        count=1,
        flags=re.S,
    )

    if replacements != 1:
        raise SystemExit("Could not patch REPO_TRANSLATIONS in bible-api.js.")

    if next_text != text:
        path.write_text(next_text, encoding="utf-8")
        print("Patched bible-api.js to route licensed translations through Firebase.")
    else:
        print("bible-api.js routing already patched.")


def remove_local_text_files(translation: str, preserve_meta: bool) -> None:
    trans_dir = Path("translations") / translation
    if not trans_dir.is_dir():
        return

    removed = 0

    for child in sorted(trans_dir.iterdir()):
        if preserve_meta and child.is_file() and child.name == "meta.json":
            continue

        if child.is_dir():
            shutil.rmtree(child)
            removed += 1
        else:
            child.unlink()
            removed += 1

    if not any(trans_dir.iterdir()):
        trans_dir.rmdir()

    print(f"Removed {removed} local text-bearing item(s) from {trans_dir}.")


def main() -> None:
    targets = parse_targets(os.environ.get("TARGET_TRANSLATIONS", ""))
    dry_run = read_bool("DRY_RUN", False)
    remove_from_branch = read_bool("REMOVE_TEXT_FROM_BRANCH", True)
    preserve_meta = read_bool("PRESERVE_META", True)

    print(f"Target licensed translations: {', '.join(targets)}")
    print(f"Remove local text after upload: {remove_from_branch}")
    print(f"Preserve meta.json locally: {preserve_meta}")

    init_firebase(dry_run)

    for translation in targets:
        upload_translation(translation, dry_run)

    upload_translation_index(dry_run)

    if remove_from_branch and not dry_run:
        mark_catalog_access()
        patch_bible_api_routing()
        for translation in targets:
            remove_local_text_files(translation, preserve_meta)
    elif remove_from_branch:
        print("Dry run: would patch routing, mark catalog access, and remove local licensed text files.")

    print("\nBookshift migration step complete.")


if __name__ == "__main__":
    main()
