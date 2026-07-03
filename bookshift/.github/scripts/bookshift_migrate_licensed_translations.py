from __future__ import annotations

import json
import os
import re
import shutil
from pathlib import Path
from typing import Any

import firebase_admin
from firebase_admin import credentials, db

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MAX_NODE_BYTES = 3_500_000

LICENSED_TRANSLATIONS = (
    "CSB",
    "ESV",
    "ISV",
    "LEB",
    "MEV",
    "NET",
    "NIV",
    "NKJV",
    "NLT",
    "NRSVUE",
)

PUBLIC_TRANSLATIONS = (
    "ASV",
    "BLB",
    "BSB",
    "KJV",
    "MSB",
    "WEB",
)

REPO_TRANSLATION_BLOCK = '''const REPO_TRANSLATIONS = new Set([
    "ASV", "BLB", "BSB", "KJV", "MSB", "WEB",
]);'''


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def env_bool(name: str, default: bool = False) -> bool:
    raw = env(name)
    if not raw:
        return default
    return raw.lower() in {"1", "true", "yes", "y", "on"}


def max_node_bytes() -> int:
    raw = env("BOOKSHIFT_MAX_NODE_BYTES")
    return int(raw) if raw else DEFAULT_MAX_NODE_BYTES


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def database_url() -> str:
    configured = env("FIREBASE_DATABASE_URL") or env("FIREBASE_DB_URL")
    if configured:
        return configured

    config_path = ROOT / "firebase-config.js"
    text = config_path.read_text(encoding="utf-8")
    match = re.search(r"FIREBASE_DB_URL\s*=\s*['\"]([^'\"]+)['\"]", text)
    if not match:
        raise RuntimeError("Could not determine FIREBASE_DB_URL.")
    return match.group(1)


def firebase_key(value: str) -> str:
    return re.sub(r"[.#$\[\]/]", "_", value)


def init_firebase() -> None:
    if firebase_admin._apps:
        return

    credential_path = Path(env("GOOGLE_APPLICATION_CREDENTIALS", "/tmp/service_account.json"))
    if not credential_path.exists():
        raise RuntimeError(
            f"Firebase service account file not found: {credential_path}"
        )

    cred = credentials.Certificate(str(credential_path))
    firebase_admin.initialize_app(cred, {"databaseURL": database_url()})


def node_size(value: Any) -> int:
    return len(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))


def set_node(ref: db.Reference, value: Any, label: str) -> None:
    size = node_size(value)
    limit = max_node_bytes()
    if size > limit:
        raise RuntimeError(
            f"/{label} is {size:,} bytes, which exceeds the Bookshift "
            f"single-node limit of {limit:,} bytes."
        )
    ref.set(value)
    print(f"  wrote {label} ({size:,} bytes)")


def catalog_with_access_flags() -> list[dict[str, Any]]:
    catalog_path = ROOT / "translations" / "index.json"
    catalog = load_json(catalog_path)
    translations = catalog.get("translations")
    if not isinstance(translations, list):
        raise RuntimeError("translations/index.json does not contain a translations list.")

    updated: list[dict[str, Any]] = []
    for entry in translations:
        item = dict(entry)
        translation_id = str(item.get("id", "")).upper()
        if translation_id in LICENSED_TRANSLATIONS:
            item["access"] = "licensed"
        elif translation_id in PUBLIC_TRANSLATIONS:
            item["access"] = "public"
        updated.append(item)
    return updated


def upload_catalog() -> None:
    translations = catalog_with_access_flags()
    set_node(db.reference("translationIndex"), translations, "translationIndex")
    set_node(
        db.reference("publicTranslations"),
        {translation: True for translation in PUBLIC_TRANSLATIONS},
        "publicTranslations",
    )
    set_node(
        db.reference("licensedTranslations"),
        {translation: True for translation in LICENSED_TRANSLATIONS},
        "licensedTranslations",
    )


