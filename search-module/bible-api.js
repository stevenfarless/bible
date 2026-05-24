// bible-api.js
// Serves Bible text from Firebase Realtime Database.
//
// RTDB path for verse text:  /translations/{translation}/{book}
//   Returns: { "1": { "1": "verse text", ... }, ... }  (chapter → verse → text)
//
// RTDB path for translation index: /translations
//   Returns: { BSB: {...}, NRSVUE: {...}, ... }
//   The index is a separate node — see loadTranslationIndex().
//
// For BSB the optional `scaffold` parameter (from bsb-structure.js) inserts
// section headings and paragraph breaks into the rendered HTML.

import { FIREBASE_DB_URL } from './config/firebase-config.js';

const PAGE_SIZE = 100;

const BOOK_LOAD_ORDER = [
    'Genesis','Exodus','Leviticus','Numbers','Deuteronomy',
    'Joshua','Judges','Ruth','1 Samuel','2 Samuel',
    '1 Kings','2 Kings','1 Chronicles','2 Chronicles',
    'Ezra','Nehemiah','Esther','Job','Psalm','Proverbs',
    'Ecclesiastes','Song of Solomon','Isaiah','Jeremiah',
    'Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
    'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah',
    'Haggai','Zechariah','Malachi','Matthew','Mark','Luke',
    'John','Acts','Romans','1 Corinthians','2 Corinthians',
    'Galatians','Ephesians','Philippians','Colossians',
    '1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy',
    'Titus','Philemon','Hebrews','James','1 Peter','2 Peter',
    '1 John','2 John','3 John','Jude','Revelation',
];

// Some translations store book keys with non-canonical capitalisation.
// Each entry maps the canonical BOOK_LOAD_ORDER name to the variant stored
// in that translation's JSON. Applied in both fetchPassage and searchPassages.
// Add new aliases here when additional mismatches are discovered.
const BOOK_KEY_ALIASES = {
    // CSB (and possibly others) store title-cased prepositions.
    'Song of Solomon': 'Song Of Solomon',
};

/**
 * Returns the key to use when indexing into a loaded bookData object.
 * Tries the canonical name first; falls back to the alias if present.
 * Returns null if neither key exists in the data.
 *
 * @param {Object} bible - The loaded translation object keyed by book name.
 * @param {string} canonicalName - The BOOK_LOAD_ORDER canonical name.
 * @returns {string|null}
 */
function _resolveBookKey(bible, canonicalName) {
    if (bible[canonicalName] !== undefined) return canonicalName;
    const alias = BOOK_KEY_ALIASES[canonicalName];
    if (alias !== undefined && bible[alias] !== undefined) return alias;
    return null;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Loads the translation index from RTDB.
 * RTDB path: /translationIndex
 * Returns an array of translation metadata objects: [ { id, label, copyright }, ... ]
 *
 * The /translations node contains book data keyed by translation ID.
 * A separate /translationIndex node holds the metadata array if present;
 * otherwise we derive a minimal list from the translation keys.
 */
export async function loadTranslationIndex() {
    const url = `${FIREBASE_DB_URL}/translationIndex.json`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object') return Object.values(data);
        return [];
    } catch (err) {
        console.error('BibleApi: failed to load translation index from RTDB', err);
        return [];
    }
}

export class BibleApi {
    constructor(translation = 'ESV') {
        this._translation = translation;
        // Per-book cache: Map<`${translation}/${book}`, bookData | null>
        this._bookCache = new Map();
    }

    setTranslation(translation) {
        this._translation = translation;
    }

    get translation() {
        return this._translation;
    }

