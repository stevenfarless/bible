import csv, json, pathlib, sys, re
from datetime import datetime, timezone

src = pathlib.Path(sys.argv[1])
out_dir = pathlib.Path(sys.argv[2])
out_dir.mkdir(parents=True, exist_ok=True)

translation_root = out_dir.parent  # translations/BSB
translation_root.mkdir(parents=True, exist_ok=True)

COPYRIGHT = "https://bereanbible.com/bsb.txt"
TRANSLATION = "BSB"
VERSION = "1.4.0"
timestamp = datetime.now(timezone.utc).isoformat()

BOOK_ORDER = [
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

books = {}
with src.open("r", encoding="utf-8-sig", newline="") as f:
    reader = csv.reader(f, delimiter="\t")
    for row in reader:
        if not row or row[0] == "Verse":
            continue
        ref = row[0].strip()
        text = row[1].strip() if len(row) > 1 else ""
        m = re.match(r"^(.+?)\s+(\d+):(\d+)$", ref)
        if not m:
            continue
        book, chap, verse = m.group(1), m.group(2), m.group(3)
        books.setdefault(book, {}).setdefault(chap, {})[verse] = text

info = {
    "Copyright": COPYRIGHT,
    "Language": "English",
    "Meaningless": VERSION,
    "Timestamp": timestamp,
    "Translation": TRANSLATION,
}

# Per-book JSON files
for book, chapters in books.items():
    data = {"Info": info, book: chapters}
    (out_dir / f"{book}.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

# Flat combined BSB_bible.json
combined = {"Info": info}
for book in BOOK_ORDER:
    if book in books:
        combined[book] = books[book]
for book in books:
    if book not in combined:
        combined[book] = books[book]

bible_json_path = translation_root / f"{TRANSLATION}_bible.json"
bible_json_path.write_text(
    json.dumps(combined, ensure_ascii=False, indent=2),
    encoding="utf-8",
)

# BSB_bible.sql
def sql_escape(s):
    return s.replace("'", "''")

sql_lines = [
    "CREATE TABLE IF NOT EXISTS verses (",
    "  book TEXT NOT NULL,",
    "  chapter INTEGER NOT NULL,",
    "  verse INTEGER NOT NULL,",
    "  text TEXT NOT NULL,",
    "  PRIMARY KEY (book, chapter, verse)",
    ");",
    "",
    "DELETE FROM verses;",
    "",
]

for book in BOOK_ORDER:
    if book not in books:
        continue
    for chap_str in sorted(books[book].keys(), key=int):
        for verse_str in sorted(books[book][chap_str].keys(), key=int):
            text = sql_escape(books[book][chap_str][verse_str])
            book_esc = sql_escape(book)
            sql_lines.append(
                f"INSERT INTO verses (book, chapter, verse, text) VALUES ('{book_esc}', {chap_str}, {verse_str}, '{text}');"
            )

sql_path = translation_root / f"{TRANSLATION}_bible.sql"
sql_path.write_text("\n".join(sql_lines) + "\n", encoding="utf-8")

print(f"Done. Books: {len(books)}, timestamp: {timestamp}")
