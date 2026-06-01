// bible-api.js
// Serves Bible text from Firebase Realtime Database (Firebase translations)
// or from local repo files (local translations).
//
// LOCAL translations load one book at a time from ./translations/{T}/{Book}.json,
// then serve subsequent requests for the same book from an in-memory cache.
// No Firebase calls are made for local translations.
//
// FIREBASE translations load per-book from RTDB:
//   /translations/{translation}/{book}
//   Returns: { "1": { "1": "verse text", ... }, ... }  (chapter → verse → text)
//
// Search index path (local):  ./translations/{T}/{T}_search_index.json
// Search index path (Firebase): RTDB /searchIndex/{translation}
//   Both return: { "Genesis 1:1": "in the beginning...", ... }  (ref → lowercased text)
//   Built at build time by scripts/split_translations.py (local) or
//   scripts/build-search-index.py (Firebase).
//
// For BSB the optional `scaffold` parameter (from bsb-structure.js) inserts
// section headings and paragraph breaks into the rendered HTML.

import { FIREBASE_DB_URL } from './config/firebase-config.js';
import { normaliseBookAlias } from './book-aliases.js';

// ── Feature flag ──────────────────────────────────────────────────────────────
// Set to true once Firebase-hosted translations are ready to be served.
// While false, all translation fetches use only local files; the Firebase
// translation/search-index paths are preserved but never called.
const FIREBASE_TRANSLATIONS_ENABLED = false;
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 100;
// Max concurrent RTDB book fetches during search (fallback path only).
const SEARCH_CONCURRENCY = 5;

// Translations served from ./translations/{T}/{Book}.json.
// These never hit Firebase.
// Exported so app.js can iterate the set for background prefetching.
export const LOCAL_TRANSLATIONS = new Set(["ASV", "BLB", "BSB", "CSB", "ESV", "ISV", "KJV", "LEB", "MEV", "MSB", "NET", "NIV", "NKJV", "NLT", "NRSVUE", "WEB"]);

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
    // Deuterocanon
    'Additions to Esther','Bel and the Dragon','Prayer of Manasseh','Letter of Jeremiah',
    'Prayer of Azariah','Wisdom of Solomon','2 Maccabees','4 Maccabees',
    '3 Maccabees','1 Maccabees','Psalm 151','1 Esdras',
    '2 Esdras','Susanna','Sirach','Baruch',
    'Judith','Tobit',
];

// Sorted longest-first once at module load so _parseReference doesn't re-sort
// on every call.
const BOOK_LOAD_ORDER_BY_LENGTH = [...BOOK_LOAD_ORDER].sort((a, b) => b.length - a.length);

// Maps canonical caller-facing name → filename-on-disk for books where they differ.
// When _loadBook resolves via alias, it caches under BOTH the canonical key and
// the alias key so callers using either form always hit cache on subsequent requests.
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
 * Build a prefix-match RegExp for `q` (already lowercased).
 * The leading \b requires the match to start at a word boundary, so
 * mid-word occurrences are excluded (e.g. "whatever" does not match "hate").
 * The absence of a trailing \b means "hate" matches "hated", "hateful",
 * "hateth", etc.
 */
