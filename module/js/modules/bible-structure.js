// js/modules/bible-structure.js

/**
 * Bible Structure Data
 * Contains book information, chapter counts, and categorization
 */

export const BOOK_ABBREVIATIONS = {
    // Old Testament
    Genesis: 'Gen',
    Exodus: 'Exod',
    Leviticus: 'Lev',
    Numbers: 'Num',
    Deuteronomy: 'Deut',
    Joshua: 'Josh',
    Judges: 'Judg',
    Ruth: 'Ruth',
    '1 Samuel': '1 Sam',
    '2 Samuel': '2 Sam',
    '1 Kings': '1 Kgs',
    '2 Kings': '2 Kgs',
    '1 Chronicles': '1 Chr',
    '2 Chronicles': '2 Chr',
    Ezra: 'Ezra',
    Nehemiah: 'Neh',
    Esther: 'Esth',
    Job: 'Job',
    Psalms: 'Ps',
    Proverbs: 'Prov',
    Ecclesiastes: 'Eccl',
    'Song of Solomon': 'Song',
    Isaiah: 'Isa',
    Jeremiah: 'Jer',
    Lamentations: 'Lam',
    Ezekiel: 'Ezek',
    Daniel: 'Dan',
    Hosea: 'Hos',
    Joel: 'Joel',
    Amos: 'Amos',
    Obadiah: 'Obad',
    Jonah: 'Jonah',
    Micah: 'Mic',
    Nahum: 'Nah',
    Habakkuk: 'Hab',
    Zephaniah: 'Zeph',
    Haggai: 'Hag',
    Zechariah: 'Zech',
    Malachi: 'Mal',

    // New Testament
    Matthew: 'Matt',
    Mark: 'Mark',
    Luke: 'Luke',
    John: 'John',
    Acts: 'Acts',
    Romans: 'Rom',
    '1 Corinthians': '1 Cor',
    '2 Corinthians': '2 Cor',
    Galatians: 'Gal',
    Ephesians: 'Eph',
    Philippians: 'Phil',
    Colossians: 'Col',
    '1 Thessalonians': '1 Thess',
    '2 Thessalonians': '2 Thess',
    '1 Timothy': '1 Tim',
    '2 Timothy': '2 Tim',
    Titus: 'Titus',
    Philemon: 'Phlm',
    Hebrews: 'Heb',
    James: 'Jas',
    '1 Peter': '1 Pet',
    '2 Peter': '2 Pet',
    '1 John': '1 John',
    '2 John': '2 John',
    '3 John': '3 John',
    Jude: 'Jude',
    Revelation: 'Rev',
};

export const CHAPTER_COUNTS = {
    // Old Testament
    Genesis: 50,
    Exodus: 40,
    Leviticus: 27,
    Numbers: 36,
    Deuteronomy: 34,
    Joshua: 24,
    Judges: 21,
    Ruth: 4,
    '1 Samuel': 31,
    '2 Samuel': 24,
    '1 Kings': 22,
    '2 Kings': 25,
    '1 Chronicles': 29,
    '2 Chronicles': 36,
    Ezra: 10,
    Nehemiah: 13,
    Esther: 10,
    Job: 42,
    Psalms: 150,
    Proverbs: 31,
    Ecclesiastes: 12,
    'Song of Solomon': 8,
    Isaiah: 66,
    Jeremiah: 52,
    Lamentations: 5,
    Ezekiel: 48,
    Daniel: 12,
    Hosea: 14,
    Joel: 3,
    Amos: 9,
    Obadiah: 1,
    Jonah: 4,
    Micah: 7,
    Nahum: 3,
    Habakkuk: 3,
    Zephaniah: 3,
    Haggai: 2,
    Zechariah: 14,
    Malachi: 4,

    // New Testament
    Matthew: 28,
    Mark: 16,
    Luke: 24,
    John: 21,
    Acts: 28,
    Romans: 16,
    '1 Corinthians': 16,
    '2 Corinthians': 13,
    Galatians: 6,
    Ephesians: 6,
    Philippians: 4,
    Colossians: 4,
    '1 Thessalonians': 5,
    '2 Thessalonians': 3,
    '1 Timothy': 6,
    '2 Timothy': 4,
    Titus: 3,
    Philemon: 1,
    Hebrews: 13,
    James: 5,
    '1 Peter': 5,
    '2 Peter': 3,
    '1 John': 5,
    '2 John': 1,
    '3 John': 1,
    Jude: 1,
    Revelation: 22,
};

const OLD_TESTAMENT = [
    'Genesis',
    'Exodus',
    'Leviticus',
    'Numbers',
    'Deuteronomy',
    'Joshua',
    'Judges',
    'Ruth',
    '1 Samuel',
    '2 Samuel',
    '1 Kings',
    '2 Kings',
    '1 Chronicles',
    '2 Chronicles',
    'Ezra',
    'Nehemiah',
    'Esther',
    'Job',
    'Psalms',
    'Proverbs',
    'Ecclesiastes',
    'Song of Solomon',
    'Isaiah',
    'Jeremiah',
    'Lamentations',
    'Ezekiel',
    'Daniel',
    'Hosea',
    'Joel',
    'Amos',
    'Obadiah',
    'Jonah',
    'Micah',
    'Nahum',
    'Habakkuk',
    'Zephaniah',
    'Haggai',
    'Zechariah',
    'Malachi',
];

const NEW_TESTAMENT = [
    'Matthew',
    'Mark',
    'Luke',
    'John',
    'Acts',
    'Romans',
    '1 Corinthians',
    '2 Corinthians',
    'Galatians',
    'Ephesians',
    'Philippians',
    'Colossians',
    '1 Thessalonians',
    '2 Thessalonians',
    '1 Timothy',
    '2 Timothy',
    'Titus',
    'Philemon',
    'Hebrews',
    'James',
    '1 Peter',
    '2 Peter',
    '1 John',
    '2 John',
    '3 John',
    'Jude',
    'Revelation',
];

/**
 * Get all books in canonical order
 */
export function getAllBooks() {
    return [...OLD_TESTAMENT, ...NEW_TESTAMENT];
}

/**
 * Get Old Testament books
 */
export function getOldTestamentBooks() {
    return [...OLD_TESTAMENT];
}

/**
 * Get New Testament books
 */
export function getNewTestamentBooks() {
    return [...NEW_TESTAMENT];
}

/**
 * Get chapter count for a book
 */
export function getChapterCount(book) {
    return CHAPTER_COUNTS[book] || 0;
}

/**
 * Get testament for a book
 */
export function getTestament(book) {
    if (OLD_TESTAMENT.includes(book)) {
        return 'Old Testament';
    }
    if (NEW_TESTAMENT.includes(book)) {
        return 'New Testament';
    }
    return null;
}

/**
 * Get abbreviation for a book
 */
export function getAbbreviation(book) {
    return BOOK_ABBREVIATIONS[book] || book;
}
