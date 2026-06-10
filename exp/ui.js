// Responsibility: DOM caching, theme management
import { applyStoredFontSize, applyStoredLineHeight } from './app.js';

// Mirror classes from <html> to <body> once DOM is ready.
// The inline bootstrap script (index.html <head>) stamps theme classes
// onto <html> before paint. Once DOMContentLoaded fires body is available;
// we clone those classes so body.X-theme selectors in components.css work.
export function mirrorHtmlClassesToBody() {
	// The inline <script> in <head> stamps the theme class and no-color-transition
	// onto document.documentElement before first paint.
	// Once DOMContentLoaded fires, body is available — mirror all classes from
	// <html> to <body> so component CSS targeting body.X-theme continues to work,
	// then remove the transition-suppression class.
	const htmlClasses = [...document.documentElement.classList];
	if (htmlClasses.length) document.body.classList.add(...htmlClasses);
	setTimeout(() => {
		document.documentElement.classList.remove('no-color-transition');
		document.body.classList.remove('no-color-transition');
	}, 50);
}

export function cacheUIElements(app) {
	app.passageContainer = document.getElementById('passageContainer');
	app.passageTitle     = document.getElementById('passageTitle');
	app.passageText      = document.getElementById('passageText');
	app.bookSelect       = document.getElementById('bookSelect');
	app.chapterSelect    = document.getElementById('chapterSelect');
	app.translationSelect = document.getElementById('translationSelect');
	app.navBar           = document.getElementById('navBar');
	app.mainContent      = document.getElementById('mainContent');
	app.settingsPanel    = document.getElementById('settingsPanel');
	app.settingsOverlay  = document.getElementById('settingsOverlay');
	app.searchInput      = document.getElementById('searchInput');
	app.searchModal      = document.getElementById('searchModal');
	app.searchResults    = document.getElementById('searchResults');
	app.searchOverlay    = document.getElementById('searchOverlay');
	app.loadingSpinner   = document.getElementById('loadingSpinner');
	app.searchBtn        = document.getElementById('searchBtn');
	app.settingsBtn      = document.getElementById('settingsBtn');
	app.prevChapterBtn   = document.getElementById('prevChapterBtn');
	app.nextChapterBtn   = document.getElementById('nextChapterBtn');
	app.themeToggleBtn   = document.getElementById('themeToggle');
}

export function populateBookSelect(app) {
	const bookSelect = app.bookSelect;
	if (!bookSelect) return;
	const books = app.getCurrentTranslationBooks();
	bookSelect.innerHTML = '';
	books.forEach(book => {
		const option = document.createElement('option');
		option.value = book.id;
		option.textContent = book.name;
		bookSelect.appendChild(option);
	});
}

export function populateChapterSelect(app) {
	const chapterSelect = app.chapterSelect;
	if (!chapterSelect) return;
	const currentBookId = app.state.book;
	const books = app.getCurrentTranslationBooks();
	const book = books.find(b => b.id === currentBookId);
	const chapterCount = book ? book.chapters : 1;
	chapterSelect.innerHTML = '';
	for (let i = 1; i <= chapterCount; i++) {
		const option = document.createElement('option');
		option.value = i;
		option.textContent = i;
		chapterSelect.appendChild(option);
	}
	chapterSelect.value = app.state.chapter;
}

export function renderPassage(app, passageData) {
	const { passageTitle, passageText } = app;
	if (!passageTitle || !passageText) return;

	passageTitle.textContent = passageData.reference || '';

	if (passageData.html) {
		passageText.innerHTML = passageData.html;
	} else if (Array.isArray(passageData.verses)) {
		passageText.innerHTML = passageData.verses
			.map(v => `<span class="verse"><sup class="verse-num">${v.verse}</sup>${v.text}</span>`)
			.join('');
	} else {
		passageText.textContent = '';
	}
}

export function setLoadingState(app, isLoading) {
	const spinner = app.loadingSpinner;
	if (spinner) spinner.style.display = isLoading ? 'flex' : 'none';
}

export function showError(app, message) {
	const { passageTitle, passageText } = app;
	if (passageTitle) passageTitle.textContent = 'Error';
	if (passageText) passageText.innerHTML = `<p class="error-text">${message}</p>`;
}

