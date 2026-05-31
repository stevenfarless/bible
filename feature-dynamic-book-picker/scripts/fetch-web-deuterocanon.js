#!/usr/bin/env node
// scripts/fetch-web-deuterocanon.js
// Fetches the WEB Deuterocanon/Apocrypha from the World English Bible project
// at https://ebible.org and formats each book as { chapter: { verse: text } }
// matching the structure used by all other book files in this repo.
//
// Output: translations/WEB-DC/{BookName}.json
//
// The books are written to a separate WEB-DC folder rather than into WEB
// so you can review them before deciding how to merge or present them.
// When you're ready to combine them into a unified WEB+DC translation,
// copy the files into translations/WEB/, update translations/WEB/info.json
// with "canon": "catholic" (or whichever canon you want), and re-run
// generate-meta.js.
//
// Run: node scripts/fetch-web-deuterocanon.js
// Requires Node 18+ (built-in fetch).

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'translations', 'WEB-DC');

// eBible.org distributes the WEB in USFM and CSV formats.
// The CSV per-book download URL pattern is:
// https://ebible.org/Scriptures/eng-web_readaloud.zip  (full zip)
// For individual book fetching we use the public API at bible-api.com
// which serves WEB text including the Apocrypha.
// Endpoint: https://bible-api.com/{book}+{chapter}?translation=web
// Returns: { verses: [ { book_name, chapter, verse, text } ] }
//
// Books in the WEB Deuterocanon / Apocrypha:
const DEUTEROCANON = [
    { name: 'Tobit',                   apiName: 'Tobit',                    chapters: 14 },
    { name: 'Judith',                  apiName: 'Judith',                   chapters: 16 },
    { name: 'Wisdom of Solomon',       apiName: 'Wisdom of Solomon',        chapters: 19 },
    { name: 'Sirach',                  apiName: 'Sirach',                   chapters: 51 },
    { name: 'Baruch',                  apiName: 'Baruch',                   chapters: 6  },
    { name: 'Letter of Jeremiah',      apiName: 'Letter of Jeremiah',       chapters: 1  },
    { name: '1 Maccabees',             apiName: '1 Maccabees',              chapters: 16 },
    { name: '2 Maccabees',             apiName: '2 Maccabees',              chapters: 15 },
    { name: 'Prayer of Manasseh',      apiName: 'Prayer of Manasseh',       chapters: 1  },
    { name: 'Psalm 151',               apiName: 'Psalm 151',                chapters: 1  },
    { name: '1 Esdras',                apiName: '1 Esdras',                 chapters: 9  },
    { name: '2 Esdras',                apiName: '2 Esdras',                 chapters: 16 },
    { name: '3 Maccabees',             apiName: '3 Maccabees',              chapters: 7  },
    { name: '4 Maccabees',             apiName: '4 Maccabees',              chapters: 18 },
];

// bible-api.com rate-limits aggressively. This delay between requests
// keeps us well within their limits.
const DELAY_MS = 1200;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchChapter(apiName, chapter) {
    const query = encodeURIComponent(`${apiName} ${chapter}`);
    const url = `https://bible-api.com/${query}?translation=web`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} fetching ${apiName} ${chapter}`);
    }
    const data = await res.json();
    if (!data.verses || data.verses.length === 0) {
        // Some books may not be available in this API for WEB apocrypha.
        return null;
    }
    // Build { verseNum: text } for this chapter.
    const verses = {};
    for (const v of data.verses) {
        verses[String(v.verse)] = v.text.trim();
    }
    return verses;
}

async function fetchBook(book) {
    console.log(`  Fetching ${book.name} (${book.chapters} chapters)...`);
    const bookData = {};
    let missing = false;

    for (let ch = 1; ch <= book.chapters; ch++) {
        try {
            const verses = await fetchChapter(book.apiName, ch);
            if (!verses) {
                console.warn(`    [WARN] ${book.name} ${ch}: no verses returned — book may not be available via this API`);
                missing = true;
                break;
            }
            bookData[String(ch)] = verses;
            process.stdout.write(`    chapter ${ch}/${book.chapters}\r`);
        } catch (err) {
            console.error(`    [ERROR] ${book.name} ${ch}: ${err.message}`);
            missing = true;
            break;
        }
        await sleep(DELAY_MS);
    }

    return missing ? null : bookData;
}

async function main() {
    if (!existsSync(OUT_DIR)) {
        mkdirSync(OUT_DIR, { recursive: true });
        console.log(`Created ${OUT_DIR}`);
    }

    console.log(`\nFetching WEB Deuterocanon/Apocrypha from bible-api.com...`);
    console.log(`Output: translations/WEB-DC/\n`);

    const skipped = [];

    for (const book of DEUTEROCANON) {
        const data = await fetchBook(book);
        if (!data) {
            skipped.push(book.name);
            console.log(`  [SKIP] ${book.name} — not fully available, skipped`);
            continue;
        }
        const outPath = join(OUT_DIR, `${book.name}.json`);
        writeFileSync(outPath, JSON.stringify(data) + '\n');
        console.log(`  [OK]   ${book.name} — written to translations/WEB-DC/${book.name}.json`);
    }

    console.log('\nDone.');
    if (skipped.length) {
        console.log(`\nSkipped (not available via bible-api.com for WEB):`);
        for (const s of skipped) console.log(`  - ${s}`);
        console.log('\nFor missing books, check https://ebible.org/Scriptures/eng-web_readaloud.zip');
        console.log('which contains the full WEB text including all apocryphal books in USFM format.');
        console.log('A separate USFM parser will be needed for those.');
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
