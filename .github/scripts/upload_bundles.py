import os
import glob
import firebase_admin
from firebase_admin import credentials, storage

cred = credentials.Certificate("/tmp/service_account.json")
firebase_admin.initialize_app(cred, {
    "storageBucket": "esv-bible-6dffb.firebasestorage.app"
})

bucket = storage.bucket()
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

    dest = f"bundles/{filename}"
    print(f"Uploading {bundle_path} → {dest}")
    blob = bucket.blob(dest)
    blob.upload_from_filename(bundle_path, content_type="application/json")
    blob.make_public()
    print(f"  Done. Public URL: {blob.public_url}")

print("\nAll done.")
