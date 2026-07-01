#!/usr/bin/env node
/**
 * generate-search-indexes.js
 *
 * Reads each translation bundle from ./bundles/{T}_bundle.json and writes
 * ./translations/{T}/{T}_search_index.json as a flat map of
 * "Book Ch:V" -> lowercased verse text.
 *
 * Usage:
 *   node scripts/generate-search-indexes.js [TRANSLATION...]
 *
 * With no arguments, processes all translations found in ./bundles/.
 * With one or more translation codes, processes only those.
 *
 * Examples:
 *   node scripts/generate-search-indexes.js
 *   node scripts/generate-search-indexes.js KJV BSB
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLES_DIR = join(ROOT, 'bundles');
const TRANSLATIONS_DIR = join(ROOT, 'translations');

function buildIndex(bundle) {
    const index = {};
    const books = bundle.books ?? {};
    for (const [book, chapters] of Object.entries(books)) {
        if (typeof chapters !== 'object' || chapters === null) continue;
        for (const [ch, verses] of Object.entries(chapters)) {
            if (typeof verses !== 'object' || verses === null) continue;
            for (const [v, text] of Object.entries(verses)) {
                if (typeof text !== 'string') continue;
                if (!/^\d+$/.test(v) || Number(v) === 0) continue;
                index[`${book} ${ch}:${v}`] = text.toLowerCase();
            }
        }
    }
    return index;
}

function availableTranslations() {
    return readdirSync(BUNDLES_DIR)
        .filter(f => f.endsWith('_bundle.json'))
        .map(f => f.replace('_bundle.json', ''));
}

const requested = process.argv.slice(2);
const targets = requested.length > 0 ? requested : availableTranslations();

for (const t of targets) {
    const bundlePath = join(BUNDLES_DIR, `${t}_bundle.json`);
    let bundle;
    try {
        bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
    } catch (e) {
        console.error(`SKIP ${t}: cannot read bundle (${e.message})`);
        continue;
    }

    const index = buildIndex(bundle);
    const outPath = join(TRANSLATIONS_DIR, t, `${t}_search_index.json`);
    writeFileSync(outPath, JSON.stringify(index));
    const verseCount = Object.keys(index).length;
    const kb = Math.round(Buffer.byteLength(JSON.stringify(index)) / 1024);
    console.log(`${t}: ${verseCount.toLocaleString()} verses  ${kb.toLocaleString()} KB  -> ${outPath}`);
}
