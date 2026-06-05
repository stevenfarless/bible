// bsb-structure.js
// Loads pre-computed structure scaffold data from local repo files.
// Each record is a flat array of events: { ch, v, type, text? }
// type is 'heading' or 'para_break'.
// Events fire BEFORE the verse they reference.
//
// Protestant canon books use BSB_structure.
// Deuterocanon books (not in the 66-book Protestant canon) use WEB_structure.
// Local paths:
//   ./translations/BSB/BSB_structure/{bookName}.json
//   ./translations/WEB/WEB_structure/{bookName}.json

import { PROTESTANT_BOOKS } from './bible-structure.js';

const _cache = new Map();
// Deduplicates concurrent in-flight fetches for the same book.
// Rapid chapter navigation can call loadStructure() for the same book
// before the first fetch resolves. Both would pass the _cache.has() check
// and issue duplicate requests without this guard.
const _fetchPromise = new Map();

function sanitizeForLog(value) {
    return String(value).replace(/[\r\n]/g, '');
}

/**
 * Returns the scaffold event array for the given book name.
 * Results are cached in memory for the session.
 *
 * Protestant canon books load from BSB_structure.
 * Deuterocanon books load from WEB_structure.
 *
 * @param {string} bookName - Exact book name matching the file key,
 *   e.g. 'John', '1 Corinthians', 'Song of Solomon', 'Tobit'.
 * @returns {Promise<Array>} Flat array of structure events, or [] on failure.
 */
export async function loadStructure(bookName) {
    if (_cache.has(bookName)) return _cache.get(bookName);
    if (_fetchPromise.has(bookName)) return _fetchPromise.get(bookName);

    const promise = (async () => {
        const folder = PROTESTANT_BOOKS.has(bookName)
            ? 'BSB/BSB_structure'
            : 'WEB/WEB_structure';
        const url = `./translations/${folder}/${encodeURIComponent(bookName)}.json`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const events = Array.isArray(data) ? data : [];
            _cache.set(bookName, events);
            return events;
        } catch (err) {
            const safeBookName = sanitizeForLog(bookName);
            console.warn('bsb-structure: could not load scaffold for "%s"', safeBookName, err);
            _cache.set(bookName, []);
            return [];
        } finally {
            _fetchPromise.delete(bookName);
        }
    })();

    _fetchPromise.set(bookName, promise);
    return promise;
}

/**
 * Returns only the events for a specific chapter, sorted ascending by verse.
 *
 * @param {Array} events - Full event array from loadStructure().
 * @param {number} chapter - Chapter number.
 * @returns {Array}
 */
export function eventsForChapter(events, chapter) {
    return events
        .filter(e => e.ch === chapter)
        .sort((a, b) => a.v - b.v);
}
