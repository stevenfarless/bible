#!/usr/bin/env python3
"""One-time integration helper for the Brenton Septuagint import on exp."""

from __future__ import annotations

import json
import py_compile
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IGNORED_IDS = {"BAK", "FRT", "INT", "OTH", "XXA", "XXB", "XXC"}


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"{label}: expected source block not found in {path}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def prepare() -> None:
    path = ROOT / "scripts" / "import-brenton.py"
    text = path.read_text(encoding="utf-8")

    if "IGNORED_USFM_IDS" not in text:
        marker = "BOOK_MAP = {"
        if marker not in text:
            raise RuntimeError("BOOK_MAP marker not found")
        ignored = "IGNORED_USFM_IDS = " + repr(IGNORED_IDS) + "\n\nBOOK_MAP = {"
        text = text.replace(marker, ignored, 1)

    old = "            code, chapters = parse_usfm(path)\n            mapped = BOOK_MAP.get(code)"
    if old in text:
        new = (
            "            code, chapters = parse_usfm(path)\n"
            "            if code in IGNORED_USFM_IDS:\n"
            "                continue\n"
            "            mapped = BOOK_MAP.get(code)"
        )
        text = text.replace(old, new, 1)
    elif "if code in IGNORED_USFM_IDS:" not in text:
        raise RuntimeError("USFM mapping loop marker not found")

    path.write_text(text, encoding="utf-8")
    py_compile.compile(str(path), doraise=True)


def finalize() -> None:
    path = ROOT / "bible-api.js"
    old = """        const verseNums = Object.keys(chapterData)
            .map(Number)
            .filter(Number.isFinite)
            .filter((v) => v > 0)
            .sort((a, b) => a - b)
            .filter((v) => {
                if (verseStart !== null && v < verseStart) return false;
                if (verseEnd !== null && v > verseEnd) return false;
                return true;
            });"""
    new = """        const verseNums = Object.keys(chapterData)
            .filter((v) => /^[1-9]\\d*(?:[a-z]+|-[1-9]\\d*[a-z]*)?$/i.test(v))
            .sort((a, b) => {
                const parse = (value) => {
                    const match = String(value).match(/^(\\d+)([a-z]*)(?:-(\\d+)([a-z]*))?$/i);
                    if (!match) return [Number.MAX_SAFE_INTEGER, '', Number.MAX_SAFE_INTEGER, ''];
                    return [
                        Number(match[1]),
                        match[2] || '',
                        match[3] ? Number(match[3]) : Number(match[1]),
                        match[4] || '',
                    ];
                };
                const av = parse(a);
                const bv = parse(b);
                return av[0] - bv[0]
                    || av[1].localeCompare(bv[1])
                    || av[2] - bv[2]
                    || av[3].localeCompare(bv[3]);
            })
            .filter((v) => {
                const base = parseInt(v, 10);
                if (verseStart !== null && base < verseStart) return false;
                if (verseEnd !== null && base > verseEnd) return false;
                return true;
            });"""
    replace_once(path, old, new, "lettered verse rendering")

    replace_once(
        ROOT / "bsb-structure.js",
        "export async function loadStructure(bookName) {",
        "export async function loadStructure(bookName, translation = null) {\n    if (translation === 'BST') return [];",
        "BST heading scaffold guard",
    )
    replace_once(
        ROOT / "app.js",
        "const allEvents = await loadStructure(book);",
        "const allEvents = await loadStructure(book, this.state.translation);",
        "reader heading scaffold call",
    )
    replace_once(
        ROOT / "swipe.js",
        "const allEvents = await loadStructure(pos.book);",
        "const allEvents = await loadStructure(pos.book, app.state.translation);",
        "swipe heading scaffold call",
    )

    search = ROOT / "search.js"
    text = search.read_text(encoding="utf-8")

    old = "'^(' + escapedName + ')\\\\s+([\\\\d]+)(?:[:\\\\s]([\\\\d]+))?$'"
    new = "'^(' + escapedName + ')\\\\s+([\\\\d]+)(?:[:\\\\s]([\\\\d]+[a-z]?))?$'"
    if old not in text:
        raise RuntimeError("named-book reference regex not found")
    text = text.replace(old, new, 1)

    old = "const verse = m[3] ? parseInt(m[3], 10) : null;"
    new = "const verse = m[3] ? (/^[0-9]+$/.test(m[3]) ? parseInt(m[3], 10) : m[3].toLowerCase()) : null;"
    if old not in text:
        raise RuntimeError("named-book verse parser not found")
    text = text.replace(old, new, 1)

    old = "if (verse !== null && !Number.isFinite(verse)) continue;"
    new = "if (verse !== null && typeof verse === 'number' && !Number.isFinite(verse)) continue;"
    if old not in text:
        raise RuntimeError("named-book verse validator not found")
    text = text.replace(old, new, 1)

    old = r"const match = cleaned.match(/^((?:\d\s+)?[A-Za-z][A-Za-z ]*?)\s+([\d]+)(?:[:\s]([\d]+))?$/);"
    new = r"const match = cleaned.match(/^((?:\d\s+)?[A-Za-z][A-Za-z ]*?)\s+([\d]+)(?:[:\s]([\d]+[a-z]?))?$/i);"
    if old not in text:
        raise RuntimeError("fallback reference regex not found")
    text = text.replace(old, new, 1)

    old = "const verse = match[3] ? parseInt(match[3], 10) : null;"
    new = "const verse = match[3] ? (/^[0-9]+$/.test(match[3]) ? parseInt(match[3], 10) : match[3].toLowerCase()) : null;"
    if old not in text:
        raise RuntimeError("fallback verse parser not found")
    text = text.replace(old, new, 1)

    old = "if (verse !== null && !Number.isFinite(verse)) return null;"
    new = "if (verse !== null && typeof verse === 'number' && !Number.isFinite(verse)) return null;"
    if old not in text:
        raise RuntimeError("fallback verse validator not found")
    text = text.replace(old, new, 1)

    search.write_text(text, encoding="utf-8")


