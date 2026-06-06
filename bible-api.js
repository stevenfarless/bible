// bible-api.js
import { FIREBASE_DB_URL } from './config/firebase-config.js';
import { normaliseBookAlias } from './book-aliases.js';
import {
    idbGetBook, idbPutBook,
    idbGetSearchIndex, idbPutSearchIndex,
    idbIsDownloaded, idbMarkDownloaded,
    idbDeleteTranslation,
} from './translation-store.js';

const FIREBASE_TRANSLATIONS_ENABLED = false;

const PAGE_SIZE = 100;
const SEARCH_CONCURRENCY = 5;

export const PRECACHED_TRANSLATIONS = new Set([
    "BSB", "KJV",
]);

export const LOCAL_TRANSLATIONS = new Set([
    "ASV", "BLB", "BSB", "CSB", "ESV", "ISV", "KJV", "LEB",
    "MEV", "MSB", "NET", "NIV", "NKJV", "NLT", "NRSVUE", "WEB",
]);

const REPO_TRANSLATIONS = new Set([
    "ASV", "BLB", "BSB", "CSB", "ESV", "ISV", "KJV", "LEB",
    "MEV", "MSB", "NET", "NIV", "NKJV", "NLT", "NRSVUE", "WEB",
]);

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

const BOOK_LOAD_ORDER_BY_LENGTH = [...BOOK_LOAD_ORDER].sort((a, b) => b.length - a.length);

