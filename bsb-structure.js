// bsb-structure.js
// Loads pre-computed BSB structure scaffold JSONs from translations/BSB/BSB_structure/.
// Each JSON is a flat array of events: { ch, v, type, text? }
// type is 'heading' or 'para_break'.
// Events fire BEFORE the verse they reference.
//
// Only used at runtime when the active translation is BSB.
// Nothing is fetched from outside the repo.

const _cache = new Map();

/**
 * Returns the scaffold event array for the given book name.
 * Results are cached in memory for the session.
 *
 * @param {string} bookName - Exact book name matching the JSON filename,
 *   e.g. 'John', '1 Corinthians', 'Song of Solomon'.
 * @returns {Promise<Array>} Flat array of structure events, or [] on failure.
 */
export async function loadStructure(bookName) {
    if (_cache.has(bookName)) return _cache.get(bookName);

    const path = `./translations/BSB/BSB_structure/${encodeURIComponent(bookName)}.json`;
    try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const events = Array.isArray(data) ? data : [];
        _cache.set(bookName, events);
        return events;
    } catch (err) {
        console.warn('bsb-structure: could not load scaffold for "%s"', bookName, err);
        _cache.set(bookName, []);
        return [];
    }
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