def local_json_files(translation: str) -> list[Path]:
    trans_dir = ROOT / "translations" / translation
    if not trans_dir.is_dir():
        raise RuntimeError(f"Missing translation directory: {trans_dir}")

    json_files = sorted(trans_dir.glob("*.json"))
    if not json_files:
        raise RuntimeError(f"No JSON files found in {trans_dir}")
    return json_files


def has_local_meta(translation: str) -> bool:
    return ROOT.joinpath("translations", translation, "meta.json").exists()


def firebase_translation_key(path: Path, translation: str) -> str:
    if path.name == "meta.json":
        return "meta"
    stem = path.stem
    if path.name == f"{translation}_search_index.json" or stem.endswith("_search_index"):
        return ""
    return firebase_key(stem)


def upload_translation(translation: str) -> None:
    print(f"\n=== Uploading {translation} ===")
    uploaded_any = False
    for path in local_json_files(translation):
        data = load_json(path)
        key = firebase_translation_key(path, translation)
        if key:
            set_node(
                db.reference(f"translations/{translation}/{key}"),
                data,
                f"translations/{translation}/{key}",
            )
        else:
            set_node(db.reference(f"searchIndex/{translation}"), data, f"searchIndex/{translation}")
        uploaded_any = True

    if not uploaded_any:
        raise RuntimeError(f"Nothing uploaded for {translation}")


def first_required_book_file(translation: str) -> Path:
    for path in local_json_files(translation):
        if path.name == "meta.json":
            continue
        if path.name == f"{translation}_search_index.json" or path.stem.endswith("_search_index"):
            continue
        return path
    raise RuntimeError(f"No book JSON file found for {translation}")


def verify_translation_upload(translation: str) -> None:
    print(f"\n=== Verifying {translation} ===")
    first_book = first_required_book_file(translation)
    checks = [
        (f"translations/{translation}/{firebase_key(first_book.stem)}", True),
    ]

    if has_local_meta(translation):
        checks.insert(0, (f"translations/{translation}/meta", True))

    search_index = ROOT / "translations" / translation / f"{translation}_search_index.json"
    if search_index.exists():
        checks.append((f"searchIndex/{translation}", False))

    for path, require_mapping in checks:
        value = db.reference(path).get()
        if value is None:
            raise RuntimeError(f"Firebase verification failed: missing /{path}")
        if require_mapping and not isinstance(value, dict):
            raise RuntimeError(f"Firebase verification failed: /{path} is not an object")
        print(f"  verified /{path}")


def translation_index_entries(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        return [item for item in value.values() if isinstance(item, dict)]
    return []


def verify_catalog_upload() -> None:
    print("\n=== Verifying catalog nodes ===")
    index = db.reference("translationIndex").get()
    entries = translation_index_entries(index)
    if not entries:
        raise RuntimeError("Firebase verification failed: /translationIndex is missing or empty")

    indexed_ids = {str(item.get("id", "")).upper() for item in entries}
    missing = [translation for translation in LICENSED_TRANSLATIONS if translation not in indexed_ids]
    if missing:
        raise RuntimeError(
            "Firebase verification failed: /translationIndex missing " + ", ".join(missing)
        )
    print("  verified /translationIndex")

    public_map = db.reference("publicTranslations").get()
    if not isinstance(public_map, dict):
        raise RuntimeError("Firebase verification failed: /publicTranslations is missing")
    for translation in PUBLIC_TRANSLATIONS:
        if public_map.get(translation) is not True:
            raise RuntimeError(f"Firebase verification failed: /publicTranslations/{translation}")
    print("  verified /publicTranslations")

    licensed_map = db.reference("licensedTranslations").get()
    if not isinstance(licensed_map, dict):
        raise RuntimeError("Firebase verification failed: /licensedTranslations is missing")
    for translation in LICENSED_TRANSLATIONS:
        if licensed_map.get(translation) is not True:
            raise RuntimeError(f"Firebase verification failed: /licensedTranslations/{translation}")
    print("  verified /licensedTranslations")


def verify_uploads() -> None:
    for translation in LICENSED_TRANSLATIONS:
        verify_translation_upload(translation)
    verify_catalog_upload()
    print("\nFirebase verification passed.")


def patch_bible_api() -> None:
    path = ROOT / "bible-api.js"
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        "const FIREBASE_TRANSLATIONS_ENABLED = false;",
        "const FIREBASE_TRANSLATIONS_ENABLED = true;",
    )

    patched = re.sub(
        r"const REPO_TRANSLATIONS = new Set\(\[.*?\]\);",
        REPO_TRANSLATION_BLOCK,
        text,
        count=1,
        flags=re.S,
    )
    if patched == text and REPO_TRANSLATION_BLOCK not in text:
        raise RuntimeError("Could not patch REPO_TRANSLATIONS in bible-api.js")

    path.write_text(patched, encoding="utf-8")
    print("Patched bible-api.js for Firebase-backed licensed translations.")


