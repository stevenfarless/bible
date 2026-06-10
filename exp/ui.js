// ui.js
// Responsibility: DOM caching, theme management

const REQUIRED_IDS = [
	'topChrome',
	'searchToggle', 'settingsBtn',
	'prevChapter', 'nextChapter', 'bookSelector', 'chapterSelector', 'verseSelector',
	'currentBook', 'currentChapter', 'currentVerse',
	'searchContainer', 'closeSearch', 'searchInput', 'searchResults',
	'passageTitle', 'passageText', 'copyright', 'bookModal', 'chapterModal', 'verseModal', 'settingsModal',
	'loginModal', 'signupModal', 'userMenuModal',
	'closeBookModal', 'closeChapterModal', 'closeVerseModal',
	'closeSettingsModal', 'closeLoginModal', 'closeSignupModal', 'closeUserMenuModal',
	'oldTestamentBooks', 'newTestamentBooks',
	'chapterModalBook', 'chapterGrid', 'verseModalBook', 'verseGrid',
	'verseNumbersToggle', 'headingsToggle', 'footnotesToggle',
	'crossReferencesToggle', 'verseByVerseToggle', 'chapterArrowsToggle',
	'fontSizeSlider', 'fontSizeValue',
	'referencesModal', 'closeReferencesModal',
	'deuterocanonInfoModal', 'closeDeuterocanonInfoModal',
	'footnotesSection', 'footnotesContent',
	'crossReferencesSection', 'crossReferencesContent',
	'toast',
	'translationSelectorBtn', 'currentTranslation',
	'translationModal', 'closeTranslationModal', 'translationList',
];

document.addEventListener('DOMContentLoaded', () => {
	const htmlClasses = [...document.documentElement.classList];
	if (htmlClasses.length) document.body.classList.add(...htmlClasses);
	requestAnimationFrame(() => {
		document.documentElement.classList.remove('no-color-transition');
		document.body.classList.remove('no-color-transition');
	});
}, { once: true });

export function cacheElements(app) {
	const missing = REQUIRED_IDS.filter(id => !document.getElementById(id));
	if (missing.length > 0) console.warn('[cacheElements] Missing DOM elements:', missing);

	app.topChrome = document.getElementById('topChrome');
	app.searchToggleBtn = document.getElementById('searchToggle');
	app.settingsBtn = document.getElementById('settingsBtn');
	app.themeToggleBtn = document.getElementById('themeToggle');

	app.prevChapterBtn = document.getElementById('prevChapter');
	app.nextChapterBtn = document.getElementById('nextChapter');
	app.bookSelector = document.getElementById('bookSelector');
	app.chapterSelector = document.getElementById('chapterSelector');
	app.verseSelector = document.getElementById('verseSelector');
	app.currentBookSpan = document.getElementById('currentBook');
	app.currentChapterSpan = document.getElementById('currentChapter');
	app.currentVerseSpan = document.getElementById('currentVerse');

	app.translationSelectorBtn = document.getElementById('translationSelectorBtn');
	app.currentTranslationSpan = document.getElementById('currentTranslation');

	app.translationModal = document.getElementById('translationModal');
	app.closeTranslationModal = document.getElementById('closeTranslationModal');
	app.translationList = document.getElementById('translationList');

	app.searchContainer = document.getElementById('searchContainer');
	app.closeSearchBtn = document.getElementById('closeSearch');
	app.searchInput = document.getElementById('searchInput');
	app.searchResults = document.getElementById('searchResults');

	app.passageTitle = document.getElementById('passageTitle');
	app.passageText = document.getElementById('passageText');
	app.copyright = document.getElementById('copyright');
	app.copyBtn = document.getElementById('copyBtn') ?? null;

	app.bookModal = document.getElementById('bookModal');
	app.chapterModal = document.getElementById('chapterModal');
	app.verseModal = document.getElementById('verseModal');
	app.settingsModal = document.getElementById('settingsModal');
	app.loginModal = document.getElementById('loginModal');
	app.signupModal = document.getElementById('signupModal');
	app.userMenuModal = document.getElementById('userMenuModal');

	app.closeBookModal = document.getElementById('closeBookModal');
	app.closeChapterModal = document.getElementById('closeChapterModal');
	app.closeVerseModal = document.getElementById('closeVerseModal');
	app.closeSettingsModal = document.getElementById('closeSettingsModal');
	app.closeLoginModal = document.getElementById('closeLoginModal');
	app.closeSignupModal = document.getElementById('closeSignupModal');
	app.closeUserMenuModal = document.getElementById('closeUserMenuModal');

	app.oldTestamentBooks = document.getElementById('oldTestamentBooks');
	app.newTestamentBooks = document.getElementById('newTestamentBooks');
	app.chapterModalBook = document.getElementById('chapterModalBook');
	app.chapterGrid = document.getElementById('chapterGrid');
	app.verseModalBook = document.getElementById('verseModalBook');
	app.verseGrid = document.getElementById('verseGrid');

	app.verseNumbersToggle = document.getElementById('verseNumbersToggle');
	app.headingsToggle = document.getElementById('headingsToggle');
	app.footnotesToggle = document.getElementById('footnotesToggle');
	app.crossReferencesToggle = document.getElementById('crossReferencesToggle');
	app.verseByVerseToggle = document.getElementById('verseByVerseToggle');
	app.chapterArrowsToggle = document.getElementById('chapterArrowsToggle');
	app.fontSizeSlider = document.getElementById('fontSizeSlider');
	app.fontSizeValue = document.getElementById('fontSizeValue');

	app.translationSelector = document.getElementById('translationSelector') ?? null;

	app.referencesModal = document.getElementById('referencesModal');
	app.closeReferencesModal = document.getElementById('closeReferencesModal');
	app.deuterocanonInfoModal = document.getElementById('deuterocanonInfoModal');
	app.closeDeuterocanonInfoModal = document.getElementById('closeDeuterocanonInfoModal');
	app.footnotesSection = document.getElementById('footnotesSection');
	app.footnotesContent = document.getElementById('footnotesContent');
	app.crossReferencesSection = document.getElementById('crossReferencesSection');
	app.crossReferencesContent = document.getElementById('crossReferencesContent');

	app.toast = document.getElementById('toast');
}

