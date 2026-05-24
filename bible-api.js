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

// Static aliases kept as a fast-path for known mismatches so we avoid a
// shallow-index fetch on every session for translations we have already
// characterised. The dynamic fallback below handles anything not listed here.
const BOOK_KEY_ALIASES = {
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
        // Per-translation shallow key index: Map<translation, Map<lowerKey, exactKey>>
        this._shallowIndexCache = new Map();
    }

    setTranslation(translation) {
        this._translation = translation;
    }

    get translation() {
        return this._translation;
    }

    /**
     * Fetches the shallow key index for a translation and returns a Map of
     * lowercase book name → exact stored key. Cached per translation per session.
     *
     * @param {string} translation
     * @returns {Promise<Map<string,string>>}
     */
    async _getShallowIndex(translation) {
        if (this._shallowIndexCache.has(translation)) {
            return this._shallowIndexCache.get(translation);
        }
        const index = new Map();
        try {
            const url = `${FIREBASE_DB_URL}/translations/${encodeURIComponent(translation)}.json?shallow=true`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data && typeof data === 'object') {
                    for (const key of Object.keys(data)) {
                        index.set(key.toLowerCase(), key);
                    }
                }
            }
        } catch (err) {
            console.warn(`BibleApi: shallow index fetch failed for ${translation}`, err);
        }
        this._shallowIndexCache.set(translation, index);
        return index;
    }

    /**
     * Fetches a single book from RTDB.
     * RTDB path: /translations/{translation}/{book}
     * Returns: { "1": { "1": "verse text", ... }, ... } or null on failure.
     *
     * Resolution order when the canonical key returns null:
     *   1. Check BOOK_KEY_ALIASES for a known static alias and retry.
     *   2. Fetch the translation's shallow key index and find the stored key
     *      by case-insensitive match, then retry with that exact key.
     * The successful result is cached under the canonical cache key.
     */
    async _loadBook(translation, book) {
        const cacheKey = `${translation}/${book}`;
        if (this._bookCache.has(cacheKey)) {
            return this._bookCache.get(cacheKey);
        }

        const fetchNode = async (nodeKey) => {
            const url = `${FIREBASE_DB_URL}/translations/${encodeURIComponent(translation)}/${encodeURIComponent(nodeKey)}.json`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status} for ${res.url}`);
            const data = await res.json();
            return (data && typeof data === 'object') ? data : null;
        };

        try {
            let bookData = await fetchNode(book);

            if (bookData === null) {
                // Step 1: try known static alias.
                const alias = BOOK_KEY_ALIASES[book];
                if (alias) {
                    bookData = await fetchNode(alias);
                }
            }

            if (bookData === null) {
                // Step 2: fetch shallow index and find key by case-insensitive match.
                const shallowIndex = await this._getShallowIndex(translation);
                const exactKey = shallowIndex.get(book.toLowerCase());
                if (exactKey && exactKey !== book) {
                    bookData = await fetchNode(exactKey);
                }
            }

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

        for (const book of BOOK_LOAD_ORDER) {
            const bookData = await this._loadBook(this._translation, book);
            if (!bookData) continue;

            // Resolve alias so translations with variant key capitalisation
            // (e.g. "Song Of Solomon" in CSB) are not silently skipped.
            const resolvedKey = _resolveBookKey(bookData, book);
            const resolvedBookData = resolvedKey ? bookData[resolvedKey] ?? bookData : bookData;

            const chapterEntries = Object.entries(resolvedBookData)
                .sort((a, b) => Number(a[0]) - Number(b[0]));

            for (const [chapterStr, chapterData] of chapterEntries) {
                const verseEntries = Object.entries(chapterData)
                    .filter(([verseStr]) => Number(verseStr) > 0)  // skip verse 0
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

        const total = results.length;
        const start = Math.max(0, (page - 1) * PAGE_SIZE);
        return {
            results: results.slice(start, start + PAGE_SIZE),
            total_results: total,
            page_size: PAGE_SIZE,
        };
    }
}
