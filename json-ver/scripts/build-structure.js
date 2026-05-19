#!/usr/bin/env node
// scripts/build-structure.js
//
// Parses HelloAOLab BSB USFM files and emits one scaffold JSON per book into
// translations/BSB/BSB_structure/{Book}.json
//
// Usage:
//   node scripts/build-structure.js --usfm-dir /path/to/HelloAOLab/BSB_USFM
//
// The HelloAOLab repo is only needed to run this script, not at app runtime.
// Clone it with:
//   git clone https://github.com/BereanBible/HelloAOLab /tmp/HelloAOLab
//
// Output files are committed into the repo on the json-ver branch.
// Running the script again produces identical output (idempotent).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'translations', 'BSB', 'BSB_structure');

// Maps USFM book abbreviation (as it appears in the filename) to the exact
// book name used in BSB_books JSON filenames.
// USFM filenames follow the pattern: NN_BSB_Bible_ABB.usfm
const USFM_TO_BOOK = {
    Gen:  'Genesis',
    Exo:  'Exodus',
    Lev:  'Leviticus',
    Num:  'Numbers',
    Deu:  'Deuteronomy',
    Jos:  'Joshua',
    Jdg:  'Judges',
    Rut:  'Ruth',
    '1Sa': '1 Samuel',
    '2Sa': '2 Samuel',
    '1Ki': '1 Kings',
    '2Ki': '2 Kings',
    '1Ch': '1 Chronicles',
    '2Ch': '2 Chronicles',
    Ezr:  'Ezra',
    Neh:  'Nehemiah',
    Est:  'Esther',
    Job:  'Job',
    Psa:  'Psalm',
    Pro:  'Proverbs',
    Ecc:  'Ecclesiastes',
    Sng:  'Song of Solomon',
    Isa:  'Isaiah',
    Jer:  'Jeremiah',
    Lam:  'Lamentations',
    Ezk:  'Ezekiel',
    Dan:  'Daniel',
    Hos:  'Hosea',
    Jol:  'Joel',
    Amo:  'Amos',
    Oba:  'Obadiah',
    Jon:  'Jonah',
    Mic:  'Micah',
    Nam:  'Nahum',
    Hab:  'Habakkuk',
    Zep:  'Zephaniah',
    Hag:  'Haggai',
    Zec:  'Zechariah',
    Mal:  'Malachi',
    Mat:  'Matthew',
    Mrk:  'Mark',
    Luk:  'Luke',
    Jhn:  'John',
    Act:  'Acts',
    Rom:  'Romans',
    '1Co': '1 Corinthians',
    '2Co': '2 Corinthians',
    Gal:  'Galatians',
    Eph:  'Ephesians',
    Php:  'Philippians',
    Col:  'Colossians',
    '1Th': '1 Thessalonians',
    '2Th': '2 Thessalonians',
    '1Ti': '1 Timothy',
    '2Ti': '2 Timothy',
    Tit:  'Titus',
    Phm:  'Philemon',
    Heb:  'Hebrews',
    Jas:  'James',
    '1Pe': '1 Peter',
    '2Pe': '2 Peter',
    '1Jn': '1 John',
    '2Jn': '2 John',
    '3Jn': '3 John',
    Jud:  'Jude',
    Rev:  'Revelation',
};

// Alternative abbreviations some USFM sets use.
const USFM_ALT = {
    Exod: 'Exodus',
    Deut: 'Deuteronomy',
    Josh: 'Joshua',
    Judg: 'Judges',
    Ps:   'Psalm',
    Song: 'Song of Solomon',
    Ezek: 'Ezekiel',
    Zeph: 'Zephaniah',
    Zech: 'Zechariah',
    Matt: 'Matthew',
    John: 'John',
    '1Cor': '1 Corinthians',
    '2Cor': '2 Corinthians',
    Phil: 'Philippians',
    '1Thes': '1 Thessalonians',
    '2Thes': '2 Thessalonians',
    '1Tim': '1 Timothy',
    '2Tim': '2 Timothy',
    Phlm: 'Philemon',
    '1Pet': '1 Peter',
    '2Pet': '2 Peter',
    Jude: 'Jude',
};

const ABBREV_MAP = { ...USFM_TO_BOOK, ...USFM_ALT };

function resolveBookName(usfmAbbrev) {
    return ABBREV_MAP[usfmAbbrev] || null;
}

/**
 * Parses a single USFM file and returns an array of scaffold events.
 *
 * Rules applied:
 * - \c N        → set current chapter, reset verse
 * - \v N        → set current verse; flush pending heading/break events
 * - \s1 Text    → pending heading (attaches to next \v)
 * - \s2 Text    → pending heading (lower-level, same treatment)
 * - \s Text     → pending heading (generic, same treatment)
 * - \b          → pending para_break flag
 * - \p          → pending para_break flag
 * - \m          → ignored (continuation marker)
 * - \r, \f, \f*, \q1, \q2, \wj, \wj*, \d → ignored
 * - Empty verse text (e.g. John 5:4) → verse event fired, no text emitted
 *
 * A heading and a para_break at the same verse are both emitted.
 * Events are sorted: headings before para_breaks at the same (ch, v).
 */
