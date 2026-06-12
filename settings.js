// settings.js
// Reading preferences: load from storage, apply to DOM, persist to Firebase and localStorage.

import { changeColorTheme, applyLightMode } from './ui.js';

const DEFAULTS = {
    fontSize:            20,
    showVerseNumbers:    true,
    coloredVerseNumbers: true,
    showHeadings:        true,
    showFootnotes:       false,
    showCrossReferences: false,
    verseByVerse:        false,
    showChapterArrows:   false,
    lightMode:           'system',
    colorTheme:          'vespers',
    translation:         'KJV',
    readingFont:         'gentium',
    verseSelectionGesture: 'hold',
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
    app.state.coloredVerseNumbers = readBool('coloredVerseNumbers', DEFAULTS.coloredVerseNumbers);
    app.state.showFootnotes       = readBool('showFootnotes',       DEFAULTS.showFootnotes);
    app.state.showCrossReferences = readBool('showCrossReferences', DEFAULTS.showCrossReferences);
    app.state.verseByVerse        = readBool('verseByVerse',        DEFAULTS.verseByVerse);
    app.state.showChapterArrows   = readBool('showChapterArrows',   DEFAULTS.showChapterArrows);
    const _rawLightMode = (() => { try { return localStorage.getItem('lightMode'); } catch (_) { return null; } })();
    app.state.lightMode =
        _rawLightMode === 'light' || _rawLightMode === 'dark' || _rawLightMode === 'system'
            ? _rawLightMode
            : DEFAULTS.lightMode;

    try {
        const storedTheme = localStorage.getItem('colorTheme') || DEFAULTS.colorTheme;
        // 'dracula' was briefly remapped to 'onyx' in a bad deploy — restore it.
        app.state.colorTheme = storedTheme;
    } catch (_) { app.state.colorTheme = DEFAULTS.colorTheme; }

    try { app.state.readingFont = localStorage.getItem('readingFont') || DEFAULTS.readingFont; }
    catch (_) { app.state.readingFont = DEFAULTS.readingFont; }

    try {
        const storedGesture = localStorage.getItem('verseSelectionGesture');
        app.state.verseSelectionGesture = storedGesture === 'tap' ? 'tap' : DEFAULTS.verseSelectionGesture;
    } catch (_) {
        app.state.verseSelectionGesture = DEFAULTS.verseSelectionGesture;
    }

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

    applyLightMode(app.state.lightMode);
    const lightModeSelect = document.getElementById('lightModeSelect');
    if (lightModeSelect) lightModeSelect.value = app.state.lightMode;

    document.body.classList.toggle('hide-verse-numbers', !app.state.showVerseNumbers);
    document.body.classList.toggle('muted-verse-numbers', !app.state.coloredVerseNumbers);
    document.body.classList.toggle('hide-chapter-arrows', !app.state.showChapterArrows);
    if (app.verseNumbersToggle)    app.verseNumbersToggle.checked    = !!app.state.showVerseNumbers;
    if (app.coloredVerseNumbersToggle) app.coloredVerseNumbersToggle.checked = !!app.state.coloredVerseNumbers;
    if (app.headingsToggle)        app.headingsToggle.checked        = !!app.state.showHeadings;
    if (app.chapterArrowsToggle)   app.chapterArrowsToggle.checked   = !!app.state.showChapterArrows;

    if (app.passageText) app.passageText.classList.toggle('verse-by-verse', !!app.state.verseByVerse);
    if (app.verseByVerseToggle) app.verseByVerseToggle.checked = !!app.state.verseByVerse;

    const fontSize = app.state.fontSize || DEFAULTS.fontSize;
    if (app.fontSizeSlider) app.fontSizeSlider.value = fontSize;
    if (app.fontSizeValue)  app.fontSizeValue.textContent = `${fontSize}px`;
    if (app.passageText)    app.passageText.style.fontSize = `${fontSize}px`;
    const readingFont = app.state.readingFont || DEFAULTS.readingFont;
    applyReadingFont(app, readingFont);

    if (app.verseSelectionGestureSelect) {
        app.verseSelectionGestureSelect.value = app.state.verseSelectionGesture || DEFAULTS.verseSelectionGesture;
    }

    updateCopyright(app);
}

