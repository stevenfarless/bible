// bible-api.js
// Serves Bible text from local JSON files: translations/{T}/{T}_bible.json
// Shape: { BookName: { "chapter": { "verse": "text" } } }

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

// Loads translations/index.json and returns the array of translation objects.
// Each object has { id, label, copyright }.
// Returns an empty array on failure so the app degrades gracefully.
export async function loadTranslationIndex() {
    try {
        const res = await fetch('./translations/index.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return Array.isArray(data.translations) ? data.translations : [];
    } catch (err) {
        console.error('BibleApi: failed to load translations/index.json', err);
        return [];
    }
}

export class BibleApi {
    constructor(translation = 'ESV') {
        this._translation = translation;
        // Keyed by translation string, value is the full bible object or null.
        this._bibleCache = new Map();
    }

    setTranslation(translation) {
        this._translation = translation;
    }

    get translation() {
        return this._translation;
    }

    _biblePath(translation) {
        return `./translations/${translation}/${translation}_bible.json`;
    }

    // Loads and caches the full bible JSON for a given translation.
    async _loadBible(translation) {
        if (this._bibleCache.has(translation)) {
            return this._bibleCache.get(translation);
        }

        try {
            const res = await fetch(this._biblePath(translation));
            if (!res.ok) throw new Error(`HTTP ${res.status} for ${res.url}`);

            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseErr) {
                console.error(
                    `BibleApi: JSON parse failed for "${translation}". ` +
                    `Received ${text.length} bytes. Last 200 chars: ` +
                    text.slice(-200)
                );
                throw parseErr;
            }

            this._bibleCache.set(translation, data);
            return data;
        } catch (err) {
            console.error(`BibleApi: failed to load translation "${translation}"`, err);
            this._bibleCache.set(translation, null);
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

    _buildPassageHtml(chapter, chapterData, verseStart, verseEnd) {
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
        const bible = await this._loadBible(this._translation);
        if (!bible) return null;

        const bookData = bible[book];
        if (!bookData) {
            console.error(`BibleApi: book "${book}" not found in ${this._translation}`);
            return null;
        }

        const chapterData = bookData[String(chapter)];
        if (!chapterData) {
            console.error(`BibleApi: chapter ${chapter} not found in "${book}"`);
            return null;
        }

        const normalizedVerseEnd = verseStart !== null ? (verseEnd ?? verseStart) : null;
        const html = this._buildPassageHtml(chapter, chapterData, verseStart, normalizedVerseEnd);
        if (!html) return null;

        const canonical = verseStart !== null
            ? `${book} ${chapter}:${verseStart}${normalizedVerseEnd !== verseStart ? `-${normalizedVerseEnd}` : ''}`
            : `${book} ${chapter}`;

        return { passages: [html], canonical };
    }

    async searchPassages(query, page = 1) {
        const q = String(query || '').toLowerCase().trim();
        if (!q) return { results: [], total_results: 0, page_size: PAGE_SIZE };

        const bible = await this._loadBible(this._translation);
        if (!bible) return { results: [], total_results: 0, page_size: PAGE_SIZE };

        const results = [];

        for (const book of BOOK_LOAD_ORDER) {
            const bookData = bible[book];
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
