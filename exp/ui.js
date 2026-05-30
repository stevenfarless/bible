// ui.js
// DOM caching, theme loading, and theme toggling.

export function cacheElements(app) {
	app.passageTitle = document.getElementById('passageTitle');
	app.passageText = document.getElementById('passageText');
	app.copyright = document.getElementById('copyright');
	app.copyBtn = document.getElementById('copyPassage') ?? null;

	// Modals
	app.bookModal = document.getElementById('bookModal');
	app.chapterModal = document.getElementById('chapterModal');
	app.verseModal = document.getElementById('verseModal');
	app.settingsModal = document.getElementById('settingsModal');
	app.helpModal = document.getElementById('helpModal');
	app.loginModal = document.getElementById('loginModal');
	app.signupModal = document.getElementById('signupModal');
	app.userMenuModal = document.getElementById('userMenuModal');
	app.translationModal = document.getElementById('translationModal');

	// Nav
	app.bookSelector = document.getElementById('bookSelector');
	app.chapterSelector = document.getElementById('chapterSelector');
	app.verseSelector = document.getElementById('verseSelector');
	app.translationSelectorBtn = document.getElementById('translationSelectorBtn');
	app.currentBook = document.getElementById('currentBook');
	app.currentChapter = document.getElementById('currentChapter');
	app.currentVerseSpan = document.getElementById('currentVerse');
	app.currentTranslation = document.getElementById('currentTranslation');
	app.prevChapterBtn = document.getElementById('prevChapter');
	app.nextChapterBtn = document.getElementById('nextChapter');

	// Search
	app.searchToggleBtn = document.getElementById('searchToggle');
	app.searchContainer = document.getElementById('searchContainer');
	app.searchInput = document.getElementById('searchInput');
	app.searchResults = document.getElementById('searchResults');
	app.closeSearchBtn = document.getElementById('closeSearch');

	// Header
	app.themeToggleBtn = document.getElementById('themeToggle');
	app.settingsBtn = document.getElementById('settingsBtn');
	app.helpBtn = document.getElementById('helpBtn');
	app.userBtn = document.getElementById('userBtn');

	// Settings
	app.verseNumbersToggle = document.getElementById('verseNumbersToggle');
	app.headingsToggle = document.getElementById('headingsToggle');
	app.footnotesToggle = document.getElementById('footnotesToggle');
	app.verseByVerseToggle = document.getElementById('verseByVerseToggle');
	app.fontSizeSlider = document.getElementById('fontSizeSlider');
	app.fontSizeValue = document.getElementById('fontSizeValue');
	app.translationSelector = document.getElementById('translationSelector');

	// Modals — close buttons
	app.closeBookModal = document.getElementById('closeBookModal');
	app.closeChapterModal = document.getElementById('closeChapterModal');
	app.closeVerseModal = document.getElementById('closeVerseModal');
	app.closeSettingsModal = document.getElementById('closeSettingsModal');
	app.closeHelpModal = document.getElementById('closeHelpModal');
	app.closeLoginModal = document.getElementById('closeLoginModal');
	app.closeSignupModal = document.getElementById('closeSignupModal');
	app.closeUserMenuModal = document.getElementById('closeUserMenuModal');
	app.closeTranslationModal = document.getElementById('closeTranslationModal');

	// Auth UI
	app.loginEmail = document.getElementById('loginEmail');
	app.loginPassword = document.getElementById('loginPassword');
	app.signupEmail = document.getElementById('signupEmail');
	app.signupPassword = document.getElementById('signupPassword');
	app.userEmail = document.getElementById('userEmail');

	// Toast
	app.toast = document.getElementById('toast');
}

export function loadTheme(app) {
	let colorTheme = 'dracula';
	let lightMode  = false;
	try {
		colorTheme = localStorage.getItem('colorTheme') || 'dracula';
		lightMode  = localStorage.getItem('lightMode') === 'true';
	} catch (_) {}

	app.state.colorTheme = colorTheme;
	app.state.lightMode  = lightMode;

	document.body.setAttribute('data-theme', colorTheme);
	document.body.classList.toggle('light-mode', lightMode);
}

export function toggleTheme(app) {
	const newLight = !app.state.lightMode;
	app.state.lightMode = newLight;
	document.body.classList.toggle('light-mode', newLight);
	try { localStorage.setItem('lightMode', String(newLight)); } catch (_) {}

	const toggle = document.getElementById('lightModeToggle');
	if (toggle) toggle.checked = newLight;
}

export function changeColorTheme(app, theme) {
	app.state.colorTheme = theme;
	document.body.setAttribute('data-theme', theme);
	try { localStorage.setItem('colorTheme', theme); } catch (_) {}
}