const TOGGLE_MAP = {
    showVerseNumbers:  'verseNumbersToggle',
    coloredVerseNumbers: 'coloredVerseNumbersToggle',
    showHeadings:      'headingsToggle',
    showChapterArrows: 'chapterArrowsToggle',
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

    if (setting === 'showVerseNumbers') {
        document.body.classList.toggle('hide-verse-numbers', !app.state.showVerseNumbers);
        return;
    }
    
    if (setting === 'coloredVerseNumbers') {
    document.body.classList.toggle('muted-verse-numbers', !app.state.coloredVerseNumbers);
    return;
    }

    if (setting === 'showChapterArrows') {
        document.body.classList.toggle('hide-chapter-arrows', !app.state.showChapterArrows);
        return;
    }
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
    document.body.classList.remove('font-andika', 'font-ubuntu', 'font-opendyslexic3', 'font-retrocide', 'font-ia-quattro', 'font-adwaitasans');

    if (font === 'andika')        document.body.classList.add('font-andika');
    if (font === 'ubuntu')        document.body.classList.add('font-ubuntu');
    if (font === 'opendyslexic3') document.body.classList.add('font-opendyslexic3');
    if (font === 'retrocide')     document.body.classList.add('font-retrocide');
    if (font === 'ia-quattro')    document.body.classList.add('font-ia-quattro');
    if (font === 'adwaitasans')   document.body.classList.add('font-adwaitasans');

    const selector = document.getElementById('readingFontSelector');
    const helpText = document.getElementById('readingFontHelpText');
    if (selector) {
        selector.value = font;
        selector.disabled = false;
    }
    if (helpText) {
        helpText.textContent = 'Choose the typeface used for passage text.';
    }
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

/**
 * Wire sub-accordion toggle behaviour for the About section.
 * Called once during settings init.
 */
export function initSubAccordions() {
    document.querySelectorAll('.sub-accordion-header').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.closest('.sub-accordion-section');
            const isActive = section.classList.contains('active');
            // Collapse all siblings first
            section.closest('.about-group')
                .querySelectorAll('.sub-accordion-section')
                .forEach(s => s.classList.remove('active'));
            if (!isActive) section.classList.add('active');
            btn.setAttribute('aria-expanded', (!isActive).toString());
        });
    });
}

/**
 * Fetch the latest GitHub release, populate #aboutVersion with the tag name,
 * and render the release body markdown into #whatsNewContent.
 *
 * Falls back to the build-info SHA if the API request fails.
 */
export async function populateAboutVersion() {
    const versionEl   = document.getElementById('aboutVersion');
    const contentEl   = document.getElementById('whatsNewContent');
    const whatsNewBtn = document.querySelector('[data-section="whats-new"] .sub-accordion-header');

    async function _fallbackToBuildSha() {
        if (!versionEl) return;
        const buildInfo = document.getElementById('build-info');
        if (!buildInfo) return;
        const raw = buildInfo.textContent.trim();
        const sha = raw.split(/[\s·]/)[0];
        if (sha && sha !== '__BUILD_INFO__') versionEl.textContent = sha;
    }

    try {
        const res = await fetch(
            'https://api.github.com/repos/stevenfarless/lege-lux/releases/latest',
            { headers: { Accept: 'application/vnd.github+json' } }
        );
        if (!res.ok) { await _fallbackToBuildSha(); return; }

        const release = await res.json();

        if (versionEl && release.tag_name) {
            versionEl.textContent = release.tag_name;
        } else {
            await _fallbackToBuildSha();
        }

        if (contentEl && release.body) {
            // marked is loaded via CDN in index.html before this runs
            if (typeof marked !== 'undefined') {
                contentEl.innerHTML = marked.parse(release.body);
            } else {
                contentEl.textContent = release.body;
            }
            if (whatsNewBtn) whatsNewBtn.closest('.sub-accordion-section').removeAttribute('hidden');
        }

        // Fetch the latest prerelease for the Coming Soon section
        _populateComingSoon();
    } catch (_) {
        await _fallbackToBuildSha();
    }
}

async function _populateComingSoon() {
    const el = document.getElementById('comingSoonContent');
    if (!el) return;
    try {
        const res = await fetch(
            'https://api.github.com/repos/stevenfarless/lege-lux/releases?per_page=10',
            { headers: { Accept: 'application/vnd.github+json' } }
        );
        if (!res.ok) return;
        const releases = await res.json();
        const pre = releases.find(r => r.prerelease === true);
        if (!pre || !pre.body) return;

        if (typeof marked !== 'undefined') {
            el.innerHTML = marked.parse(pre.body);
        } else {
            el.textContent = pre.body;
        }

        const section = el.closest('.sub-accordion-section');
        const tagEl = section?.querySelector('.sub-accordion-header span');
        if (tagEl && pre.tag_name) tagEl.textContent = `Coming soon · ${pre.tag_name}`;
        section?.removeAttribute('hidden');
    } catch (_) { /* network error — leave section empty */ }
}
