import os
import json
import glob
import firebase_admin
from firebase_admin import credentials, db

cred = credentials.Certificate("/tmp/service_account.json")
firebase_admin.initialize_app(cred, {
    "databaseURL": "https://esv-bible-6dffb-default-rtdb.firebaseio.com"
})

target = os.environ.get("TARGET_TRANSLATION", "").strip().upper()

bundle_files = sorted(glob.glob("bundles/*_bundle.json"))

if not bundle_files:
    print("No bundle files found in bundles/.")
    raise SystemExit(1)

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
            # write one book at a time
            for book_key, book_data in value.items():
                ref.child("books").child(book_key).set(book_data)
            print(f"    wrote {len(value)} books individually")

        elif key == "index":
            # group by first character of each word key
            chunks = {}
            for word, refs in value.items():
                bucket = word[0].lower() if word else "_"
                if bucket not in chunks:
                    chunks[bucket] = {}
                chunks[bucket][word] = refs
            for bucket, chunk in sorted(chunks.items()):
                ref.child("index").child(bucket).set(chunk)
            print(f"    wrote index in {len(chunks)} chunks")

        else:
            ref.child(key).set(value)

    print(f"  Done.")

print("\nAll done.")
