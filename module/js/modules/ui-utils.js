// js/modules/ui-utils.js
// Responsibility: DOM caching, theme management

// Cache all DOM elements the UI layer needs
// NOTE: this takes the UI MANAGER instance, not the app
export function cacheElements(ui) {
  // Header
  ui.searchToggleBtn = document.getElementById('searchToggleBtn');
  ui.helpBtn = document.getElementById('helpBtn');
  ui.settingsBtn = document.getElementById('settingsBtn');
  ui.userBtn = document.getElementById('userBtn');
  ui.copyBtn = document.getElementById('copyBtn');
  ui.themeToggleBtn = document.getElementById('themeToggleBtn');

  // Navigation
  ui.prevChapterBtn = document.getElementById('prevChapterBtn');
  ui.nextChapterBtn = document.getElementById('nextChapterBtn');
  ui.bookSelector = document.getElementById('bookSelector');
  ui.chapterSelector = document.getElementById('chapterSelector');
  ui.verseSelector = document.getElementById('verseSelector');
  ui.currentBookSpan = document.getElementById('currentBook');
  ui.currentChapterSpan = document.getElementById('currentChapter');
  ui.currentVerseSpan = document.getElementById('currentVerse');

  // Passage
  ui.passageTitle = document.getElementById('passageTitle');
  ui.passageText = document.getElementById('passageText');
  ui.copyright = document.getElementById('copyrightText'); // ← ADD THIS LINE

  // Search
  ui.searchContainer = document.getElementById('searchContainer');
  ui.searchInput = document.getElementById('searchInput');
  ui.searchResults = document.getElementById('searchResults');
  ui.closeSearchBtn = document.getElementById('closeSearchBtn');

  // Modals
  ui.bookModal = document.getElementById('bookModal');
  ui.chapterModal = document.getElementById('chapterModal');
  ui.verseModal = document.getElementById('verseModal');
  ui.settingsModal = document.getElementById('settingsModal');
  ui.helpModal = document.getElementById('helpModal');
  ui.loginModal = document.getElementById('loginModal');
  ui.signupModal = document.getElementById('signupModal');
  ui.userMenuModal = document.getElementById('userMenuModal');
  ui.referencesModal = document.getElementById('referencesModal');

  // Modal close buttons
  ui.closeBookModal = document.getElementById('closeBookModal');
  ui.closeChapterModal = document.getElementById('closeChapterModal');
  ui.closeVerseModal = document.getElementById('closeVerseModal');
  ui.closeSettingsModal = document.getElementById('closeSettingsModal');
  ui.closeHelpModal = document.getElementById('closeHelpModal');
  ui.closeLoginModal = document.getElementById('closeLoginModal');
  ui.closeSignupModal = document.getElementById('closeSignupModal');
  ui.closeUserMenuModal = document.getElementById('closeUserMenuModal');
  ui.closeReferencesModal = document.getElementById('closeReferencesModal');

  // Modal content areas
  ui.oldTestamentBooks = document.getElementById('oldTestamentBooks');
  ui.newTestamentBooks = document.getElementById('newTestamentBooks');
  ui.chapterModalBook = document.getElementById('chapterModalBook');
  ui.chapterGrid = document.getElementById('chapterGrid');
  ui.verseModalBook = document.getElementById('verseModalBook');
  ui.verseGrid = document.getElementById('verseGrid');
  ui.referencesContent = document.getElementById('referencesContent');

  // Settings
  ui.apiKeyInput = document.getElementById('apiKeyInput');
  ui.saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
  ui.verseNumbersToggle = document.getElementById('verseNumbersToggle');
  ui.headingsToggle = document.getElementById('headingsToggle');
  ui.footnotesToggle = document.getElementById('footnotesToggle');
  ui.crossReferencesToggle = document.getElementById('crossReferencesToggle');
  ui.verseByVerseToggle = document.getElementById('verseByVerseToggle');
  ui.fontSizeSlider = document.getElementById('fontSizeSlider');
  ui.fontSizeValue = document.getElementById('fontSizeValue');

  // Toast
  ui.toast = document.getElementById('toast');
}

// Load theme on app start (uses localStorage as initial fallback)
export function loadTheme(app) {
  const savedLightMode = localStorage.getItem('lightMode') === 'true';
  const savedTheme = localStorage.getItem('colorTheme') || 'dracula';

  if (savedLightMode) {
    document.documentElement.classList.add('light-mode');
    document.body.classList.add('light-mode');
  } else {
    document.documentElement.classList.remove('light-mode');
    document.body.classList.remove('light-mode');
  }

  changeColorTheme(app, savedTheme);
  updateThemeIcon(savedLightMode);
}

// Toggle between light and dark mode
export async function toggleTheme(app) {
  document.documentElement.classList.toggle('light-mode');
  document.body.classList.toggle('light-mode');

  const isLightMode = document.body.classList.contains('light-mode');

  if (app.firebase && app.firebase.currentUser && app.firebase.database) {
    await app.firebase.saveSetting('lightMode', isLightMode);
  } else {
    localStorage.setItem('lightMode', String(isLightMode));
  }

  updateThemeIcon(isLightMode);
}

// Update theme icon based on current mode
export function updateThemeIcon(isLightMode) {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;

  btn.innerHTML = isLightMode
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
}

// Change color theme (dracula, steel, onyx, reader)
export async function changeColorTheme(app, theme) {
  document.body.classList.remove('steel-theme', 'onyx-theme', 'reader-theme');

  if (theme === 'steel') document.body.classList.add('steel-theme');
  else if (theme === 'onyx') document.body.classList.add('onyx-theme');
  else if (theme === 'reader') document.body.classList.add('reader-theme');

  if (app.firebase && app.firebase.currentUser && app.firebase.database) {
    await app.firebase.saveSetting('colorTheme', theme);
  } else {
    localStorage.setItem('colorTheme', theme);
  }
}
