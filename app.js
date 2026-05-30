// ====================
// Bible Reader App
// ====================

import { BibleApi, LOCAL_TRANSLATIONS } from './bible-api.js';
import { loadStructure, eventsForChapter } from './bsb-structure.js';
import {
    initializeState,
    navigateChapter as navChapter,
    scrollToVerse as scrollVerse,
    applyVerseGlow as glowVerse,
} from './reading-state.js';
import { cacheElements, loadTheme, toggleTheme, changeColorTheme } from './ui.js';
import {
    initializeBibleStructure,
    getAllBooks,
    getChapterCount,
    getVerseCount
} from './bible-structure.js';
import { navigateToPrevChapter, navigateToNextChapter } from './navigation.js';
import {
    openBookModal,
    openChapterModal,
    openVerseModal,
    openTranslationModal,
    setupModalEventListeners
} from './modals.js';
import { initializeSearch } from './search.js';
import {
    initializeAuth,
    handleLogin,
    handleSignup,
    handleLogout,
    loadUserData
} from './auth.js';
import { initializeSettings } from './settings.js';
import { initializeKeyboard } from './keyboard.js';
import { initializeEvents } from './events.js';


/* ─── helpers ─── */

function ms() { return Math.round(performance.now()); }

function normalizeTranslation(name) {
    if (!name) return 'KJV';
    const upper = name.toUpperCase();
    if (LOCAL_TRANSLATIONS.includes(upper)) return upper;
    return 'KJV';
}


/* ─── App class ─── */

class App {
    constructor() {
        this.api            = null;
        this.currentBook    = 'Genesis';
        this.currentChapter = 1;
        this.currentVerse   = 1;
        this.currentTranslation = 'KJV';
        this.allBooks       = [];
        this.isLoading      = false;
        this._dbg           = {};
    }

    async initialize() {
        document.body.classList.add('initializing');
        try {
            this._dbg.t_dom_ready = ms();

            registerServiceWorker(this)
                .then(() => { this._dbg.t_sw_registered = ms(); })
                .catch((err) => console.warn('[SW]', err));

            cacheElements();
            loadTheme();

            initializeBibleStructure();
            this.allBooks = getAllBooks();

            this.api = new BibleApi();

            initializeAuth(this);
            initializeSettings(this);
            initializeSearch(this);
            initializeKeyboard(this);
            initializeEvents(this);
            setupModalEventListeners(this);

            await this.loadPassage(this.currentBook, this.currentChapter, this.currentVerse);

            this._dbg.t_first_passage = ms();
        } catch (err) {
            console.error('[App] initialization error', err);
        } finally {
            document.body.classList.remove('initializing');
        }
    }

    async loadPassage(book, chapter, verse = 1) {
        if (this.isLoading) return;
        this.isLoading = true;
        try {
            initializeState(this, book, chapter, verse);
            const data = await this.api.getPassage(book, chapter, this.currentTranslation);
            if (data) {
                this._renderPassage(data, book, chapter);
                scrollVerse(verse);
            }
        } catch (err) {
            console.error('[App] loadPassage error', err);
        } finally {
            this.isLoading = false;
        }
    }

    _renderPassage(data, book, chapter) {
        const titleEl = document.getElementById('passageTitle');
        if (titleEl) titleEl.textContent = `${book} ${chapter}`;
        const textEl = document.getElementById('passageText');
        if (!textEl) return;
        if (typeof data === 'string') {
            textEl.innerHTML = data;
        } else if (data.html) {
            textEl.innerHTML = data.html;
        } else {
            textEl.textContent = '';
        }
        glowVerse(this.currentVerse);
        const copyrightEl = document.getElementById('copyright');
        if (copyrightEl && data.copyright) copyrightEl.textContent = data.copyright;
    }

    navigatePrev()          { navigateToPrevChapter(this); }
    navigateNext()          { navigateToNextChapter(this); }
    openBookModal()         { openBookModal(this); }
    openChapterModal()      { openChapterModal(this); }
    openVerseModal()        { openVerseModal(this); }
    openTranslationModal()  { openTranslationModal(this); }
    changeTheme()           { toggleTheme(); }
    changeColorTheme(t)     { changeColorTheme(t); }
    getChapterCount(book)   { return getChapterCount(book); }
    getVerseCount(book, ch) { return getVerseCount(book, ch); }
    async handleLogin(e)    { await handleLogin(e, this); }
    async handleSignup(e)   { await handleSignup(e, this); }
    async handleLogout()    { await handleLogout(this); }
    async loadUserData()    { await loadUserData(this, normalizeTranslation); }
}


