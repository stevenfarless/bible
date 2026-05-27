// bible-api.js
// Serves Bible text from Firebase Realtime Database (Firebase translations)
// or from local repo files (local translations).
//
// LOCAL translations load the full {T}_bible.json once, then serve books
// from an in-memory cache — no Firebase calls at all.
//
// FIREBASE translations load per-book from RTDB:
//   /translations/{translation}/{book}
//   Returns: { "1": { "1": "verse text", ... }, ... }  (chapter → verse → text)
//
// RTDB path for search index: /searchIndex/{translation}
//   Returns: { "Genesis 1:1": "in the beginning...", ... }  (ref → lowercased text)
//   Built by scripts/build-search-index.py and stored at build time.
//   searchPassages() uses this when available; falls back to per-book fetches.
//
// For BSB the optional `scaffold` parameter (from bsb-structure.js) inserts
// section headings and paragraph breaks into the rendered HTML.

import { FIREBASE_DB_URL } from './config/firebase-config.js';
import { normaliseBookAlias } from './book-aliases.js';

const PAGE_SIZE = 100;
// Max concurrent RTDB book fetches during search (fallback path only).
const SEARCH_CONCURRENCY = 5;

// Translations served from ./translations/{T}/{T}_bible.json.
// These never hit Firebase.
// Exported so app.js can iterate the set for background prefetching.
export const LOCAL_TRANSLATIONS = new Set(['ASV', 'BLB', 'BSB', 'KJV', 'LEB', 'MSB', 'NET', 'WEB']);

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

// Sorted longest-first once at module load so _parseReference doesn't re-sort
// on every call.
const BOOK_LOAD_ORDER_BY_LENGTH = [...BOOK_LOAD_ORDER].sort((a, b) => b.length - a.length);

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

/**
 * Build a whole-word RegExp for `q` (already lowercased).
 * Falls back to a plain substring test regex if q is empty.
 */