export function setNavButtonStates(app) {
	const books = app.getCurrentTranslationBooks();
	const bookIndex = books.findIndex(b => b.id === app.state.book);
	const book = books[bookIndex];
	const isFirstChapter = app.state.chapter <= 1;
	const isLastChapter  = book && app.state.chapter >= book.chapters;
	const isFirstBook    = bookIndex === 0;
	const isLastBook     = bookIndex === books.length - 1;

	if (app.prevChapterBtn) app.prevChapterBtn.disabled = isFirstChapter && isFirstBook;
	if (app.nextChapterBtn) app.nextChapterBtn.disabled = isLastChapter  && isLastBook;
}

// Load theme on app start (uses localStorage as initial fallback)
export function loadTheme() {
	const themeToggleBtn = document.getElementById('themeToggle');
	let lightMode = 'system';
	try { lightMode = localStorage.getItem('lightMode') || 'system'; } catch (_) {}

	let isLight;
	if (lightMode === 'light') {
		isLight = true;
	} else if (lightMode === 'dark') {
		isLight = false;
	} else {
		isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
	}

	document.documentElement.classList.toggle('light-mode', isLight);
	document.body.classList.toggle('light-mode', isLight);
	updateThemeIcon(isLight);
	updateThemeColor();

	const lightModeSelect = document.getElementById('lightModeSelect');
	if (lightModeSelect) lightModeSelect.value = lightMode;

	if (themeToggleBtn) {
		themeToggleBtn.addEventListener('click', () => {
			const currentlyLight = document.documentElement.classList.contains('light-mode');
			const newIsLight = !currentlyLight;
			document.documentElement.classList.toggle('light-mode', newIsLight);
			document.body.classList.toggle('light-mode', newIsLight);
			updateThemeIcon(newIsLight);
			updateThemeColor();
			try {
				const stored = localStorage.getItem('lightMode') || 'system';
				if (stored !== 'system') {
					localStorage.setItem('lightMode', newIsLight ? 'light' : 'dark');
				}
			} catch (_) {}
		});
	}
}

export function applyLightMode(app, mode) {
	let isLight;
	if (mode === 'light') {
		isLight = true;
	} else if (mode === 'dark') {
		isLight = false;
	} else {
		isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
	}

	document.documentElement.classList.toggle('light-mode', isLight);
	document.body.classList.toggle('light-mode', isLight);
	updateThemeIcon(isLight);
	updateThemeColor();

	try { localStorage.setItem('lightMode', mode); } catch (_) {}
}

// Update theme icon based on current mode
export function updateThemeIcon(isLightMode) {
	const btn = document.getElementById('themeToggle');
	if (!btn) return;

	if (isLightMode) {
		btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
        `;
	} else {
		btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
        `;
	}
}

const ALL_THEME_CLASSES = ['parchment-theme', 'vespers-theme', 'vigil-theme', 'dracula-theme', 'dracula2test-theme', 'onyx-theme', 'sage-theme', 'ember-theme', 'perplexity-theme', 'basic-theme', 'geek-theme', 'gnome-theme'];

// bg-base values sourced from css/tokens.css (Dracula/Alucard) and css/themes.css (all others).
// dark = the theme's dark-mode --bg-base; light = the theme's light-mode --bg-base.
const THEME_BG = {
	'basic-theme':        { dark: '#000000', light: '#ffffff' },
	'dracula-theme':      { dark: '#191A21', light: '#FFFBEB' },
	'dracula2test-theme': { dark: '#191A21', light: '#FFFBEB' },
	'onyx-theme':         { dark: '#000000', light: '#faf9f7' },
	'sage-theme':         { dark: '#0d1710', light: '#f6f8f5' },
	'ember-theme':        { dark: '#161009', light: '#faf8f3' },
	'perplexity-theme':   { dark: '#0A1616', light: '#f5f5f5' },
	'geek-theme':         { dark: '#000000', light: '#000000' },
	'gnome-theme':        { dark: '#1e1e1e', light: '#f6f5f4' },
	'parchment-theme':    { dark: '#1a1614', light: '#f5f2ec' },
	'vespers-theme':      { dark: '#1a1714', light: '#f5f2ec' },
	'vigil-theme':        { dark: '#000000', light: '#f5f2ec' },
};

export function updateThemeColor() {
	const isLight = document.documentElement.classList.contains('light-mode');
	const activeClass = [...document.documentElement.classList]
		.find(c => c.endsWith('-theme')) || 'basic-theme';
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
	// Sync removal and addition on both <html> and <body> so that
	// both the :root/:html CSS variable selectors and the body.X-theme
	// component selectors (header, modals, geek overrides) resolve correctly.
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
		await app.database
			.ref(`users/${app.currentUser.uid}/settings/colorTheme`)
			.set(resolved);
	}
}