const BOOK_KEY_ALIASES = {
    'Song of Solomon': 'Song of Solomon',
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
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function _buildWordRegex(q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i');
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
        this._searchIndexCache = new Map();
        this._localBookFetchPromise = new Map();
        this._searchIndexFetchPromise = new Map();
        this._translationBookLists = new Map();
    }

    setTranslation(translation) {
        this._translation = translation;
    }

    get translation() {
        return this._translation;
    }

    setBookList(translation, bookNames) {
        if (!translation || !Array.isArray(bookNames) || bookNames.length === 0) return;
        this._translationBookLists.set(translation, bookNames);
    }

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

        if (REPO_TRANSLATIONS.has(translation)) {
            if (this._localBookFetchPromise.has(cacheKey)) {
                return this._localBookFetchPromise.get(cacheKey);
            }

            const fetchBookFromNetwork = async (filename) => {
                const url = `./translations/${translation}/${encodeURIComponent(filename)}.json`;
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            };

            const promise = (async () => {
                try {
                    if (!PRECACHED_TRANSLATIONS.has(translation)) {
                        const cached = await idbGetBook(translation, book);
                        if (cached !== null) {
                            this._bookCache.set(cacheKey, cached);
                            return cached;
                        }
                        // Not installed — do not fetch from network.
                        this._bookCache.set(cacheKey, null);
                        return null;
                    }

                    const filename = BOOK_KEY_ALIASES[book] ?? book;
                    const data = await fetchBookFromNetwork(filename);
                    this._bookCache.set(cacheKey, data);
                    if (filename !== book) {
                        this._bookCache.set(`${translation}/${filename}`, data);
                    }
                    return data;
                } catch (err) {
                    console.error(`BibleApi: failed to load ${translation}/${this._sanitizeForLog(book)}`, err);
                    this._bookCache.set(cacheKey, null);
                    return null;
                } finally {
                    this._localBookFetchPromise.delete(cacheKey);
                }
            })();

            this._localBookFetchPromise.set(cacheKey, promise);
            return promise;
        }

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

        if (this._searchIndexFetchPromise.has(translation)) {
            return this._searchIndexFetchPromise.get(translation);
        }

        const promise = (async () => {
            try {
                const isRepo = REPO_TRANSLATIONS.has(translation);
                if (!isRepo && !FIREBASE_TRANSLATIONS_ENABLED) {
                    this._searchIndexCache.set(translation, null);
                    return null;
                }

                if (isRepo && !PRECACHED_TRANSLATIONS.has(translation)) {
                    // Only serve installed translations — never fetch network data for
                    // a translation the user has not explicitly downloaded.
                    const installed = await idbIsDownloaded(translation);
                    if (!installed) {
                        this._searchIndexCache.set(translation, null);
                        return null;
                    }

                    const cached = await idbGetSearchIndex(translation);
                    if (cached !== null && typeof cached === 'object' && Object.keys(cached).length > 0) {
                        this._searchIndexCache.set(translation, cached);
                        return cached;
                    }
                    // Installed but search index missing from IDB — re-fetch and store.
                }

                const url = isRepo
                    ? `./translations/${translation}/${translation}_search_index.json`
                    : `${FIREBASE_DB_URL}/searchIndex/${encodeURIComponent(translation)}.json`;
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const index = (data && typeof data === 'object' && Object.keys(data).length > 0) ? data : null;
                this._searchIndexCache.set(translation, index);
                if (isRepo && !PRECACHED_TRANSLATIONS.has(translation) && index !== null) {
                    idbPutSearchIndex(translation, index).catch(() => {});
                }
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

    async downloadTranslation(translation, bookList, onProgress) {
        const books = bookList?.length ? bookList : BOOK_LOAD_ORDER;
        const total = books.length;
        let done = 0;

        const fetchAndStore = async (book) => {
            const cacheKey = `${translation}/${book}`;
            let data = this._bookCache.get(cacheKey) ?? null;
            if (data === null) {
                try {
                    const filename = BOOK_KEY_ALIASES[book] ?? book;
                    const url = `./translations/${translation}/${encodeURIComponent(filename)}.json`;
                    const res = await fetch(url);
                    if (res.ok) {
                        data = await res.json();
                        this._bookCache.set(cacheKey, data);
                    }
                } catch (_) {}
            }
            if (data !== null) await idbPutBook(translation, book, data);
            done++;
            onProgress?.(done, total);
        };

        const BATCH = 4;
        for (let i = 0; i < books.length; i += BATCH) {
            await Promise.all(books.slice(i, i + BATCH).map(fetchAndStore));
        }

        try {
            const url = `./translations/${translation}/${translation}_search_index.json`;
            const res = await fetch(url);
            if (res.ok) {
                const idx = await res.json();
                await idbPutSearchIndex(translation, idx);
                this._searchIndexCache.set(translation, idx);
            }
        } catch (_) {}

        await idbMarkDownloaded(translation);
    }

    evictTranslation(translation) {
        const prefix = `${translation}/`;
        for (const key of [...this._bookCache.keys()]) {
            if (key.startsWith(prefix)) this._bookCache.delete(key);
        }
        this._searchIndexCache.delete(translation);
        this._shallowIndexCache.delete(translation);
        this._translationBookLists.delete(translation);
    }

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
            const bookDataMap = new Map();

            for (let i = 0; i < uniqueBooks.length; i += SEARCH_CONCURRENCY) {
                const chunk = uniqueBooks.slice(i, i + SEARCH_CONCURRENCY);
                const entries = await Promise.all(
                    chunk.map(async (book) => [book, await this._loadBook(this._translation, book)])
                );
                for (const [book, data] of entries) bookDataMap.set(book, data);

                if (typeof onBatchResults === 'function') {
                    const partial = [];
                    for (const { ref, book, chapter, verse } of matches) {
                        if (!bookDataMap.has(book)) continue;
                        const bookData = bookDataMap.get(book);
                        const resolvedKey = bookData ? _resolveBookKey(bookData, book) : null;
                        const resolvedBookData = resolvedKey ? bookData[resolvedKey] ?? bookData : bookData;
                        const originalText = resolvedBookData?.[String(chapter)]?.[String(verse)];
                        const text = originalText != null ? String(originalText) : searchIndex[ref];
                        partial.push({ reference: ref, content: text, book, chapter, verse, text });
                    }
                    if (partial.length > 0) onBatchResults(partial);
                }
            }

            const results = [];
            for (const { ref, book, chapter, verse } of matches) {
                const bookData = bookDataMap.get(book);
                const resolvedKey = bookData ? _resolveBookKey(bookData, book) : null;
                const resolvedBookData = resolvedKey ? bookData[resolvedKey] ?? bookData : bookData;
                const originalText = resolvedBookData?.[String(chapter)]?.[String(verse)];
                const text = originalText != null ? String(originalText) : searchIndex[ref];
                results.push({ reference: ref, content: text, book, chapter, verse, text });
            }

            return { results, total_results: results.length, page_size: PAGE_SIZE };
        }

        const bookList = this._translationBookLists.get(this._translation) ?? BOOK_LOAD_ORDER;
        const allResults = [];

        for (let i = 0; i < bookList.length; i += SEARCH_CONCURRENCY) {
            const batch = bookList.slice(i, i + SEARCH_CONCURRENCY);
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
                if (typeof onBatchResults === 'function') onBatchResults(batchResults);
            }
        }

        return { results: allResults, total_results: allResults.length, page_size: PAGE_SIZE };
    }

    async searchPassagesAllTranslations(query, knownRefs) {
        const q = String(query || '').toLowerCase().trim();
        if (q.length < 3) return [];

        const wordRegex = _buildWordRegex(q);
        const activeTranslation = this._translation;

        // Only search translations the user has explicitly installed, plus precached ones.
        // Never touch a translation that isn't on the user's device.
        const installedChecks = await Promise.all(
            [...LOCAL_TRANSLATIONS]
                .filter((t) => t !== activeTranslation)
                .map(async (t) => ({
                    t,
                    ok: PRECACHED_TRANSLATIONS.has(t) || await idbIsDownloaded(t),
                }))
        );
        const candidates = installedChecks.filter((c) => c.ok).map((c) => c.t);

        if (candidates.length === 0) return [];

        // knownRefs are bare refs from the active translation (e.g. "John 3:16").
        // Skip any ref from another translation that is the same canonical address —
        // megasearch only adds value when a verse appears in an installed translation
        // that was not already surfaced by the active translation's search.
        const supplemental = [];

        await Promise.all(candidates.map(async (translation) => {
            const searchIndex = await this._loadSearchIndex(translation);

            if (searchIndex !== null) {
                const matches = [];
                for (const [ref, normalizedText] of Object.entries(searchIndex)) {
                    if (knownRefs.has(ref)) continue;
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
                        uniqueBooks.map(async (book) => [book, await this._loadBook(translation, book)])
                    )
                );

                for (const { ref, book, chapter, verse } of matches) {
                    const bookData = bookDataMap.get(book);
                    const resolvedKey = bookData ? _resolveBookKey(bookData, book) : null;
                    const resolvedBookData = resolvedKey ? bookData[resolvedKey] ?? bookData : bookData;
                    const originalText = resolvedBookData?.[String(chapter)]?.[String(verse)];
                    const text = originalText != null ? String(originalText) : searchIndex[ref];
                    supplemental.push({
                        reference:         ref,
                        content:           text,
                        book,
                        chapter,
                        verse,
                        text,
                        sourceTranslation: translation,
                    });
                }
                return;
            }

            // No search index — fall back to only already-cached book data in memory.
            // This path never triggers a network fetch.
            for (const book of BOOK_LOAD_ORDER) {
                const bookData = this._bookCache.get(`${translation}/${book}`)
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
                        supplemental.push({
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
        }));

        return supplemental;
    }
}