function _buildWordRegex(q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i');
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
        // Cache for flat ref->text search indexes, keyed by translation.
        this._searchIndexCache = new Map();
        // Tracks in-flight local translation fetches so concurrent calls
        // don't trigger duplicate network requests.
        this._localFetchPromise = new Map();
    }

    setTranslation(translation) {
        this._translation = translation;
    }

    get translation() {
        return this._translation;
    }

    // ── Local file loading ────────────────────────────────────────────────

    async _ensureLocalTranslationLoaded(translation) {
        // Already cached — all books present.
        if (this._bookCache.has(`${translation}/Genesis`)) return;

        // Deduplicate concurrent fetches for the same translation.
        if (this._localFetchPromise.has(translation)) {
            return this._localFetchPromise.get(translation);
        }

        const promise = (async () => {
            const url = `./translations/${translation}/${translation}_bible.json`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
            const data = await res.json();
            // Populate per-book cache entries so _loadBook hits immediately.
            for (const [book, chapters] of Object.entries(data)) {
                this._bookCache.set(`${translation}/${book}`, chapters);
            }
        })();

        this._localFetchPromise.set(translation, promise);
        try {
            await promise;
        } finally {
            this._localFetchPromise.delete(translation);
        }
    }

    // ── Firebase loading ──────────────────────────────────────────────────

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

        // ── Local path ────────────────────────────────────────────────────
        if (LOCAL_TRANSLATIONS.has(translation)) {
            try {
                await this._ensureLocalTranslationLoaded(translation);
                // Try canonical name first, then alias.
                if (this._bookCache.has(cacheKey)) {
                    return this._bookCache.get(cacheKey);
                }
                const alias = BOOK_KEY_ALIASES[book];
                if (alias) {
                    const aliasKey = `${translation}/${alias}`;
                    if (this._bookCache.has(aliasKey)) {
                        return this._bookCache.get(aliasKey);
                    }
                }
                console.error(`BibleApi: book "${this._sanitizeForLog(book)}" not found in local ${translation}`);
                return null;
            } catch (err) {
                console.error(`BibleApi: failed to load local translation ${translation}`, err);
                this._bookCache.set(cacheKey, null);
                return null;
            }
        }

        // ── Firebase path ─────────────────────────────────────────────────
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

    async _loadSearchIndex(translation) {
        if (this._searchIndexCache.has(translation)) {
            return this._searchIndexCache.get(translation);
        }
        // Local translations don't have a Firebase search index.
        if (LOCAL_TRANSLATIONS.has(translation)) {
            this._searchIndexCache.set(translation, null);
            return null;
        }
        try {
            const url = `${FIREBASE_DB_URL}/searchIndex/${encodeURIComponent(translation)}.json`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const index = (data && typeof data === 'object') ? data : null;
            this._searchIndexCache.set(translation, index);
            return index;
        } catch (err) {
            console.warn(`BibleApi: search index unavailable for ${translation}, falling back to book fetches`, err);
            this._searchIndexCache.set(translation, null);
            return null;
        }
    }

    /**
     * Parse a reference string into its components.
     *
     * 1. normaliseBookAlias() maps abbreviations/variants to canonical names.
     * 2. Prefix loop against BOOK_LOAD_ORDER_BY_LENGTH for exact canonical matching.
     * 3. Lazy regex fallback for anything not in the canonical list.
     *
     * Chapter/verse delimiter accepts both ":" and " " so "jn 3 16" and
     * "John 3:16" both parse to { book: 'John', chapter: 3, verse: 16 }.
     *
     * @param {string} reference
     * @returns {{ book, chapter, verseStart, verseEnd } | null}
     */
    _parseReference(reference) {
        const raw = String(reference || '').trim();
        const str = normaliseBookAlias(raw);

        for (const name of BOOK_LOAD_ORDER_BY_LENGTH) {
            const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(
                '^(' + escaped + ')\\s+(\\d+)(?:[:\\s](\\d+)(?:-(\\d+))?)?$',
                'i'
            );
            const m = str.match(re);
            if (m) {
                return {
                    book:       name,
                    chapter:    parseInt(m[2], 10),
                    verseStart: m[3] ? parseInt(m[3], 10) : null,
                    verseEnd:   m[4] ? parseInt(m[4], 10) : null,
                };
            }
        }

        // Regex fallback for any reference not in the canonical list.
        const m = str.match(/^((?:[1-3]\s+)?[A-Za-z ]+?)\s+(\d+)(?:[:\s](\d+)(?:-(\d+))?)?$/);
        if (!m) return null;
        return {
            book:       m[1].trim(),
            chapter:    parseInt(m[2], 10),
            verseStart: m[3] ? parseInt(m[3], 10) : null,
            verseEnd:   m[4] ? parseInt(m[4], 10) : null,
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

    async searchPassages(query, onBatchResults = null) {
        const q = String(query || '').toLowerCase().trim();
        if (!q) return { results: [], total_results: 0, page_size: PAGE_SIZE };

        const wordRegex = _buildWordRegex(q);

        // ── Fast path: prebuilt search index ──────────────────────────────────
        const searchIndex = await this._loadSearchIndex(this._translation);

        if (searchIndex !== null) {
            const matches = [];
            for (const [ref, normalizedText] of Object.entries(searchIndex)) {
                if (!wordRegex.test(normalizedText)) continue;
                const colonIdx = ref.lastIndexOf(':');
                const spaceIdx = ref.lastIndexOf(' ', colonIdx);
                matches.push({
                    ref,
                    book:    ref.slice(0, spaceIdx),
                    chapter: Number(ref.slice(spaceIdx + 1, colonIdx)),
                    verse:   Number(ref.slice(colonIdx + 1)),
                });
            }

            const uniqueBooks = [...new Set(matches.map((m) => m.book))];
            const bookDataMap = new Map(
                await Promise.all(
                    uniqueBooks.map(async (book) => [book, await this._loadBook(this._translation, book)])
                )
            );

            const results = [];
            for (const { ref, book, chapter, verse } of matches) {
                const bookData = bookDataMap.get(book);
                const resolvedKey = bookData ? _resolveBookKey(bookData, book) : null;
                const resolvedBookData = resolvedKey ? bookData[resolvedKey] ?? bookData : bookData;
                const originalText = resolvedBookData?.[String(chapter)]?.[String(verse)];
                const text = originalText != null ? String(originalText) : searchIndex[ref];
                results.push({ reference: ref, content: text, book, chapter, verse, text });
            }

            if (results.length > 0 && typeof onBatchResults === 'function') {
                onBatchResults(results);
            }
            return { results, total_results: results.length, page_size: PAGE_SIZE };
        }

        // ── Fallback path: batched per-book fetches ───────────────────────────
        // For local translations, pre-load the whole file first so the per-book
        // loop hits the in-memory cache instead of issuing 66 fetch calls.
        if (LOCAL_TRANSLATIONS.has(this._translation)) {
            try {
                await this._ensureLocalTranslationLoaded(this._translation);
            } catch (err) {
                console.error(`BibleApi: failed to preload local translation ${this._translation} for search`, err);
            }
        }

        const allResults = [];

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
                        if (!wordRegex.test(verseText)) continue;
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