function _buildWordRegex(q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}`, 'i');
}

export async function loadTranslationIndex() {
    if (!FIREBASE_TRANSLATIONS_ENABLED) return [];
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
        // Deduplicates in-flight per-book fetches for local translations.
        // Key: "{translation}/{book}", value: Promise.
        this._localBookFetchPromise = new Map();
        // Deduplicates concurrent in-flight search index fetches.
        // Key: translation, value: Promise. Cleared after fetch settles.
        this._searchIndexFetchPromise = new Map();
    }

    setTranslation(translation) {
        this._translation = translation;
    }

    get translation() {
        return this._translation;
    }

    // ── Firebase loading ──────────────────────────────────────────────────

    async _getShallowIndex(translation) {
        if (!FIREBASE_TRANSLATIONS_ENABLED) return new Map();
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

        // ── Local path: fetch only the one book needed ────────────────────
        if (LOCAL_TRANSLATIONS.has(translation)) {
            // Deduplicate concurrent fetches for the same book.
            if (this._localBookFetchPromise.has(cacheKey)) {
                return this._localBookFetchPromise.get(cacheKey);
            }

            const fetchBook = async (filename) => {
                const url = `./translations/${translation}/${encodeURIComponent(filename)}.json`;
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            };

            const promise = (async () => {
                try {
                    let data;
                    let resolvedAlias = null;
                    try {
                        data = await fetchBook(book);
                    } catch (err) {
                        // Canonical name 404d — retry with alias filename.
                        // Only alias-misses should reach this path; other errors rethrow.
                        const alias = BOOK_KEY_ALIASES[book];
                        if (alias) {
                            data = await fetchBook(alias);
                            resolvedAlias = alias;
                        } else {
                            throw err;
                        }
                    }
                    // Cache under canonical key always.
                    this._bookCache.set(cacheKey, data);
                    // Also cache under alias key so callers using the alias form
                    // hit cache too without a second fetch.
                    if (resolvedAlias) {
                        this._bookCache.set(`${translation}/${resolvedAlias}`, data);
                    }
                    return data;
                } catch (err) {
                    console.error(`BibleApi: failed to load local ${translation}/${this._sanitizeForLog(book)}`, err);
                    this._bookCache.set(cacheKey, null);
                    return null;
                } finally {
                    this._localBookFetchPromise.delete(cacheKey);
                }
            })();

            this._localBookFetchPromise.set(cacheKey, promise);
            return promise;
        }

        // ── Firebase path (disabled until FIREBASE_TRANSLATIONS_ENABLED = true) ──
        if (!FIREBASE_TRANSLATIONS_ENABLED) {
            console.warn(`BibleApi: Firebase translations disabled — cannot load ${translation}/${this._sanitizeForLog(book)}`);
            return null;
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

    async _loadSearchIndex(translation) {
        if (this._searchIndexCache.has(translation)) {
            return this._searchIndexCache.get(translation);
        }

        // Deduplicate concurrent fetches — search can fire multiple queries
        // before the first index fetch resolves, which would otherwise issue
        // duplicate ~500KB requests.
        if (this._searchIndexFetchPromise.has(translation)) {
            return this._searchIndexFetchPromise.get(translation);
        }

        const promise = (async () => {
            try {
                const isLocal = LOCAL_TRANSLATIONS.has(translation);
                // Firebase search index is disabled until FIREBASE_TRANSLATIONS_ENABLED = true.
                if (!isLocal && !FIREBASE_TRANSLATIONS_ENABLED) {
                    this._searchIndexCache.set(translation, null);
                    return null;
                }
                const url = isLocal
                    ? `./translations/${translation}/${translation}_search_index.json`
                    : `${FIREBASE_DB_URL}/searchIndex/${encodeURIComponent(translation)}.json`;
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
            } finally {
                this._searchIndexFetchPromise.delete(translation);
            }
        })();

        this._searchIndexFetchPromise.set(translation, promise);
        return promise;
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
        // Render optional pre-verse prologue/intro stored at key "0"
        const prologueHtml = (chapterData['0'] && verseStart === null)
            ? `<div class="passage-prologue">${escapeHtml(chapterData['0'])}</div>`
            : '';

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
            return prologueHtml + `<p class="passage-para">${spans.join('')}</p>`;
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
        return prologueHtml + parts.join('');
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
        // Per-book fetches are issued directly. For local translations each book
        // is fetched on demand (small file, fast) rather than preloading the
        // full monolith. Already-navigated books are served from _bookCache.
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

    /**
     * Search all LOCAL_TRANSLATIONS that are already loaded in memory,
     * excluding the active translation. Returns only verse references not
     * present in `knownRefs`. Each result is tagged with a `sourceTranslation`
     * property identifying which translation surfaced it.
     *
     * Only runs if query.trim().length >= 3 to avoid expensive scans on
     * short inputs. Translations not yet in the book cache are silently
     * skipped — no network requests are made.
     *
     * @param {string} query
     * @param {Set<string>} knownRefs  References already found in active translation.
     * @returns {Promise<Array>}
     */
    async searchPassagesAllTranslations(query, knownRefs) {
        const q = String(query || '').toLowerCase().trim();
        if (q.length < 3) return [];

        const wordRegex = _buildWordRegex(q);
        const activeTranslation = this._translation;
        const supplemental = [];

        // Collect translations that have at least one book cached.
        const cachedTranslations = [];
        for (const t of LOCAL_TRANSLATIONS) {
            if (t === activeTranslation) continue;
            // Any cached book is enough — we walk only what's in cache.
            const hasAny = BOOK_LOAD_ORDER.some((b) =>
                this._bookCache.has(`${t}/${b}`) || this._bookCache.has(`${t}/${BOOK_KEY_ALIASES[b]}`)
            );
            if (hasAny) cachedTranslations.push(t);
        }

        if (cachedTranslations.length === 0) return [];

        // Run all cached translations in parallel.
        const translationResults = await Promise.all(
            cachedTranslations.map(async (translation) => {
                const found = [];
                for (const book of BOOK_LOAD_ORDER) {
                    const cacheKey = `${translation}/${book}`;
                    const bookData = this._bookCache.get(cacheKey)
                        ?? this._bookCache.get(`${translation}/${BOOK_KEY_ALIASES[book]}`);
                    if (!bookData) continue;

                    const resolvedKey = _resolveBookKey(bookData, book);
                    const resolvedBookData = resolvedKey ? bookData[resolvedKey] ?? bookData : bookData;

                    for (const [chapterStr, chapterData] of Object.entries(resolvedBookData)) {
                        if (!chapterData || typeof chapterData !== 'object') continue;
                        for (const [verseStr, text] of Object.entries(chapterData)) {
                            if (Number(verseStr) <= 0) continue;
                            const verseText = String(text || '');
                            if (!wordRegex.test(verseText)) continue;
                            const ref = `${book} ${chapterStr}:${verseStr}`;
                            if (knownRefs.has(ref)) continue;
                            found.push({
                                reference:         ref,
                                content:           verseText,
                                book,
                                chapter:           Number(chapterStr),
                                verse:             Number(verseStr),
                                text:              verseText,
                                sourceTranslation: translation,
                            });
                        }
                    }
                }
                return found;
            })
        );

        // Merge: deduplicate across supplemental translations too. First
        // translation to surface a ref wins (arbitrary but consistent).\
        const seen = new Set(knownRefs);
        for (const results of translationResults) {
            for (const result of results) {
                if (seen.has(result.reference)) continue;
                seen.add(result.reference);
                supplemental.push(result);
            }
        }

        return supplemental;
    }
}
