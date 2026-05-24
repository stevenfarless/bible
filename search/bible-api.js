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
// Max concurrent RTDB book fetches during search. Each book can be
// hundreds of KB; too many in parallel stalls the connection on mobile.
const SEARCH_CONCURRENCY = 5;

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

const BOOK_KEY_ALIASES = {
    'Song of Solomon': 'Song Of Solomon',
};

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
        this._bookCache = new Map();
        this._shallowIndexCache = new Map();
    }

    setTranslation(translation) {
        this._translation = translation;
    }

    get translation() {
        return this._translation;
    }

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
                const alias = BOOK_KEY_ALIASES[book];
                if (alias) bookData = await fetchNode(alias);
            }

            if (bookData === null) {
                const shallowIndex = await this._getShallowIndex(translation);
                const exactKey = shallowIndex.get(book.toLowerCase());
                if (exactKey && exactKey !== book) bookData = await fetchNode(exactKey);
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

    _buildPassageHtml(chapter, chapterData, verseStart, verseEnd, scaffoldEvents = [], showHeadings = true) {
        const verseNums = Object.keys(chapterData)
            .map(Number)
            .filter(Number.isFinite)
            .filter((v) => v > 0)
            .sort((a, b) => a - b)
            .filter((v) => {
                if (verseStart !== null && v < verseStart) return false;
                if (verseEnd !== null && v > verseEnd) return false;
                return true;
            });

        if (!verseNums.length) return null;

        const hasScaffold = scaffoldEvents.length > 0;

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

        const eventMap = new Map();
        for (const evt of scaffoldEvents) {
            if (!eventMap.has(evt.v)) eventMap.set(evt.v, []);
            eventMap.get(evt.v).push(evt);
        }

        const parts = [];
        let inParagraph = false;

        const openP = () => { parts.push('<p class="passage-para">'); inParagraph = true; };
        const closeP = () => { if (inParagraph) { parts.push('</p>'); inParagraph = false; } };

        for (const v of verseNums) {
            const eventsHere = eventMap.get(v) || [];
            for (const evt of eventsHere) {
                if (evt.type === 'heading') {
                    if (showHeadings) { closeP(); parts.push(`<h3 class="pericope-heading">${escapeHtml(evt.text)}</h3>`); }
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

        const resolvedKey = _resolveBookKey(bookData, book);
        const resolvedBookData = resolvedKey ? bookData[resolvedKey] ?? bookData : bookData;

        const chapterData = resolvedBookData[String(chapter)];
        if (!chapterData) {
            console.error(`BibleApi: chapter ${chapter} not found in "${this._sanitizeForLog(book)}"`);
            return null;
        }

        const normalizedVerseEnd = verseStart !== null ? (verseEnd ?? verseStart) : null;
        const html = this._buildPassageHtml(chapter, chapterData, verseStart, normalizedVerseEnd, scaffoldEvents, showHeadings);
        if (!html) return null;

        const canonical = verseStart !== null
            ? `${book} ${chapter}:${verseStart}${normalizedVerseEnd !== verseStart ? `-${normalizedVerseEnd}` : ''}`
            : `${book} ${chapter}`;

        return { passages: [html], canonical };
    }

    /**
     * Search all books for verses matching `query`.
     *
     * Books are fetched in batches of SEARCH_CONCURRENCY (5) so at most 5
     * large RTDB payloads are in-flight at once. After each batch settles,
     * any matched verses are passed to the optional `onBatchResults` callback
     * so the caller can render incrementally without waiting for all 66 books.
     *
     * @param {string} query
     * @param {function(Array):void} [onBatchResults]  - called with new results after each batch
     * @returns {Promise<{results: Array, total_results: number, page_size: number}>}
     */
    async searchPassages(query, onBatchResults = null) {
        const q = String(query || '').toLowerCase().trim();
        if (!q) return { results: [], total_results: 0, page_size: PAGE_SIZE };

        const allResults = [];

        // Process books in batches of SEARCH_CONCURRENCY.
        for (let i = 0; i < BOOK_LOAD_ORDER.length; i += SEARCH_CONCURRENCY) {
            const batch = BOOK_LOAD_ORDER.slice(i, i + SEARCH_CONCURRENCY);

            const bookDataList = await Promise.all(
                batch.map((book) => this._loadBook(this._translation, book))
            );

            const batchResults = [];

            for (let j = 0; j < batch.length; j++) {
                const book = batch[j];
                const bookData = bookDataList[j];
                if (!bookData) continue;

                const resolvedKey = _resolveBookKey(bookData, book);
                const resolvedBookData = resolvedKey ? bookData[resolvedKey] ?? bookData : bookData;

                const chapterEntries = Object.entries(resolvedBookData)
                    .sort((a, b) => Number(a[0]) - Number(b[0]));

                for (const [chapterStr, chapterData] of chapterEntries) {
                    if (!chapterData || typeof chapterData !== 'object') continue;
                    const verseEntries = Object.entries(chapterData)
                        .filter(([verseStr]) => Number(verseStr) > 0)
                        .sort((a, b) => Number(a[0]) - Number(b[0]));

                    for (const [verseStr, text] of verseEntries) {
                        const verseText = String(text || '');
                        if (!verseText.toLowerCase().includes(q)) continue;
                        batchResults.push({
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

            if (batchResults.length > 0) {
                allResults.push(...batchResults);
                if (typeof onBatchResults === 'function') {
                    onBatchResults(batchResults);
                }
            }
        }

        return {
            results: allResults,
            total_results: allResults.length,
            page_size: PAGE_SIZE,
        };
    }
}
