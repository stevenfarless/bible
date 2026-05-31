import json
import os
import re
import time
import requests
from bs4 import BeautifulSoup

APOCRYPHA_BOOKS = [
    "Tobit",
    "Judith",
    "1 Maccabees",
    "2 Maccabees",
    "3 Maccabees",
    "4 Maccabees",
    "1 Esdras",
    "2 Esdras",
    "Wisdom of Solomon",
    "Sirach",
    "Baruch",
    "Letter of Jeremiah",
    "Prayer of Azariah",
    "Susanna",
    "Bel and the Dragon",
    "Prayer of Manasseh",
    "Psalm 151",
    "Additions to Esther",
]

BG_SLUG = {
    "Tobit": "Tobit",
    "Judith": "Judith",
    "1 Maccabees": "1+Maccabees",
    "2 Maccabees": "2+Maccabees",
    "3 Maccabees": "3+Maccabees",
    "4 Maccabees": "4+Maccabees",
    "1 Esdras": "1+Esdras",
    "2 Esdras": "2+Esdras",
    "Wisdom of Solomon": "Wisdom+of+Solomon",
    "Sirach": "Sirach",
    "Baruch": "Baruch",
    "Letter of Jeremiah": "Letter+of+Jeremiah",
    "Prayer of Azariah": "Prayer+of+Azariah",
    "Susanna": "Susanna",
    "Bel and the Dragon": "Bel+and+the+Dragon",
    "Prayer of Manasseh": "Prayer+of+Manasseh",
    "Psalm 151": "Psalm+151",
    "Additions to Esther": "Additions+to+Esther",
}

CHAPTER_COUNTS = {
    "Tobit": 14,
    "Judith": 16,
    "1 Maccabees": 16,
    "2 Maccabees": 15,
    "3 Maccabees": 7,
    "4 Maccabees": 18,
    "1 Esdras": 9,
    "2 Esdras": 16,
    "Wisdom of Solomon": 19,
    "Sirach": 51,
    "Baruch": 5,
    "Letter of Jeremiah": 1,
    "Prayer of Azariah": 1,
    "Susanna": 1,
    "Bel and the Dragon": 1,
    "Prayer of Manasseh": 1,
    "Psalm 151": 1,
    "Additions to Esther": 1,
}

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; Bible research tool)"}


def scrape_bg_chapter(book_slug, chapter, version):
    url = f"https://www.biblegateway.com/passage/?search={book_slug}+{chapter}&version={version}&interface=print"
    r = requests.get(url, headers=HEADERS, timeout=30)
    if r.status_code != 200:
        print(f"  HTTP {r.status_code} for {book_slug} {chapter} ({version})")
        return {}
    soup = BeautifulSoup(r.text, "lxml")
    verses = {}
    for span in soup.select("span.text"):
        cls = span.get("class", [])
        verse_cls = [c for c in cls if re.match(r'.+-\d+-\d+$', c)]
        if not verse_cls:
            continue
        parts = verse_cls[0].rsplit("-", 2)
        if len(parts) < 3:
            continue
        try:
            v_num = str(int(parts[2]))
        except ValueError:
            continue
        for sup in span.find_all(["sup", "a"]):
            sup.decompose()
        text = span.get_text(" ", strip=True)
        if text:
            verses[v_num] = (verses.get(v_num, "") + " " + text).strip() if v_num in verses else text
    return {k: " ".join(v.split()) for k, v in verses.items()}


def fetch_bg_book(book, version):
    slug = BG_SLUG.get(book, book.replace(" ", "+"))
    chapters = CHAPTER_COUNTS.get(book, 1)
    result = {}
    for ch in range(1, chapters + 1):
        print(f"  {version} {book} ch{ch}...")
        verses = scrape_bg_chapter(slug, ch, version)
        if verses:
            result[str(ch)] = verses
        time.sleep(1.2)
    return result


def fetch_web_book(book):
    BOLLS_WEBBE_BOOKS = {
        "Tobit": 68, "Judith": 69, "1 Maccabees": 74, "2 Maccabees": 75,
        "3 Maccabees": 76, "4 Maccabees": 77, "1 Esdras": 66, "2 Esdras": 67,
        "Wisdom of Solomon": 70, "Sirach": 71, "Baruch": 72,
        "Letter of Jeremiah": 73, "Prayer of Azariah": 79, "Susanna": 80,
        "Bel and the Dragon": 81, "Prayer of Manasseh": 78,
        "Psalm 151": 82, "Additions to Esther": 83,
    }
    book_num = BOLLS_WEBBE_BOOKS.get(book)
    if not book_num:
        return None
    url = f"https://bolls.life/get-text/WEBBE/{book_num}/"
    r = requests.get(url, headers=HEADERS, timeout=30)
    if r.status_code != 200:
        print(f"  bolls WEBBE fetch failed for {book}: HTTP {r.status_code}")
        return None
    verses = r.json()
    result = {}
    for v in verses:
        ch = str(v["chapter"])
        vn = str(v["verse"])
        result.setdefault(ch, {})[vn] = v["text"]
    return result or None


TRANSLATION_FETCHERS = {
    "KJV": lambda book: fetch_bg_book(book, "KJV"),
    "WEB": fetch_web_book,
    "NRSVUE": lambda book: fetch_bg_book(book, "NRSVUE"),
    "ESV": lambda book: fetch_bg_book(book, "ESV"),
}

existing_translations = [
    d for d in os.listdir("translations")
    if os.path.isdir(f"translations/{d}")
]
print(f"Found translations: {existing_translations}")

for translation, fetcher in TRANSLATION_FETCHERS.items():
    if translation not in existing_translations:
        print(f"Skipping {translation} - not in this branch")
        continue
    print(f"\n=== {translation} ===")
    for book in APOCRYPHA_BOOKS:
        out_path = f"translations/{translation}/{book}.json"
        if os.path.exists(out_path):
            print(f"  {book} already exists, skipping")
            continue
        print(f"  Fetching {book}...")
        try:
            data = fetcher(book)
        except Exception as e:
            print(f"  ERROR fetching {book}: {e}")
            continue
        if not data:
            print(f"  No data for {book}, skipping")
            continue
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        print(f"  Wrote {out_path}")

print("\nDone.")
