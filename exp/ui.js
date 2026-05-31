// ui.js
// Responsibility: DOM caching, theme management

const REQUIRED_IDS = [
	'topChrome',
	'searchToggle', 'helpBtn', 'settingsBtn', 'userBtn',
	'prevChapter', 'nextChapter', 'bookSelector', 'chapterSelector', 'verseSelector',
	'currentBook', 'currentChapter', 'currentVerse',
	'searchContainer', 'closeSearch', 'searchInput', 'searchResults',
	'passageTitle', 'passageText', 'copyright',
	'bookModal', 'chapterModal', 'verseModal', 'settingsModal', 'helpModal',
	'loginModal', 'signupModal', 'userMenuModal',
	'closeBookModal', 'closeChapterModal', 'closeVerseModal',
	'closeSettingsModal', 'closeHelpModal', 'closeLoginModal',
	'closeSignupModal', 'closeUserMenuModal',
	'oldTestamentBooks', 'newTestamentBooks',
	'chapterModalBook', 'chapterGrid', 'verseModalBook', 'verseGrid',
	'verseNumbersToggle', 'headingsToggle', 'footnotesToggle',
	'crossReferencesToggle', 'verseByVerseToggle',
	'fontSizeSlider', 'fontSizeValue',
	'referencesModal', 'closeReferencesModal',
	'deuterocanonInfoModal', 'closeDeuterocanonInfoModal',
	'footnotesSection', 'footnotesContent',
	'crossReferencesSection', 'crossReferencesContent',
	'toast',
	// Nav translation badge
	'translationSelectorBtn', 'currentTranslation',
	'translationModal', 'closeTranslationModal', 'translationList',
];

export function cacheElements(app) {
	// Validate all required IDs exist — warns immediately if HTML is stale or mismatched
	const missing = REQUIRED_IDS.filter(id => !document.getElementById(id));
	if (missing.length > 0) {
		console.warn('[cacheElements] Missing DOM elements:', missing);
	}

	// Top chrome wrapper (Header + Navigation)
	app.topChrome = document.getElementById('topChrome');

	// Header
	app.searchToggleBtn = document.getElementById('searchToggle');
	app.helpBtn = document.getElementById('helpBtn');
	app.settingsBtn = document.getElementById('settingsBtn');
	app.themeToggleBtn = document.getElementById('themeToggle');
	app.userBtn = document.getElementById('userBtn');

	// Navigation
	app.prevChapterBtn = document.getElementById('prevChapter');
	app.nextChapterBtn = document.getElementById('nextChapter');
	app.bookSelector = document.getElementById('bookSelector');
	app.chapterSelector = document.getElementById('chapterSelector');
	app.verseSelector = document.getElementById('verseSelector');
	app.currentBookSpan = document.getElementById('currentBook');
	app.currentChapterSpan = document.getElementById('currentChapter');
	app.currentVerseSpan = document.getElementById('currentVerse');

	// Nav translation badge
	app.translationSelectorBtn = document.getElementById('translationSelectorBtn');
	app.currentTranslationSpan = document.getElementById('currentTranslation');

	// Translation picker modal
	app.translationModal = document.getElementById('translationModal');
	app.closeTranslationModal = document.getElementById('closeTranslationModal');
	app.translationList = document.getElementById('translationList');

	// Search
	app.searchContainer = document.getElementById('searchContainer');
	app.closeSearchBtn = document.getElementById('closeSearch');
	app.searchInput = document.getElementById('searchInput');
	app.searchResults = document.getElementById('searchResults');

	// Passage display
	app.passageTitle = document.getElementById('passageTitle');
	app.passageText = document.getElementById('passageText');
	app.copyright = document.getElementById('copyright');
	app.copyBtn = document.getElementById('copyBtn') ?? null;

	// Modals
	app.bookModal = document.getElementById('bookModal');
	app.chapterModal = document.getElementById('chapterModal');
	app.verseModal = document.getElementById('verseModal');
	app.settingsModal = document.getElementById('settingsModal');
	app.helpModal = document.getElementById('helpModal');
	app.loginModal = document.getElementById('loginModal');
	app.signupModal = document.getElementById('signupModal');
	app.userMenuModal = document.getElementById('userMenuModal');

	// Modal close buttons
	app.closeBookModal = document.getElementById('closeBookModal');
	app.closeChapterModal = document.getElementById('closeChapterModal');
	app.closeVerseModal = document.getElementById('closeVerseModal');
	app.closeSettingsModal = document.getElementById('closeSettingsModal');
	app.closeHelpModal = document.getElementById('closeHelpModal');
	app.closeLoginModal = document.getElementById('closeLoginModal');
	app.closeSignupModal = document.getElementById('closeSignupModal');
	app.closeUserMenuModal = document.getElementById('closeUserMenuModal');

	// Modal content
	app.oldTestamentBooks = document.getElementById('oldTestamentBooks');
	app.newTestamentBooks = document.getElementById('newTestamentBooks');
	app.chapterModalBook = document.getElementById('chapterModalBook');
	app.chapterGrid = document.getElementById('chapterGrid');
	app.verseModalBook = document.getElementById('verseModalBook');
	app.verseGrid = document.getElementById('verseGrid');

	// Settings
	app.verseNumbersToggle = document.getElementById('verseNumbersToggle');
	app.headingsToggle = document.getElementById('headingsToggle');
	app.footnotesToggle = document.getElementById('footnotesToggle');
	app.crossReferencesToggle = document.getElementById('crossReferencesToggle');
	app.verseByVerseToggle = document.getElementById('verseByVerseToggle');
	app.fontSizeSlider = document.getElementById('fontSizeSlider');
	app.fontSizeValue = document.getElementById('fontSizeValue');
	// translationSelector (<select>) was removed from the settings modal;
	// translation switching is handled exclusively by the translationModal.
	app.translationSelector = document.getElementById('translationSelector') ?? null;

	// References modal (footnotes and cross-references)
	app.referencesModal = document.getElementById('referencesModal');
	app.closeReferencesModal = document.getElementById('closeReferencesModal');

	// Deuterocanon info modal
	app.deuterocanonInfoModal = document.getElementById('deuterocanonInfoModal');
	app.closeDeuterocanonInfoModal = document.getElementById('closeDeuterocanonInfoModal');
	app.footnotesSection = document.getElementById('footnotesSection');
	app.footnotesContent = document.getElementById('footnotesContent');
	app.crossReferencesSection = document.getElementById('crossReferencesSection');
	app.crossReferencesContent = document.getElementById('crossReferencesContent');

	// Toast
	app.toast = document.getElementById('toast');
}