function parseUsfm(content) {
    const events = [];
    let ch = 0;
    let pendingHeading = null;  // string or null
    let pendingBreak = false;

    const lines = content.split(/\r?\n/);

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // Chapter marker
        const chMatch = line.match(/^\\c\s+(\d+)/);
        if (chMatch) {
            ch = parseInt(chMatch[1], 10);
            // Clear pending state at chapter boundary in case USFM is oddly formed.
            pendingHeading = null;
            pendingBreak = false;
            continue;
        }

        // Section heading markers (\s, \s1, \s2)
        const sMatch = line.match(/^\\s\d?\s+(.*)/);  
        if (sMatch) {
            // Strip inline markup like \add, \nd etc. from the heading text.
            let text = sMatch[1]
                .replace(/\\[a-z0-9*]+/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            if (text) pendingHeading = text;
            continue;
        }

        // Paragraph break markers
        if (/^\\b(?:\s|$)/.test(line) || /^\\p(?:\s|$)/.test(line)) {
            pendingBreak = true;
            continue;
        }

        // Verse marker — flush pending events
        const vMatch = line.match(/^\\v\s+(\d+)/);
        if (vMatch) {
            const v = parseInt(vMatch[1], 10);

            if (pendingHeading !== null) {
                events.push({ ch, v, type: 'heading', text: pendingHeading });
                pendingHeading = null;
            }

            if (pendingBreak) {
                events.push({ ch, v, type: 'para_break' });
                pendingBreak = false;
            }

            continue;
        }

        // Ignore all other markers (\m, \r, \q1, \q2, \f, \wj, \d, etc.)
    }

    // Sort: by chapter, then verse, then headings before para_breaks.
    events.sort((a, b) => {
        if (a.ch !== b.ch) return a.ch - b.ch;
        if (a.v !== b.v) return a.v - b.v;
        // headings first
        if (a.type === 'heading' && b.type !== 'heading') return -1;
        if (b.type === 'heading' && a.type !== 'heading') return 1;
        return 0;
    });

    return events;
}

function extractAbbrevFromFilename(filename) {
    // Typical patterns:
    //   02_BSB_Bible_Gen.usfm
    //   41BSBBibleMat.usfm
    //   Gen.usfm
    // Try the pattern with underscores first.
    let m = filename.match(/(?:BSB_Bible_|BSBBible)([A-Za-z0-9]+)\.usfm$/i);
    if (m) return m[1];
    // Plain abbreviation filename.
    m = filename.match(/^([A-Za-z0-9]+)\.usfm$/i);
    if (m) return m[1];
    return null;
}

function parseArgs() {
    const args = process.argv.slice(2);
    const idx = args.indexOf('--usfm-dir');
    if (idx === -1 || !args[idx + 1]) {
        console.error('Usage: node scripts/build-structure.js --usfm-dir <path>');
        process.exit(1);
    }
    return { usfmDir: args[idx + 1] };
}

async function main() {
    const { usfmDir } = parseArgs();

    if (!fs.existsSync(usfmDir)) {
        console.error(`USFM directory not found: ${usfmDir}`);
        process.exit(1);
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });

    const files = fs.readdirSync(usfmDir).filter(f => f.toLowerCase().endsWith('.usfm'));

    if (!files.length) {
        console.error(`No .usfm files found in: ${usfmDir}`);
        process.exit(1);
    }

    let written = 0;
    let skipped = 0;

    for (const file of files) {
        const abbrev = extractAbbrevFromFilename(file);
        if (!abbrev) {
            console.warn(`  SKIP (cannot parse filename): ${file}`);
            skipped++;
            continue;
        }

        const bookName = resolveBookName(abbrev);
        if (!bookName) {
            console.warn(`  SKIP (unknown abbreviation "${abbrev}"): ${file}`);
            skipped++;
            continue;
        }

        const usfmPath = path.join(usfmDir, file);
        const content = fs.readFileSync(usfmPath, 'utf8');
        const events = parseUsfm(content);

        const outPath = path.join(OUT_DIR, `${bookName}.json`);
        fs.writeFileSync(outPath, JSON.stringify(events, null, 2), 'utf8');
        console.log(`  OK  ${bookName} (${events.length} events) → ${path.relative(REPO_ROOT, outPath)}`);
        written++;
    }

    console.log(`\nDone. ${written} written, ${skipped} skipped.`);
}

main();
