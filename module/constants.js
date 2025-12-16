// ==================== 
// Bible Structure & Configuration
// ==================== 

export const API_CONFIG = {
    BASE_URL: 'https://api.esv.org/v3',
    DEFAULT_API_KEY: ''
};

export const BIBLE_BOOKS = {
    'Old Testament': {
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
    },
    'New Testament': {
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
    },
};

export const BOOK_ABBREVIATIONS = {
    Genesis: 'Gen',
    Exodus: 'Exod',
    Leviticus: 'Lev',
    Numbers: 'Num',
    Deuteronomy: 'Deut',
    Joshua: 'Josh',
    Judges: 'Judg',
    Ruth: 'Ruth',
    '1 Samuel': '1Sam',
    '2 Samuel': '2Sam',
    '1 Kings': '1Kgs',
    '2 Kings': '2Kgs',
    '1 Chronicles': '1Chr',
    '2 Chronicles': '2Chr',
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
    Matthew: 'Matt',
    Mark: 'Mark',
    Luke: 'Luke',
    John: 'John',
    Acts: 'Acts',
    Romans: 'Rom',
    '1 Corinthians': '1Cor',
    '2 Corinthians': '2Cor',
    Galatians: 'Gal',
    Ephesians: 'Eph',
    Philippians: 'Phil',
    Colossians: 'Col',
    '1 Thessalonians': '1Thes',
    '2 Thessalonians': '2Thes',
    '1 Timothy': '1Tim',
    '2 Timothy': '2Tim',
    Titus: 'Titus',
    Philemon: 'Phlm',
    Hebrews: 'Heb',
    James: 'Jas',
    '1 Peter': '1Pet',
    '2 Peter': '2Pet',
    '1 John': '1John',
    '2 John': '2John',
    '3 John': '3John',
    Jude: 'Jude',
    Revelation: 'Rev',
};

export function getAllBooks() {
    return [
        ...Object.keys(BIBLE_BOOKS['Old Testament']),
        ...Object.keys(BIBLE_BOOKS['New Testament']),
    ];
}

export function getChapterCount(book) {
    for (const testament in BIBLE_BOOKS) {
        if (BIBLE_BOOKS[testament][book]) {
            return BIBLE_BOOKS[testament][book];
        }
    }
    return 0;
}

export function getTestament(book) {
    if (BIBLE_BOOKS['Old Testament'][book]) return 'Old Testament';
    if (BIBLE_BOOKS['New Testament'][book]) return 'New Testament';
    return null;
}