// Load theme on app start (uses localStorage as initial fallback)
export function loadTheme(app) {
	let savedLightMode = false;
	try { savedLightMode = localStorage.getItem('lightMode') === 'true'; } catch (_) {}
	if (savedLightMode) {
		document.documentElement.classList.add('light-mode');
		document.body.classList.add('light-mode');
	}
	updateThemeIcon(savedLightMode);
}

// Toggle between light and dark mode
export async function toggleTheme(app) {
	document.documentElement.classList.toggle('light-mode');
	document.body.classList.toggle('light-mode');

	const isLightMode = document.body.classList.contains('light-mode');

	// Always write locally so cold loads get the correct value immediately.
	try { localStorage.setItem('lightMode', isLightMode); } catch (_) {}

	if (app.currentUser) {
		await app.database.ref(`users/${app.currentUser.uid}/settings/lightMode`).set(isLightMode);
	}

	updateThemeIcon(isLightMode);
}

// Update theme icon based on current mode
export function updateThemeIcon(isLightMode) {
	const btn = document.getElementById('themeToggle');
	if (!btn) return;

	const svg = btn.querySelector('svg');
	if (!svg) return;

	if (isLightMode) {
		svg.outerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3
                 7 7 0 0 0 21 12.79z"></path>
      </svg>
    `;
	} else {
		svg.outerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>
    `;
	}
}

export async function changeColorTheme(app, theme) {
	document.body.classList.remove('steel-theme', 'onyx-theme', 'parchment-theme');

	if (theme === 'steel')     document.body.classList.add('steel-theme');
	else if (theme === 'onyx')      document.body.classList.add('onyx-theme');
	else if (theme === 'parchment') document.body.classList.add('parchment-theme');

	// Always write locally so cold loads get the correct value immediately.
	try { localStorage.setItem('colorTheme', theme); } catch (_) {}

	if (app.currentUser) {
		await app.database
			.ref(`users/${app.currentUser.uid}/settings/colorTheme`)
			.set(theme);
	}
}
