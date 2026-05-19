// bible-api.js
// Serves Bible text from local JSON files in translations/ESV/ESV_books/
// Replaces all ESV API (api.esv.org) network calls.

const BASE_PATH = './translations/ESV/ESV_books/';
const PAGE_SIZE = 100;

// Maps internal book names used in references → JSON file stems (where they differ).
const FILE_NAME_MAP = {
    'Psalms': 'Psalm',
    'Song of Solomon': 'Song Of Solomon',
};

function toFileName(book) {
    return FILE_NAME_MAP[book] ?? book;
}

export class BibleApi {
    constructor() {
        this._cache = new Map();   // book name → chapter map (or null on failure)
        this._preloaded = false;
    }

    // Loads and caches one book JSON file. Returns the chapter map or null.
    async _loadBook(book) {
        if (this._cache.has(book)) return this._cache.get(book);

        const fileName = toFileName(book);
        try {
            const res = await fetch(`${BASE_PATH}${encodeURIComponent(fileName)}.json`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            // Top-level key is the file stem (e.g. "Psalm"), not always the book name.
            const data = json[fileName] ?? json[book] ?? null;
            this._cache.set(book, data);
            return data;
        } catch (err) {
            console.error(`BibleApi: failed to load "${book}"`, err);
            this._cache.set(book, null);
            return null;
        }
    }

    // Parses "Book Chapter" or "Book Chapter:Verse[-Verse]" into components.
    // Returns { book, chapter, verseStart, verseEnd } or null.
    _parseReference(reference) {
        const str = (reference || '').trim();
        const m = str.match(/^(\d\s+)?([A-Za-z ]+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
        if (!m) return null;
        const prefix = (m[1] || '').trim();
        const bookName = prefix ? `${prefix} ${m[2].trim()}` : m[2].trim();
        return {
            book: bookName,
            chapter:    parseInt(m[3], 10),
            verseStart: m[4] ? parseInt(m[4], 10) : null,
            verseEnd:   m[5] ? parseInt(m[5], 10) : null,
        };
    }

    // Builds an HTML string shaped like the ESV API passage HTML response.
    // Downstream code writes this as innerHTML, so verse spans use stable class names.
    _buildPassageHtml(book, chapter, chapterData, verseStart, verseEnd) {
        const verseNums = Object.keys(chapterData)
            .map(Number)
            .sort((a, b) => a - b)
            .filter(v => {
                if (verseStart !== null && v < verseStart) return false;
                if (verseEnd   !== null && v > verseEnd)   return false;
                return true;
            });

        const versesHtml = verseNums.map(v => {
            const text = chapterData[String(v)] || '';
            return `<span class="verse" data-verse="${v}"><sup class="verse-num">${v}</sup>${text} </span>`;
        }).join('');

        const rangeLabel = verseStart
            ? `${book} ${chapter}:${verseStart}${verseEnd && verseEnd !== verseStart ? `–${verseEnd}` : ''}`
            : `${book} ${chapter}`;

        return `<div class="passage"><h2 class="passage-title">${rangeLabel}</h2><p class="verse-block">${versesHtml}</p></div>`;
    }

    // Drop-in for the old BibleApi.fetchPassage().
    // Returns { passages: [htmlString], canonical: string } or null.
    async fetchPassage(reference) {
        const parsed = this._parseReference(reference);
        if (!parsed) {
            console.error(`BibleApi: cannot parse reference "${reference}"`);
            return null;
        }

        const { book, chapter, verseStart, verseEnd } = parsed;
        const bookData = await this._loadBook(book);
        if (!bookData) return null;

        const chapterData = bookData[String(chapter)];
        if (!chapterData) {
            console.error(`BibleApi: chapter ${chapter} not found in "${book}"`);
            return null;
        }

        const html = this._buildPassageHtml(book, chapter, chapterData, verseStart, verseEnd);
        const canonical = verseStart
            ? `${book} ${chapter}:${verseStart}${verseEnd && verseEnd !== verseStart ? `-${verseEnd}` : ''}`
            : `${book} ${chapter}`;

        return { passages: [html], canonical };
    }

    // Drop-in for the old BibleApi.searchPassages().
    // Preloads all books on first call, then does client-side full-text search.
    // Returns { results, total_results, page_size } on page 1; empty on subsequent pages
    // so that fetchAllSearchResults()'s pagination loop terminates cleanly.
    async searchPassages(query, page = 1) {
        if (page > 1) {
            return { results: [], total_results: 0, page_size: PAGE_SIZE };
        }

        const q = (query || '').toLowerCase().trim();
        if (!q) return { results: [], total_results: 0, page_size: PAGE_SIZE };

        await this._preloadAllBooks();

        const results = [];
        for (const [book, bookData] of this._cache.entries()) {
            if (!bookData) continue;
            for (const [chapterStr, chapterData] of Object.entries(bookData)) {
                for (const [verseStr, text] of Object.entries(chapterData)) {
                    if (String(text).toLowerCase().includes(q)) {
                        results.push({
                            reference: `${book} ${chapterStr}:${verseStr}`,
                            content:   String(text),
                        });
                    }
                }
            }
        }

        return { results, total_results: results.length, page_size: PAGE_SIZE };
    }

    // Fetches all 66 book files in parallel and populates the cache.
    async _preloadAllBooks() {
        if (this._preloaded) return;
        this._preloaded = true;

        const books = [
            'Genesis','Exodus','Leviticus','Numbers','Deuteronomy',
            'Joshua','Judges','Ruth','1 Samuel','2 Samuel',
            '1 Kings','2 Kings','1 Chronicles','2 Chronicles',
            'Ezra','Nehemiah','Esther','Job','Psalms','Proverbs',
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

        await Promise.all(books.map(b => this._loadBook(b)));
    }
}