def patch_translation_index() -> None:
    path = ROOT / "translations" / "index.json"
    catalog = load_json(path)
    catalog["translations"] = catalog_with_access_flags()
    write_json(path, catalog)
    print("Tagged translations/index.json entries with access values.")


def remove_local_licensed_text(translation: str, keep_meta: bool) -> None:
    trans_dir = ROOT / "translations" / translation
    if not trans_dir.exists():
        print(f"Skipping cleanup for missing {trans_dir}")
        return

    print(f"\n=== Cleaning {translation} ===")
    if not keep_meta:
        shutil.rmtree(trans_dir)
        print(f"  removed {trans_dir}")
        return

    removed = 0
    for path in sorted(trans_dir.glob("*.json")):
        if path.name == "meta.json":
            print("  kept meta.json")
            continue
        path.unlink()
        removed += 1
        print(f"  removed {path.relative_to(ROOT)}")

    if removed == 0:
        print("  no text-bearing JSON files needed removal")


def cleanup_repository(keep_meta: bool) -> None:
    patch_bible_api()
    patch_translation_index()
    for translation in LICENSED_TRANSLATIONS:
        remove_local_licensed_text(translation, keep_meta)


def print_plan(keep_meta: bool) -> None:
    print("Bookshift migration plan")
    print(f"  translations: {', '.join(LICENSED_TRANSLATIONS)}")
    print(f"  keep meta.json locally: {keep_meta}")
    print("  upload book JSON files to /translations/<ID>/<Book>")
    print("  upload meta.json to /translations/<ID>/meta when present")
    print("  upload search indexes to /searchIndex/<ID>")
    print("  upload access-tagged catalog to /translationIndex")
    print("  upload public/ licensed translation maps")
    print("  verify Firebase contains the uploaded translation and catalog nodes")
    print("  full-migration mode also:")
    print("    enable Firebase translation loading in bible-api.js")
    print("    reduce REPO_TRANSLATIONS to public/free translations")
    print("    remove licensed text-bearing JSON files from GitHub")


def upload_all() -> None:
    for translation in LICENSED_TRANSLATIONS:
        upload_translation(translation)
    upload_catalog()


def run() -> None:
    mode = env("BOOKSHIFT_MODE", "plan")
    keep_meta = env_bool("BOOKSHIFT_KEEP_META", True)

    if mode not in {"plan", "verify-only", "full-migration"}:
        raise RuntimeError(f"Unsupported BOOKSHIFT_MODE: {mode}")

    print_plan(keep_meta)
    if mode == "plan":
        return

    init_firebase()

    if mode == "verify-only":
        verify_uploads()
        return

    upload_all()
    verify_uploads()
    cleanup_repository(keep_meta)
    print("\nBookshift migration finished.")


if __name__ == "__main__":
    run()