def validate() -> None:
    directory = ROOT / "translations" / "BST"
    meta = json.loads((directory / "meta.json").read_text(encoding="utf-8"))
    index = json.loads((directory / "BST_search_index.json").read_text(encoding="utf-8"))
    daniel = json.loads((directory / "Daniel.json").read_text(encoding="utf-8"))
    genesis = json.loads((directory / "Genesis.json").read_text(encoding="utf-8"))

    if len(meta.get("books", [])) != 53:
        raise RuntimeError(f"Expected 53 Brenton books; found {len(meta.get('books', []))}")
    if len(index.get("refs", [])) != 29004:
        raise RuntimeError(f"Expected 29,004 Brenton verses; found {len(index.get('refs', []))}")
    if not daniel.get("3", {}).get("72a") or not daniel.get("3", {}).get("72b"):
        raise RuntimeError("Lettered Daniel 3 LXX verses were not preserved")
    if genesis.get("1", {}).get("1") != "In the beginning God made the heaven and the earth.":
        raise RuntimeError("Genesis 1:1 does not match Brenton")
    if "Daniel 3:72a" not in index.get("refs", []):
        raise RuntimeError("Lettered verse missing from BST search index")

    py_compile.compile(str(ROOT / "scripts" / "import-brenton.py"), doraise=True)
    for filename in ["bible-api.js", "bsb-structure.js", "app.js", "swipe.js", "search.js"]:
        subprocess.run(["node", "--check", str(ROOT / filename)], check=True)

    print(f"BST validation passed: {len(meta['books'])} books, {len(index['refs'])} verses")


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in {"prepare", "finalize", "validate"}:
        raise SystemExit("usage: brenton-integration.py prepare|finalize|validate")
    globals()[sys.argv[1]]()


if __name__ == "__main__":
    main()
