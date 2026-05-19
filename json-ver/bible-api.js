// bible-api.js
// Serves Bible text from local JSON files in translations/{TRANSLATION}/{TRANSLATION}_books/

const PAGE_SIZE = 100;

const FILE_NAME_OVERRIDES = {
    Psalms: 'Psalm',
    'Song of Solomon': 'Song Of Solomon',
};

const BOOK_LOAD_ORDER = [
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

function toFileName(book) {
    return FILE_NAME_OVERRIDES[book] ?? book;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export class BibleApi {
    constructor(translation = 'ESV') {
        this._translation = translation;
        this._cache = new Map();
        this._preloaded = false;
    }

    setTranslation(translation) {
        if (this._translation === translation) return;
        this._translation = translation;
        this._preloaded = false;
        this._cache.clear();
    }

    get translation() {
        return this._translation;
    }

    _cacheKey(book) {
        return `${this._translation}:${book}`;
    }

    _basePath() {
        return `./translations/${this._translation}/${this._translation}_books/`;
    }

    async _loadBook(book) {
        const key = this._cacheKey(book);
        if (this._cache.has(key)) return this._cache.get(key);

        const fileName = toFileName(book);
        try {
            const res = await fetch(`${this._basePath()}${fileName}.json`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const data = json[fileName] ?? json[book] ?? null;
            this._cache.set(key, data);
            return data;
        } catch (err) {
            console.error(`BibleApi [${this._translation}]: failed to load "${book}"`, err);
            this._cache.set(key, null);
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

    _buildPassageHtml(book, chapter, chapterData, verseStart, verseEnd) {
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

        const versesHtml = verseNums.map((v) => {
            const text = escapeHtml(chapterData[String(v)] || '');
            return `<span class="verse" data-verse="${v}" id="v${chapter}-${v}"><sup class="verse-num">${v}</sup>${text} </span>`;
        }).join('');

        return `<div class="passage"><div class="passage-text">${versesHtml}</div></div>`;
    }

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

        const normalizedVerseEnd = verseStart !== null ? (verseEnd ?? verseStart) : null;
        const html = this._buildPassageHtml(book, chapter, chapterData, verseStart, normalizedVerseEnd);
        if (!html) return null;

        const canonical = verseStart !== null
            ? `${book} ${chapter}:${verseStart}${normalizedVerseEnd !== verseStart ? `-${normalizedVerseEnd}` : ''}`
            : `${book} ${chapter}`;

        return { passages: [html], canonical };
    }

    async searchPassages(query, page = 1) {
        const q = String(query || '').toLowerCase().trim();
        if (!q) {
            return { results: [], total_results: 0, page_size: PAGE_SIZE };
        }

        await this._preloadAllBooks();

        const results = [];
        for (const book of BOOK_LOAD_ORDER) {
            const bookData = this._cache.get(this._cacheKey(book));
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

        const totalResults = results.length;
        const startIndex = Math.max(0, (page - 1) * PAGE_SIZE);
        const pagedResults = results.slice(startIndex, startIndex + PAGE_SIZE);

        return {
            results: pagedResults,
            total_results: totalResults,
            page_size: PAGE_SIZE,
        };
    }

    async _preloadAllBooks() {
        if (this._preloaded) return;
        this._preloaded = true;
        await Promise.all(BOOK_LOAD_ORDER.map((book) => this._loadBook(book)));
    }
}
