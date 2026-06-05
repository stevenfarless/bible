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

    print(f"Loading {filename}...")
    with open(bundle_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Uploading to bundles/{abbr}...")
    db.reference(f"bundles/{abbr}").set(data)
    print(f"  Done.")

print("\nAll done.")
