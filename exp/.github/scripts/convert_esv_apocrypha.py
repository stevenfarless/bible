import zipfile
import json
import os
import re
import sys
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
import warnings
warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

EPUB_PATH = "esv-with-apocrypha.epub"
OUT_DIR = "translations/ESV"
META_PATH = os.path.join(OUT_DIR, "meta.json")
INFO_PATH = os.path.join(OUT_DIR, "info.json")

BOOK_NAME_MAP = {
    "tobit": "Tobit",
    "judith": "Judith",
    "additions to esther": "Additions to Esther",
    "the additions to esther": "Additions to Esther",
    "wisdom of solomon": "Wisdom of Solomon",
    "the wisdom of solomon": "Wisdom of Solomon",
    "sirach": "Sirach",
    "ecclesiasticus": "Sirach",
    "baruch": "Baruch",
    "letter of jeremiah": "Letter of Jeremiah",
    "the letter of jeremiah": "Letter of Jeremiah",
    "prayer of azariah": "Prayer of Azariah",
    "the prayer of azariah": "Prayer of Azariah",
    "susanna": "Susanna",
    "bel and the dragon": "Bel and the Dragon",
    "1 maccabees": "1 Maccabees",
    "first maccabees": "1 Maccabees",
    "2 maccabees": "2 Maccabees",
    "second maccabees": "2 Maccabees",
    "1 esdras": "1 Esdras",
    "first esdras": "1 Esdras",
    "2 esdras": "2 Esdras",
    "second esdras": "2 Esdras",
    "prayer of manasseh": "Prayer of Manasseh",
    "the prayer of manasseh": "Prayer of Manasseh",
    "psalm 151": "Psalm 151",
    "3 maccabees": "3 Maccabees",
    "third maccabees": "3 Maccabees",
    "4 maccabees": "4 Maccabees",
    "fourth maccabees": "4 Maccabees",
}

CANON_66 = {
    "genesis", "exodus", "leviticus", "numbers", "numeri", "deuteronomy",
    "joshua", "judges", "ruth", "1 samuel", "2 samuel", "1 kings", "2 kings",
    "1 chronicles", "2 chronicles", "ezra", "nehemiah", "esther", "job",
    "psalms", "psalm", "proverbs", "ecclesiastes", "song of solomon",
    "song of songs", "isaiah", "jeremiah", "lamentations", "ezekiel",
    "daniel", "hosea", "joel", "amos", "obadiah", "jonah", "micah",
    "nahum", "habakkuk", "habbakuk", "zephaniah", "haggai", "zechariah",
    "malachi", "matthew", "mark", "luke", "john", "acts", "romans",
    "1 corinthians", "2 corinthians", "galatians", "ephesians",
    "philippians", "colossians", "1 thessalonians", "2 thessalonians",
    "1 timothy", "2 timothy", "titus", "philemon", "hebrews", "james",
    "1 peter", "2 peter", "1 john", "2 john", "3 john", "jude", "revelation",
}


def normalize(s):
    return re.sub(r'\s+', ' ', s.strip().lower())


def flush(bd, ch, v, text):
    if ch and v and text:
        combined = " ".join(text).strip()
        if combined:
            bd.setdefault(str(ch), {})[str(v)] = combined


def extract_verses(soup):
    book_data = {}
    current_chapter = None
    current_verse = None
    current_text = []

    body = soup.find('body') or soup

    for el in body.descendants:
        if not hasattr(el, 'name'):
            continue
        tag = el.name
        cls = ' '.join(el.get('class', []))

        if tag in ('h1', 'h2', 'h3', 'h4'):
            text_content = el.get_text(' ', strip=True)
            m = re.search(r'chapter\s+(\d+)|^(\d+)$', text_content.lower())
            if m:
                flush(book_data, current_chapter, current_verse, current_text)
                current_chapter = int(m.group(1) or m.group(2))
                current_verse = None
                current_text = []
                continue

        if tag in ('sup', 'b', 'span') and re.search(r'verse|verse-num|vn|\bv\b', cls, re.I):
            text_content = el.get_text(strip=True)
            m = re.match(r'^(\d+)$', text_content)
            if m:
                flush(book_data, current_chapter, current_verse, current_text)
                current_verse = int(m.group(1))
                current_text = []
                continue

    if not book_data:
        current_chapter = 1
        current_verse = None
        buffer = []

        for el in body.descendants:
            if not hasattr(el, 'name'):
                text = str(el).strip()
                if text and current_verse is not None:
                    buffer.append(text)
                continue

            tag = el.name
            cls = ' '.join(el.get('class', []))

            if tag in ('h1', 'h2', 'h3', 'h4'):
                tc = el.get_text(' ', strip=True)
                m = re.search(r'chapter\s+(\d+)|^(\d+)$', tc.lower())
                if m:
                    flush(book_data, current_chapter, current_verse, buffer)
                    current_chapter = int(m.group(1) or m.group(2))
                    current_verse = None
                    buffer = []

            elif tag in ('sup', 'b', 'span', 'a') and re.search(r'verse|vn|verse-num|\bv\b', cls, re.I):
                tc = el.get_text(strip=True)
                m = re.match(r'^(\d+)$', tc)
                if m:
                    flush(book_data, current_chapter, current_verse, buffer)
                    current_verse = int(m.group(1))
                    buffer = []

        flush(book_data, current_chapter, current_verse, buffer)

    return book_data