    /**
     * Fetches a single book from RTDB.
     * RTDB path: /translations/{translation}/{book}
     * Returns: { "1": { "1": "verse text", ... }, ... } or null on failure.
     */
    async _loadBook(translation, book) {
        const cacheKey = `${translation}/${book}`;
        if (this._bookCache.has(cacheKey)) {
            return this._bookCache.get(cacheKey);
        }

        const url = `${FIREBASE_DB_URL}/translations/${encodeURIComponent(translation)}/${encodeURIComponent(book)}.json`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status} for ${res.url}`);
            const data = await res.json();
            // RTDB returns null for missing nodes.
            const bookData = (data && typeof data === 'object') ? data : null;
            this._bookCache.set(cacheKey, bookData);
            return bookData;
        } catch (err) {
            console.error(`BibleApi: failed to load ${translation}/${book} from RTDB`, err);
            this._bookCache.set(cacheKey, null);
            return null;
        }
    }

    _parseReference(reference) {
        const str = String(reference || '').trim();
        const m = str.match(/^((?:[1-3]\s+)?[A-Za-z ]+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
        if (!m) return null;

        return {
            book: m[1].trim(),
            chapter: parseInt(m[2], 10),
            verseStart: m[3] ? parseInt(m[3], 10) : null,
            verseEnd: m[4] ? parseInt(m[4], 10) : null,
        };
    }

    _sanitizeForLog(value) {
        return String(value ?? '').replace(/[\r\n]/g, '');
    }

    /**
     * Builds passage HTML, optionally weaving in structure scaffold events.
     *
     * @param {number} chapter
     * @param {Object} chapterData  - { "1": "verse text", ... }
     * @param {number|null} verseStart
     * @param {number|null} verseEnd
     * @param {Array} scaffoldEvents - Chapter-filtered events from bsb-structure.js,
     *   each: { ch, v, type: 'heading'|'para_break', text? }
     *   Pass [] or omit for translations without scaffold data.
     * @param {boolean} showHeadings - Whether to render heading events.
     * @returns {string|null}
     */
    _buildPassageHtml(chapter, chapterData, verseStart, verseEnd, scaffoldEvents = [], showHeadings = true) {
        const verseNums = Object.keys(chapterData)
            .map(Number)
            .filter(Number.isFinite)
            .filter((v) => v > 0)  // skip verse 0 (intro/dedication metadata in some translations)
            .sort((a, b) => a - b)
            .filter((v) => {
                if (verseStart !== null && v < verseStart) return false;
                if (verseEnd !== null && v > verseEnd) return false;
                return true;
            });

        if (!verseNums.length) return null;

        const hasScaffold = scaffoldEvents.length > 0;

        // Without scaffold data (non-BSB translations), collect verse spans and
        // wrap them in a single <p> — no openP/closeP calls, which would produce
        // nested <p><p> when the spans are wrapped again below.
        if (!hasScaffold) {
            const spans = [];
            for (const v of verseNums) {
                const text = chapterData[String(v)] || '';
                spans.push(
                    `<span class="verse" data-verse="${v}" id="v${chapter}-${v}">` +
                    `<sup class="verse-num">${v}</sup> ${escapeHtml(text)} ` +
                    `</span>`
                );
            }
            return `<p class="passage-para">${spans.join('')}</p>`;
        }

        // With scaffold data (BSB): interleave headings and paragraph breaks.
        const eventMap = new Map();
        for (const evt of scaffoldEvents) {
            if (!eventMap.has(evt.v)) eventMap.set(evt.v, []);
            eventMap.get(evt.v).push(evt);
        }

        const parts = [];
        let inParagraph = false;

        const openP = () => {
            parts.push('<p class="passage-para">');
            inParagraph = true;
        };

        const closeP = () => {
            if (inParagraph) {
                parts.push('</p>');
                inParagraph = false;
            }
        };

        for (const v of verseNums) {
            const eventsHere = eventMap.get(v) || [];

            for (const evt of eventsHere) {
                if (evt.type === 'heading') {
                    if (showHeadings) {
                        closeP();
                        parts.push(`<h3 class="pericope-heading">${escapeHtml(evt.text)}</h3>`);
                    }
                } else if (evt.type === 'para_break') {
                    closeP();
                }
            }

            if (!inParagraph) openP();

            const text = chapterData[String(v)] || '';
            parts.push(
                `<span class="verse" data-verse="${v}" id="v${chapter}-${v}">` +
                `<sup class="verse-num">${v}</sup> ${escapeHtml(text)} ` +
                `</span>`
            );
        }

        closeP();

        return parts.join('');
    }

    async fetchPassage(reference, scaffoldEvents = [], showHeadings = true) {
        const parsed = this._parseReference(reference);
        if (!parsed) {
            console.error(`BibleApi: cannot parse reference "${this._sanitizeForLog(reference)}"`);
            return null;
        }

        const { book, chapter, verseStart, verseEnd } = parsed;
        const bookData = await this._loadBook(this._translation, book);
        if (!bookData) {
            console.error(`BibleApi: book "${this._sanitizeForLog(book)}" not found in ${this._translation}`);
            return null;
        }

        // Resolve the key used in this translation's JSON (may differ from canonical name).
        const resolvedKey = _resolveBookKey(bookData, book);
        const resolvedBookData = resolvedKey ? bookData[resolvedKey] ?? bookData : bookData;

        const chapterData = resolvedBookData[String(chapter)];
        if (!chapterData) {
            console.error(`BibleApi: chapter ${chapter} not found in "${this._sanitizeForLog(book)}"`);
            return null;
        }

        const normalizedVerseEnd = verseStart !== null ? (verseEnd ?? verseStart) : null;
        const html = this._buildPassageHtml(
            chapter,
            chapterData,
            verseStart,
            normalizedVerseEnd,
            scaffoldEvents,
            showHeadings
        );
        if (!html) return null;

        const canonical = verseStart !== null
            ? `${book} ${chapter}:${verseStart}${normalizedVerseEnd !== verseStart ? `-${normalizedVerseEnd}` : ''}`
            : `${book} ${chapter}`;

        return { passages: [html], canonical };
    }

    async searchPassages(query, page = 1) {
        const q = String(query || '').toLowerCase().trim();
        if (!q) return { results: [], total_results: 0, page_size: PAGE_SIZE };

        const results = [];

        const SEARCH_BATCH_SIZE = 10;
        for (let i = 0; i < BOOK_LOAD_ORDER.length; i += SEARCH_BATCH_SIZE) {
            const batch = BOOK_LOAD_ORDER.slice(i, i + SEARCH_BATCH_SIZE);
            const bookDataBatch = await Promise.all(
                batch.map(book => this._loadBook(this._translation, book))
            );
            for (const [batchIdx, bookData] of bookDataBatch.entries()) {
                if (!bookData) continue;
                const book = batch[batchIdx];
                // Resolve alias so translations with variant key capitalisation
                // (e.g. "Song Of Solomon" in CSB) are not silently skipped.
                const resolvedKey = _resolveBookKey(bookData, book);
                const resolvedBookData = resolvedKey ? bookData[resolvedKey] ?? bookData : bookData;
                const chapterEntries = Object.entries(resolvedBookData)
                    .sort((a, b) => Number(a[0]) - Number(b[0]));
                for (const [chapterStr, chapterData] of chapterEntries) {
                    const verseEntries = Object.entries(chapterData)
                        .filter(([verseStr]) => Number(verseStr) > 0) // skip verse 0
                        .sort((a, b) => Number(a[0]) - Number(b[0]));
                    for (const [verseStr, text] of verseEntries) {
                        const verseText = String(text || '');
                        if (!verseText.toLowerCase().includes(q)) continue;
                        results.push({
                            reference: `${book} ${chapterStr}:${verseStr}`,
                            content:   verseText,
                            book,
                            chapter:   Number(chapterStr),
                            verse:     Number(verseStr),
                            text:      verseText,
                        });
                    }
                }
            }
        }
        }

        const total = results.length;
        const start = Math.max(0, (page - 1) * PAGE_SIZE);
        return {
            results: results.slice(start, start + PAGE_SIZE),
            total_results: total,
            page_size: PAGE_SIZE,
        };
    }
}
