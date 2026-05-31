#!/usr/bin/env node
// scripts/generate-meta.js
// Generates translations/{ID}/meta.json for every translation folder.
// Reads info.json for metadata and canon, looks up testament assignments
// from canon-registry.json, then counts chapters from the book JSON files.
//
// Run: node scripts/generate-meta.js
// Or target one translation: node scripts/generate-meta.js ASV

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TRANSLATIONS_DIR = join(ROOT, 'translations');
const REGISTRY_PATH = join(__dirname, 'canon-registry.json');

const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));

// Build a flat lookup: { bookName -> testament } for each canon.
function buildTestamentLookup(canonKey) {
    const canon = registry.canons[canonKey];
    if (!canon) return null;
    const lookup = {};
    for (const section of canon.sections) {
        for (const book of section.books) {
            lookup[book] = section.testament;
        }
    }
    return lookup;
}

// Build ordered book list from registry for a given canon so output order
// matches canonical order, not filesystem alphabetical order.
function buildCanonOrder(canonKey) {
    const canon = registry.canons[canonKey];
    if (!canon) return [];
    return canon.sections.flatMap(s => s.books);
}

function processTranslation(translationId) {
    const dir = join(TRANSLATIONS_DIR, translationId);
    const infoPath = join(dir, 'info.json');

    let info;
    try {
        info = JSON.parse(readFileSync(infoPath, 'utf8'));
    } catch {
        console.warn(`  [SKIP] ${translationId}: missing or invalid info.json`);
        return;
    }

    const canonKey = info.canon;
    const testamentLookup = buildTestamentLookup(canonKey);
    const canonOrder = buildCanonOrder(canonKey);

    if (!testamentLookup) {
        console.warn(`  [WARN] ${translationId}: unknown canon "${canonKey}" in registry — skipping`);
        return;
    }

    // Collect all book JSON files in this folder.
    const files = readdirSync(dir).filter(f =>
        f.endsWith('.json') &&
        f !== 'info.json' &&
        f !== 'meta.json' &&
        !f.endsWith('_search_index.json')
    );

    // Map filename -> chapter count.
    const bookData = {};
    for (const file of files) {
        const bookName = basename(file, '.json');
        try {
            const content = JSON.parse(readFileSync(join(dir, file), 'utf8'));
            const chapters = Object.keys(content).length;
            bookData[bookName] = chapters;
        } catch {
            console.warn(`  [WARN] ${translationId}/${file}: could not parse — skipping book`);
        }
    }

    // Build the books array in canonical order. Books present in the
    // translation but not in the registry go into an "Other" testament
    // at the end so nothing is silently dropped.
    const ordered = [];
    const seen = new Set();

    for (const bookName of canonOrder) {
        if (bookData[bookName] !== undefined) {
            ordered.push({
                name: bookName,
                testament: testamentLookup[bookName],
                chapters: bookData[bookName]
            });
            seen.add(bookName);
        }
    }

    // Any books in the folder not accounted for by the registry.
    for (const bookName of Object.keys(bookData)) {
        if (!seen.has(bookName)) {
            console.warn(`  [WARN] ${translationId}: "${bookName}" not in "${canonKey}" canon — assigned to "Other"`);
            ordered.push({
                name: bookName,
                testament: 'Other',
                chapters: bookData[bookName]
            });
        }
    }

    const meta = {
        info,
        books: ordered
    };

    const outPath = join(dir, 'meta.json');
    writeFileSync(outPath, JSON.stringify(meta, null, 2) + '\n');
    console.log(`  [OK]   ${translationId}: ${ordered.length} books written to meta.json`);
}

// Determine which translations to process.
const target = process.argv[2];
let translationIds;

if (target) {
    translationIds = [target];
} else {
    translationIds = readdirSync(TRANSLATIONS_DIR).filter(name => {
        const full = join(TRANSLATIONS_DIR, name);
        return statSync(full).isDirectory();
    });
}

console.log(`Generating meta.json for: ${translationIds.join(', ')}\n`);
for (const id of translationIds) {
    processTranslation(id);
}
console.log('\nDone.');