def parse_epub(epub_path):
    results = {}

    with zipfile.ZipFile(epub_path, 'r') as z:
        names = z.namelist()

        print("\n=== ALL FILES IN EPUB ===")
        for n in sorted(names):
            print(f"  {n}")

        opf_path = None
        for n in names:
            if n.endswith('.opf'):
                opf_path = n
                break

        if not opf_path and 'META-INF/container.xml' in names:
            cont = BeautifulSoup(z.read('META-INF/container.xml'), 'xml')
            rootfile = cont.find('rootfile')
            if rootfile:
                opf_path = rootfile.get('full-path')

        print(f"\n=== OPF: {opf_path} ===")
        if opf_path:
            print(z.read(opf_path).decode('utf-8', errors='replace')[:6000])

        spine_items = []
        opf_base = ''
        if opf_path:
            opf_base = '/'.join(opf_path.split('/')[:-1])
            if opf_base:
                opf_base += '/'
            opf_soup = BeautifulSoup(z.read(opf_path), 'xml')
            manifest = {}
            for item in opf_soup.find_all('item'):
                manifest[item.get('id')] = {
                    'href': item.get('href', ''),
                    'media-type': item.get('media-type', ''),
                }
            spine = opf_soup.find('spine')
            if spine:
                for itemref in spine.find_all('itemref'):
                    idref = itemref.get('idref')
                    if idref in manifest:
                        spine_items.append(manifest[idref])

        if not spine_items:
            spine_items = [
                {'href': n, 'media-type': 'application/xhtml+xml'}
                for n in names if n.endswith(('.xhtml', '.html', '.htm'))
            ]

        print(f"\n=== SPINE ({len(spine_items)} items) ===")
        for item in spine_items:
            print(f"  {item['href']}")

        current_book_name = None
        current_book_data = {}

        for item in spine_items:
            href = item['href']
            full_path = (opf_base + href) if not href.startswith('/') else href.lstrip('/')
            full_path = os.path.normpath(full_path).replace('\\', '/')

            if full_path not in names:
                if href in names:
                    full_path = href
                else:
                    continue

            if not any(full_path.endswith(ext) for ext in ('.xhtml', '.html', '.htm')):
                continue

            content = z.read(full_path)
            soup = BeautifulSoup(content, 'lxml')

            h1_tag = soup.find('h1')
            title_tag = soup.find('title')
            if h1_tag:
                page_title = normalize(h1_tag.get_text())
            elif title_tag:
                page_title = normalize(title_tag.get_text())
            else:
                page_title = normalize(
                    os.path.basename(href).replace('.xhtml', '').replace('.html', '')
                )

            matched_book = None
            for key, canonical in BOOK_NAME_MAP.items():
                if key in page_title:
                    matched_book = canonical
                    break

            is_canon = any(c in page_title for c in CANON_66)

            if matched_book:
                if current_book_name and current_book_data:
                    results.setdefault(current_book_name, {})
                    for ch, vv in current_book_data.items():
                        results[current_book_name].setdefault(ch, {}).update(vv)
                current_book_name = matched_book
                current_book_data = {}
                print(f"  -> book: {matched_book} (file={href!r} title={page_title!r})")

            if current_book_name and not is_canon:
                chapter_data = extract_verses(soup)
                for ch, vv in chapter_data.items():
                    current_book_data.setdefault(ch, {}).update(vv)

        if current_book_name and current_book_data:
            results.setdefault(current_book_name, {})
            for ch, vv in current_book_data.items():
                results[current_book_name].setdefault(ch, {}).update(vv)

    return results


print(f"Parsing {EPUB_PATH}...")
books = parse_epub(EPUB_PATH)
print(f"\nFound {len(books)} apocrypha books: {list(books.keys())}")

if not books:
    print("ERROR: No apocrypha books found. Inspect epub structure above.")
    sys.exit(1)

for book_name, data in books.items():
    if not data:
        print(f"  SKIP {book_name} - empty")
        continue
    out_path = os.path.join(OUT_DIR, f"{book_name}.json")
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print(f"  Wrote {out_path} ({len(data)} chapters, {sum(len(v) for v in data.values())} verses)")

with open(META_PATH, 'r', encoding='utf-8') as f:
    meta = json.load(f)

meta['info']['canon'] = 'protestant+apocrypha'
existing_book_names = {b['name'] for b in meta['books']}

for book_name, data in books.items():
    if not data or book_name in existing_book_names:
        continue
    meta['books'].append({'name': book_name, 'testament': 'Apocrypha', 'chapters': len(data)})
    print(f"  Added {book_name} to meta.json")

with open(META_PATH, 'w', encoding='utf-8') as f:
    json.dump(meta, f, ensure_ascii=False, indent=2)
print(f"Updated {META_PATH}")

with open(INFO_PATH, 'r', encoding='utf-8') as f:
    info = json.load(f)
info['canon'] = 'protestant+apocrypha'
with open(INFO_PATH, 'w', encoding='utf-8') as f:
    json.dump(info, f, ensure_ascii=False, indent=2)
print(f"Updated {INFO_PATH}")
print("Done.")
