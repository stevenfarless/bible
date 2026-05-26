// settings.js
// Reading preferences: load from storage, apply to DOM, persist to Firebase and localStorage.

import { changeColorTheme, updateThemeIcon } from './ui.js';

const DEFAULTS = {
    fontSize:            18,
    showVerseNumbers:    true,
    showHeadings:        true,
    showFootnotes:       false,
    showCrossReferences: false,
    verseByVerse:        false,
    lightMode:           false,
    colorTheme:          'dracula',
    translation:         'KJV',
};

function readBool(key, defaultValue) {
    try {
        const v = localStorage.getItem(key);
        if (v === null) return defaultValue;
        if (v === 'true') return true;
        if (v === 'false') return false;
        return defaultValue;
    } catch { return defaultValue; }
}

function lsSet(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_) {}
}

export function loadLocalSettings(app) {
    try { app.state.fontSize = parseInt(localStorage.getItem('fontSize') || String(DEFAULTS.fontSize), 10); }
    catch (_) { app.state.fontSize = DEFAULTS.fontSize; }

    app.state.showVerseNumbers    = readBool('showVerseNumbers',    DEFAULTS.showVerseNumbers);
    app.state.showHeadings        = readBool('showHeadings',        DEFAULTS.showHeadings);
    app.state.showFootnotes       = readBool('showFootnotes',       DEFAULTS.showFootnotes);
    app.state.showCrossReferences = readBool('showCrossReferences', DEFAULTS.showCrossReferences);
    app.state.verseByVerse        = readBool('verseByVerse',        DEFAULTS.verseByVerse);
    app.state.lightMode           = readBool('lightMode',           DEFAULTS.lightMode);

    try { app.state.colorTheme = localStorage.getItem('colorTheme') || DEFAULTS.colorTheme; }
    catch (_) { app.state.colorTheme = DEFAULTS.colorTheme; }

    try { app.state.translation = app._normalizeTranslation(localStorage.getItem('translation') || DEFAULTS.translation); }
    catch (_) { app.state.translation = DEFAULTS.translation; }

    // Restore last reading position.
    // Signed-in users may get an updated position from Firebase later in
    // loadSavedPositionIfChanged, but localStorage gives instant first paint.
    try {
        const raw = localStorage.getItem('readingPosition');
        if (raw) {
            const pos = JSON.parse(raw);
            if (pos && pos.book && pos.chapter) {
                app.state.currentBook    = pos.book;
                app.state.currentChapter = parseInt(pos.chapter, 10);
                app.lastScrollPosition   = pos.scrollY || 0;
            }
        }
    } catch (_) { /* malformed entry — leave state at defaults */ }
}

export function applySettings(app) {
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector && app.state.colorTheme) themeSelector.value = app.state.colorTheme;
    changeColorTheme(app, app.state.colorTheme || DEFAULTS.colorTheme);

    if (app.translationSelector && app.state.translation) {
        app.translationSelector.value = app.state.translation;
    }
    // Sync nav translation badge label
    if (app.currentTranslationSpan && app.state.translation) {
        app.currentTranslationSpan.textContent = app.state.translation;
    }
    app.bibleApi.setTranslation(app.state.translation || DEFAULTS.translation);

    document.body.classList.toggle('light-mode', !!app.state.lightMode);
    const lightModeToggle = document.getElementById('lightModeToggle');
    if (lightModeToggle) lightModeToggle.checked = !!app.state.lightMode;
    updateThemeIcon(app.state.lightMode);

    document.body.classList.toggle('hide-verse-numbers', !app.state.showVerseNumbers);
    if (app.verseNumbersToggle)    app.verseNumbersToggle.checked    = !!app.state.showVerseNumbers;
    if (app.headingsToggle)        app.headingsToggle.checked        = !!app.state.showHeadings;
    if (app.footnotesToggle)       app.footnotesToggle.checked       = !!app.state.showFootnotes;
    if (app.crossReferencesToggle) app.crossReferencesToggle.checked = !!app.state.showCrossReferences;

    if (app.passageText) app.passageText.classList.toggle('verse-by-verse', !!app.state.verseByVerse);
    if (app.verseByVerseToggle) app.verseByVerseToggle.checked = !!app.state.verseByVerse;

    const fontSize = app.state.fontSize || DEFAULTS.fontSize;
    if (app.fontSizeSlider) app.fontSizeSlider.value = fontSize;
    if (app.fontSizeValue)  app.fontSizeValue.textContent = `${fontSize}px`;
    if (app.passageText)    app.passageText.style.fontSize = `${fontSize}px`;

    updateCopyright(app);
}

const TOGGLE_MAP = {
    showVerseNumbers:    'verseNumbersToggle',
    showHeadings:        'headingsToggle',
    showFootnotes:       'footnotesToggle',
    showCrossReferences: 'crossReferencesToggle',
};

export async function toggleSetting(app, setting) {
    const el = app[TOGGLE_MAP[setting]];
    if (!el) return;
    app.state[setting] = el.checked;

    // Always write to localStorage so cold loads get the correct value
    // immediately without waiting on Firebase.
    lsSet(setting, el.checked);

    if (app.currentUser) {
        await app.database
            .ref(`users/${app.currentUser.uid}/settings/${setting}`)
            .set(el.checked);
    }

    if (setting === 'showHeadings') {
        await app.loadPassage(app.state.currentBook, app.state.currentChapter);
        return;
    }

    applySettings(app);
}

export async function toggleVerseByVerse(app) {
    app.state.verseByVerse = app.verseByVerseToggle.checked;

    lsSet('verseByVerse', app.state.verseByVerse);

    if (app.currentUser) {
        await app.database
            .ref(`users/${app.currentUser.uid}/settings/verseByVerse`)
            .set(app.state.verseByVerse);
    }

    app.passageText.classList.toggle('verse-by-verse', app.state.verseByVerse);
}

export async function updateFontSize(app, size) {
    app.state.fontSize = parseInt(size, 10);
    app.fontSizeValue.textContent = `${size}px`;
    app.passageText.style.fontSize = `${size}px`;

    lsSet('fontSize', size);

    if (app.currentUser) {
        await app.database
            .ref(`users/${app.currentUser.uid}/settings/fontSize`)
            .set(parseInt(size, 10));
    }
}

export async function changeTranslation(app, translation) {
    app.state.translation = translation;
    app.bibleApi.setTranslation(translation);

    // Sync both the settings <select> and the nav badge
    if (app.translationSelector) app.translationSelector.value = translation;
    if (app.currentTranslationSpan) app.currentTranslationSpan.textContent = translation;

    lsSet('translation', translation);

    if (app.currentUser) {
        await app.database
            .ref(`users/${app.currentUser.uid}/settings/translation`)
            .set(translation);
    }

    updateCopyright(app);
    await app.loadPassage(app.state.currentBook, app.state.currentChapter);
}

export function updateCopyright(app) {
    if (app.copyright) {
        app.copyright.textContent = app._copyrightMap[app.state.translation] || '';
    }
}
