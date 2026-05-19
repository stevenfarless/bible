// ====================
// ESV Bible Reader App
// ====================

import { BibleApi } from './bible-api.js';
import {
    initializeState,
    navigateChapter as navChapter,
    scrollToVerse as scrollVerse,
    applyVerseGlow as glowVerse,
} from './reading-state.js';
import { loadUserData as loadUserDataFromFirebase } from './firebase-config.js';
import {
    cacheElements,
    loadTheme,
    toggleTheme,
    updateThemeIcon,
    changeColorTheme,
} from './ui.js';

class BibleApp {
    constructor() {
        // Firebase references
        this.auth = window.firebaseAuth;
        this.database = window.firebaseDatabase;
        this.currentUser = null;

        // Bible structure data
        this.bibleBooks = this.initializeBibleStructure();

        // Book abbreviations for UI
        this.bookAbbreviations = {
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

        // State management (use helper now)
        this.state = initializeState();

        // Cache for search debouncing
        this.searchTimeout = null;

        // Search keyboard navigation state
        this.searchSelectedIndex = -1;
        this.searchResultItems = null;

        // Search pagination state
        this.searchPage = 1;
        this.searchLastQuery = '';
        this.searchHasMore = false;
        this.currentSearchResults = [];

        // Scroll tracking
        this.scrollTimeout = null;

        // Reading position tracking
        this.lastScrollPosition = 0;

        // Auto-hide chrome (Header + Nav)
        this.chromeHidden = false;
        this.chromeScrollLastY = window.scrollY || 0;
        this.chromeDelta = 2;
        this.chromeScrollTicking = false;
        this.chromeSuspend = false;

        // Define chrome functions ON THE INSTANCE (so they exist at runtime)
        this.showChrome = () => {
            if (!this.chromeHidden) return;
            document.body.classList.remove('chrome-hidden');
            this.chromeHidden = false;
        };

        this.hideChrome = () => {
            if (this.chromeHidden) return;
            document.body.classList.add('chrome-hidden');
            this.chromeHidden = true;
        };

        this.handleChromeScroll = () => {
            if (this.chromeScrollTicking) return;
            this.chromeScrollTicking = true;
            if (this.chromeSuspend) {
                this.chromeScrollLastY = window.scrollY || window.pageYOffset || 0;
                this.chromeScrollTicking = false;
                return;
            }

            window.requestAnimationFrame(() => {
                const y = window.scrollY || window.pageYOffset || 0;
                const delta = y - this.chromeScrollLastY;

                const modalOpen = !!document.querySelector('.modal.active');
                const searchOpen = !!this.searchContainer?.classList.contains('active');

                if (y <= 0 || modalOpen || searchOpen) {
                    this.showChrome();
                    this.chromeScrollLastY = y;
                    this.chromeScrollTicking = false;
                    return;
                }

                if (delta > this.chromeDelta) this.hideChrome();
                if (delta < -this.chromeDelta) this.showChrome();

                this.chromeScrollLastY = y;
                this.chromeScrollTicking = false;
            });
        };

        // stores untouched HTML for current chapter
        this.originalPassageHtml = null;

        // Search grouping expansion state
        this.searchExpandedTestaments = new Set(); // e.g., "Old Testament", "New Testament"
        this.searchExpandedBooks = new Set();      // e.g., "Genesis", "Romans"

        // Bible reader (local JSON files)
        this.bibleApi = new BibleApi();

        // this.searchPage = 1;
        // this.searchLastQuery = '';
        // this.searchHasMore = false;

   