/* ─── PWA Install Prompt ─── */

let _deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredInstallPrompt = e;
    if (!window.matchMedia('(display-mode: standalone)').matches) {
        _setInstallBannerVisible(true);
    }
});

window.addEventListener('appinstalled', () => {
    _deferredInstallPrompt = null;
    _setInstallBannerVisible(false);
    console.info('[PWA] installed');
});

function _setInstallBannerVisible(visible) {
    const banner = document.getElementById('installBanner');
    if (!banner) return;
    banner.classList.toggle('hidden', !visible);
}

async function _promptInstall() {
    if (!_deferredInstallPrompt) return;
    try {
        _deferredInstallPrompt.prompt();
        const { outcome } = await _deferredInstallPrompt.userChoice;
        console.info('[PWA] user choice:', outcome);
        _deferredInstallPrompt = null;
        if (outcome === 'dismissed') _setInstallBannerVisible(false);
    } catch (err) {
        console.error('[PWA] install prompt error', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('installBtn');
    if (btn) btn.addEventListener('click', _promptInstall);
    const dismiss = document.getElementById('installBannerDismiss');
    if (dismiss) dismiss.addEventListener('click', () => _setInstallBannerVisible(false));
    if (window.matchMedia('(display-mode: standalone)').matches) {
        _setInstallBannerVisible(false);
    }
});

/* ─── Service Worker & Update Toast ─── */

async function registerServiceWorker(appInstance) {
    if (!('serviceWorker' in navigator)) return;
    try {
        const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        const pageBuildId = document.querySelector('meta[name="build-id"]')?.content || '';
        console.info('[BUILD_ID]', pageBuildId || '__BUILD_ID__');

        let _updateToastShown = false;
        function _maybeShowUpdateToast() {
            if (_updateToastShown) return;
            _updateToastShown = true;
            showUpdateToast(appInstance);
        }

        navigator.serviceWorker.addEventListener('message', (e) => {
            if (e.data?.type === 'NEW_VERSION') _maybeShowUpdateToast();
            if (e.data?.type === 'NEW_BUILD') {
                const swBuildId = e.data.buildId || '';
                if (pageBuildId && swBuildId && pageBuildId !== swBuildId) _maybeShowUpdateToast();
            }
        });

        function _checkVersion() {
            if (!pageBuildId) return;
            fetch('./version.txt', { cache: 'no-store' })
                .then(r => r.text())
                .then(remote => {
                    if (remote.trim() && remote.trim() !== pageBuildId) _maybeShowUpdateToast();
                })
                .catch(() => {});
        }
        setInterval(_checkVersion, 5 * 60 * 1000);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            fetch('./version.txt', { cache: 'no-store' })
                .then(r => r.text())
                .then(remote => {
                    const remoteSha = remote.trim();
                    if (remoteSha && pageBuildId && remoteSha !== pageBuildId) {
                        window.location.reload();
                    }
                })
                .catch(() => {});
            reg.update().catch(() => {});
        });
    } catch (err) {
        console.warn('SW registration failed', err);
    }
}

function showUpdateToast(appInstance) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerHTML = '';
    const text    = Object.assign(document.createElement('span'),  { textContent: 'A new version is available.' });
    const action  = Object.assign(document.createElement('button'),{ textContent: 'Refresh', className: 'toast-action' });
    const dismiss = Object.assign(document.createElement('button'),{ textContent: '\u00d7', className: 'toast-dismiss' });
    action.addEventListener('click',  () => window.location.reload());
    dismiss.addEventListener('click', () => { toast.innerHTML = ''; toast.style.display = 'none'; });
    toast.append(text, action, dismiss);
    toast.style.display = 'flex';
}


/* ─── Boot ─── */

const app = new App();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.initialize());
} else {
    app.initialize();
}

export { app };
