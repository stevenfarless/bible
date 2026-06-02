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
    readingFont:         'gentium',
};

const RECAPTCHA_STYLE_ID = 'recaptcha-badge-style';
const RECAPTCHA_DISCLOSURE_HTML = '<div style="margin-top: 1rem; font-size: 0.875rem;">This site is protected by reCAPTCHA and the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener">Terms of Service</a> apply.</div>';

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

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function ensureRecaptchaBadgeHidden() {
    if (document.getElementById(RECAPTCHA_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = RECAPTCHA_STYLE_ID;
    style.textContent = '.grecaptcha-badge { visibility: hidden !important; }';
    document.head.appendChild(style);
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

    try { app.state.readingFont = localStorage.getItem('readingFont') || DEFAULTS.readingFont; }
    catch (_) { app.state.readingFont = DEFAULTS.readingFont; }

    try { app.state.translation = app._normalizeTranslation(localStorage.getItem('translation') || DEFAULTS.translation); }
    catch (_) { app.state.translation = DEFAULTS.translation; }

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
    ensureRecaptchaBadgeHidden();

    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector && app.state.colorTheme) themeSelector.value = app.state.colorTheme;
    changeColorTheme(app, app.state.colorTheme || DEFAULTS.colorTheme);

    if (app.translationSelector && app.state.translation) {
        app.translationSelector.value = app.state.translation;
    }
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
    const readingFont = app.state.readingFont || DEFAULTS.readingFont;
    applyReadingFont(app, readingFont);

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

export function applyReadingFont(app, font) {
    document.body.classList.remove('font-andika', 'font-ubuntu', 'font-opendyslexic3');
    if (font === 'andika') document.body.classList.add('font-andika');
    if (font === 'ubuntu') document.body.classList.add('font-ubuntu');
    if (font === 'opendyslexic3') document.body.classList.add('font-opendyslexic3');

    const selector = document.getElementById('readingFontSelector');
    if (selector) selector.value = font;
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

/**
 * Fetch the new translation's meta.json, rebuild app.bibleBooks from it,
 * then load the current passage (redirecting to Genesis 1 if the active
 * book is not present in the new canon).
 */
export async function changeTranslation(app, translation) {
    app.state.translation = translation;
    app.bibleApi.setTranslation(translation);

    if (app.translationSelector) app.translationSelector.value = translation;
    if (app.currentTranslationSpan) app.currentTranslationSpan.textContent = translation;

    lsSet('translation', translation);

    if (app.currentUser) {
        await app.database
            .ref(`users/${app.currentUser.uid}/settings/translation`)
            .set(translation);
    }

    // Fetch meta.json for the incoming translation and rebuild the canon.
    // A missing or malformed meta falls back to the static 66-book structure
    // inside _rebuildBibleBooks, so this is safe to fire-and-forget on error.
    let meta = null;
    try {
        const res = await fetch(`./translations/${translation}/meta.json`);
        if (res.ok) meta = await res.json();
    } catch (_) { /* network error — fall back to static structure */ }
    app._rebuildBibleBooks(meta);

    // Register the book list so searchPassages fallback skips books this
    // translation doesn't include (e.g. deuterocanon for protestant canons).
    if (meta?.books?.length) {
        app.bibleApi.setBookList(translation, meta.books.map(b => b.name));
    }

    updateCopyright(app);
    await app.loadPassage(app.state.currentBook, app.state.currentChapter);
}

export function updateCopyright(app) {
    if (!app.copyright) return;

    const copyrightText = app._copyrightMap[app.state.translation] || '';
    const copyrightHtml = copyrightText ? `<span class="copyright-text">${escapeHtml(copyrightText)}</span>` : '';

    app.copyright.innerHTML = [
        copyrightHtml,
        `<span class="recaptcha-disclosure">${RECAPTCHA_DISCLOSURE_HTML}</span>`,
    ].filter(Boolean).join('<br />');
}
