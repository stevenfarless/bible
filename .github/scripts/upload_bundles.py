import os
import json
import glob
import firebase_admin
from firebase_admin import credentials, db

MAX_BYTES = 3_500_000  # conservative limit under RTDB's ~4MB write cap

cred = credentials.Certificate("/tmp/service_account.json")
firebase_admin.initialize_app(cred, {
    "databaseURL": "https://esv-bible-6dffb-default-rtdb.firebaseio.com"
})

target = os.environ.get("TARGET_TRANSLATION", "").strip().upper()

bundle_files = sorted(glob.glob("bundles/*_bundle.json"))

if not bundle_files:
    print("No bundle files found in bundles/.")
    raise SystemExit(1)


def write_index(ref, index):
    """Write index in chunks small enough for RTDB, keyed by word prefix."""
    # Group by 2-char prefix
    chunks = {}
    for word, refs in index.items():
        prefix = (word[:2] if len(word) >= 2 else word + "_").lower()
        if prefix not in chunks:
            chunks[prefix] = {}
        chunks[prefix][word] = refs

    for prefix, chunk in sorted(chunks.items()):
        size = len(json.dumps(chunk))
        if size > MAX_BYTES:
            # Still too big — fall back to writing one word at a time
            print(f"    chunk '{prefix}' is {size:,} bytes — writing word by word")
            for word, refs in chunk.items():
                ref.child(prefix).child(word).set(refs)
        else:
            ref.child(prefix).set(chunk)

    print(f"    wrote index in {len(chunks)} chunks")


for bundle_path in bundle_files:
    filename = os.path.basename(bundle_path)
    abbr = filename.replace("_bundle.json", "").upper()

    if target and abbr != target:
        print(f"Skipping {filename}")
        continue

    print(f"\n=== {abbr} ===")
    with open(bundle_path, "r", encoding="utf-8") as f:
        bundle = json.load(f)

    ref = db.reference(f"bundles/{abbr}")

    for key, value in bundle.items():
        size = len(json.dumps(value))
        print(f"  Writing {key} ({size:,} bytes)...")

        if key == "books":
            for book_key, book_data in value.items():
                ref.child("books").child(book_key).set(book_data)
            print(f"    wrote {len(value)} books individually")

        elif key == "index":
            write_index(ref.child("index"), value)

        else:
            ref.child(key).set(value)

    print(f"  Done.")

print("\nAll done.")