export function loadTheme() {
	let mode = 'system';
	try {
		const raw = localStorage.getItem('lightMode');
		if (raw === 'true') mode = 'light';
		else if (raw === 'false') mode = 'dark';
		else if (raw === 'light' || raw === 'dark' || raw === 'system') mode = raw;
	} catch (_) {}
	applyLightMode(mode);
}

export function resolveLightMode(mode) {
	if (mode === 'light') return true;
	if (mode === 'dark') return false;
	return window.matchMedia('(prefers-color-scheme: light)').matches;
}

export function applyLightMode(mode) {
	const isLight = resolveLightMode(mode);
	document.documentElement.classList.toggle('light-mode', isLight);
	document.body.classList.toggle('light-mode', isLight);
	updateThemeIcon(isLight);
	updateThemeColor();
}

export async function setLightMode(app, mode) {
	app.state.lightMode = mode;
	const normalized = mode === 'light' || mode === 'dark' || mode === 'system' ? mode : 'system';
	app.state.lightMode = normalized;
	try { localStorage.setItem('lightMode', normalized); } catch (_) {}
	applyLightMode(normalized);
	const sel = document.getElementById('lightModeSelect');
	if (sel) sel.value = normalized;
	if (app.currentUser) {
		await app.database.ref(`users/${app.currentUser.uid}/settings/lightMode`).set(normalized);
	}
}

export function updateThemeIcon(isLightMode) {
	const btn = document.getElementById('themeToggle');
	if (!btn) return;
	const svg = btn.querySelector('svg');
	if (!svg) return;

	if (isLightMode) {
		svg.outerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
	} else {
		svg.outerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle></svg>`;
	}
}

const ALL_THEME_CLASSES = ['parchment-theme','vespers-theme','vigil-theme','dracula-theme','dracula2test-theme','onyx-theme','sage-theme','ember-theme','perplexity-theme','basic-theme','geek-theme','gnome-theme'];

const THEME_BG = { /* unchanged */ };

export function updateThemeColor() {
	const isLight = document.documentElement.classList.contains('light-mode');
	const activeClass = [...document.documentElement.classList].find(c => c.endsWith('-theme')) || 'basic-theme';
	const map = THEME_BG[activeClass] || THEME_BG['basic-theme'];
	const color = isLight ? map.light : map.dark;

	let meta = document.querySelector('meta[name="theme-color"]');
	if (!meta) {
		meta = document.createElement('meta');
		meta.name = 'theme-color';
		document.head.appendChild(meta);
	}
	meta.content = color;
}

export async function changeColorTheme(app, theme) {
	if (!app.state) app.state = {};
	app.state.colorTheme = theme;

	document.documentElement.classList.remove(...ALL_THEME_CLASSES);
	document.body.classList.remove(...ALL_THEME_CLASSES);

	const valid = ALL_THEME_CLASSES.includes(theme + '-theme');
	const resolved = valid ? theme : 'basic';
	const cls = resolved + '-theme';

	document.documentElement.classList.add(cls);
	document.body.classList.add(cls);

	updateThemeColor();

	try { localStorage.setItem('colorTheme', resolved); } catch (_) {}

	if (app.currentUser) {
		await app.database.ref(`users/${app.currentUser.uid}/settings/colorTheme`).set(resolved);
	}
}