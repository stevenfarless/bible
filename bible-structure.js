// bible-structure.js
// Bible canon data and book-level lookup helpers.
// All functions accept an `app` instance as their first argument so they can
// read app.bibleBooks and app.bookDisplayNames without coupling to BibleApp.

/**
 * Returns the full OT/NT/Apocrypha structure object:
 *   { testament: { book: chapterCount } }
 * Called once during BibleApp construction; result stored on app.bibleBooks.
 */
export function initializeBibleStructure() {
    return {
        'Old Testament': {
            Genesis: 50, Exodus: 40, Leviticus: 27, Numbers: 36, Deuteronomy: 34,
            Joshua: 24, Judges: 21, Ruth: 4, '1 Samuel': 31, '2 Samuel': 24,
            '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36,
            Ezra: 10, Nehemiah: 13, Esther: 10, Job: 42, Psalm: 150, Proverbs: 31,
            Ecclesiastes: 12, 'Song of Solomon': 8, Isaiah: 66, Jeremiah: 52,
            Lamentations: 5, Ezekiel: 48, Daniel: 12, Hosea: 14, Joel: 3, Amos: 9,
            Obadiah: 1, Jonah: 4, Micah: 7, Nahum: 3, Habakkuk: 3, Zephaniah: 3,
            Haggai: 2, Zechariah: 14, Malachi: 4,
        },
        'New Testament': {
            Matthew: 28, Mark: 16, Luke: 24, John: 21, Acts: 28, Romans: 16,
            '1 Corinthians': 16, '2 Corinthians': 13, Galatians: 6, Ephesians: 6,
            Philippians: 4, Colossians: 4, '1 Thessalonians': 5, '2 Thessalonians': 3,
            '1 Timothy': 6, '2 Timothy': 4, Titus: 3, Philemon: 1, Hebrews: 13,
            James: 5, '1 Peter': 5, '2 Peter': 3, '1 John': 5, '2 John': 1,
            '3 John': 1, Jude: 1, Revelation: 22,
        },
        'Apocrypha': {
            Tobit: 14,
            Judith: 16,
            '1 Maccabees': 16,
            '2 Maccabees': 15,
            '3 Maccabees': 7,
            '4 Maccabees': 18,
            '1 Esdras': 9,
            '2 Esdras': 16,
            'Wisdom of Solomon': 19,
            Sirach: 51,
            Baruch: 5,
            'Letter of Jeremiah': 1,
            'Prayer of Azariah': 1,
            Susanna: 1,
            'Bel and the Dragon': 1,
            'Prayer of Manasseh': 1,
            'Psalm 151': 1,
            'Additions to Esther': 10,
        },
    };
}

/**
 * Returns a flat ordered array of all book names (OT, NT, then Apocrypha).
 * @param {object} app
 * @returns {string[]}
 */
export function getAllBooks(app) {
    return [
        ...Object.keys(app.bibleBooks['Old Testament']),
        ...Object.keys(app.bibleBooks['New Testament']),
        ...Object.keys(app.bibleBooks['Apocrypha'] || {}),
    ];
}

/**
 * Returns the number of chapters in `book`, or 0 if not found.
 * @param {object} app
 * @param {string} book
 * @returns {number}
 */
export function getChapterCount(app, book) {
    for (const testament in app.bibleBooks) {
        if (app.bibleBooks[testament][book]) {
            return app.bibleBooks[testament][book];
        }
    }
    return 0;
}

/**
 * Returns 'Old Testament', 'New Testament', 'Apocrypha', or null.
 * @param {object} app
 * @param {string} book
 * @returns {string|null}
 */
export function getTestament(app, book) {
    if (app.bibleBooks['Old Testament']?.[book]) return 'Old Testament';
    if (app.bibleBooks['New Testament']?.[book]) return 'New Testament';
    if (app.bibleBooks['Apocrypha']?.[book])     return 'Apocrypha';
    return null;
}

/**
 * Returns the display name for a book (e.g. 'Psalm' → 'Psalms').
 * @param {object} app
 * @param {string} book
 * @returns {string}
 */
export function getDisplayName(app, book) {
    return app.bookDisplayNames[book] || book;
}
