// bible-api.js
// Serves Bible text from Firebase Realtime Database.
//
// RTDB path for verse text:  /{translation}/bible/{book}
//   Returns: { "1": { "1": "verse text", ... }, ... }  (chapter → verse → text)
//
// RTDB path for translation index: /translations
//   Returns: [ { id, label, copyright }, ... ]
//
// For BSB the optional `scaffold` parameter (from bsb-structure.js) inserts
// section headings and paragraph breaks into the rendered HTML.

import { FIREBASE_DB_URL } from './firebase-config.js';

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
 * RTDB path: /translations
 * Returns the array of translation objects: [ { id, label, copyright }, ... ]
 */
export async function loadTranslationIndex() {
    const url = `${FIREBASE_DB_URL}/translations.json`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // RTDB may return an object keyed by push-ID or a plain array.
        // Normalise to an array either way.
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
     * RTDB path: /{translation}/bible/{book}
     * Returns: { "1": { "1": "verse text", ... }, ... } or null on failure.
     *
     * Fetching per-book (rather than the entire bible JSON) keeps individual
     * requests small — Genesis is the largest book at ~66 KB.
     */
    async _loadBook(translation, book) {
        const cacheKey = `${translation}/${book}`;
        if (this._bookCache.has(cacheKey)) {
            return this._bookCache.get(cacheKey);
        }

        const url = `${FIREBASE_DB_URL}/${encodeURIComponent(translation)}/bible/${encodeURIComponent(book)}.json`;
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
            .sort((a, b) => a - b)
            .filter((v) => {
                if (verseStart !== null && v < verseStart) return false;
                if (verseEnd !== null && v > verseEnd) return false;
                return true;
            });

        if (!verseNums.length) return null;

        // Build a map: verse number → array of events
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

        const hasScaffold = scaffoldEvents.length > 0;

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
            const renderedText = escapeHtml(text);
            parts.push(
                `<span class="verse" data-verse="${v}" id="v${chapter}-${v}">` +
                `<sup class="verse-num">${v}</sup> ${renderedText} ` +
                `</span>`
            );
        }

        closeP();

        const inner = parts.join('');
        return `<div class="passage"><div class="passage-text">${inner}</div></div>`;
    }

    /**
     * Fetches and renders a passage.
     *
     * @param {string} reference  - e.g. 'John 3' or 'Romans 8:1-17'
     * @param {Array}  scaffoldEvents - Optional pre-filtered chapter scaffold
     *   events from bsb-structure.js eventsForChapter(). Pass [] for non-BSB.
     * @param {boolean} showHeadings
     * @returns {Promise<{passages: string[], canonical: string}|null>}
     */
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

        const chapterData = bookData[String(chapter)];
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

            const chapterEntries = Object.entries(bookData)
                .sort((a, b) => Number(a[0]) - Number(b[0]));

            for (const [chapterStr, chapterData] of chapterEntries) {
                const verseEntries = Object.entries(chapterData)
                    .sort((a, b) => Number(a[0]) - Number(b[0]));

                for (const [verseStr, text] of verseEntries) {
                    const verseText = String(text || '');
                    if (!verseText.toLowerCase().includes(q)) continue;
                    results.push({
                        reference: `${book} ${chapterStr}:${verseStr}`,
                        content: verseText,
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
