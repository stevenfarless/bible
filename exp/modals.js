// modals.js
// Modal open/close, population, and drag-to-resize for BibleApp.

import { LOCAL_TRANSLATIONS } from './bible-api.js';
import { idbIsDownloaded, idbDeleteTranslation } from './translation-store.js';

// ── Open / close ─────────────────────────────────────────────────────────────

export function openModal(app, modal) {
    if (!modal) return;
    modal.classList.add('active');
    document.body.classList.add('modal-open');
}

export function closeModal(app, modal) {
    if (!modal) return;

    if (modal === app.translationModal) {
        _translationKbClear(app);
    }

    if (modal === app.settingsModal || modal === app.referencesModal) {
        const content = modal.querySelector('.modal-content');
        content.style.animation = 'slideDownToBottom 250ms ease';
        setTimeout(() => {
            modal.classList.remove('active');
            _maybeRemoveModalOpen();
            content.style.animation = '';
        }, 250);
    } else {
        modal.classList.remove('active');
        _maybeRemoveModalOpen();
    }
}

function _maybeRemoveModalOpen() {
    if (!document.querySelector('.modal.active')) {
        document.body.classList.remove('modal-open');
    }
}

// ── Book modal ────────────────────────────────────────────────────────────────

export function openBookModal(app) {
    populateBookModal(app);
    openModal(app, app.bookModal);
}

export function populateBookModal(app) {
    const modalBody = app.bookModal?.querySelector('.modal-body');
    if (!modalBody) return;

    modalBody.innerHTML = '';

    const createBookButton = (book) => {
        const btn = document.createElement('button');
        btn.className = 'book-item';
        btn.textContent = app.bookAbbreviations[book] || book;
        btn.addEventListener('click', () => {
            app.state.selectedVerse = null;
            app.loadPassage(book, 1);
            app.closeModal(app.bookModal);
        });
        return btn;
    };

    for (const [testament, books] of Object.entries(app.bibleBooks)) {
        const section = document.createElement('div');
        section.className = 'book-category';

        const heading = document.createElement('h4');
        heading.textContent = testament === 'Deuterocanon' ? 'Apocrypha / Deuterocanon' : testament;
        if (testament === 'Deuterocanon') {
            const infoBtn = document.createElement('button');
            infoBtn.className = 'deuterocanon-info-btn';
            infoBtn.setAttribute('aria-label', 'About the Deuterocanon');
            infoBtn.innerHTML = '?';
            infoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openDeuterocanonInfoModal(app);
            });
            heading.appendChild(infoBtn);
        }
        section.appendChild(heading);

        const grid = document.createElement('div');
        grid.className = 'book-grid';
        if (testament === 'Old Testament') grid.id = 'oldTestamentBooks';
        if (testament === 'New Testament') grid.id = 'newTestamentBooks';

        for (const book of Object.keys(books)) {
            grid.appendChild(createBookButton(book));
        }

        section.appendChild(grid);
        modalBody.appendChild(section);
    }
}

// ── Deuterocanon info modal ───────────────────────────────────────────────────

export function openDeuterocanonInfoModal(app) {
    const modal = document.getElementById('deuterocanonInfoModal');
    if (modal) {
        openModal(app, modal);
    } else {
        console.error('[DeutModal] element #deuterocanonInfoModal not found in DOM');
    }
}

// ── Chapter modal ─────────────────────────────────────────────────────────────

export function openChapterModal(app) {
    populateChapterModal(app);
    openModal(app, app.chapterModal);
}

export function populateChapterModal(app) {
    app.chapterModalBook.textContent = app.getDisplayName(app.state.currentBook);
    app.chapterGrid.innerHTML = '';

    const chapterCount = app.getChapterCount(app.state.currentBook);

    for (let i = 1; i <= chapterCount; i++) {
        const btn = document.createElement('button');
        btn.className = 'chapter-item';
        btn.textContent = i;
        btn.addEventListener('click', () => {
            app.state.selectedVerse = null;
            app.loadPassage(app.state.currentBook, i);
            app.closeModal(app.chapterModal);
        });
        app.chapterGrid.appendChild(btn);
    }
}

// ── Verse modal ───────────────────────────────────────────────────────────────

export function openVerseModal(app) {
    populateVerseModal(app);
    openModal(app, app.verseModal);
}

export function populateVerseModal(app) {
    const book = app.state.currentBook;
    const displayBook = book === 'Psalm'
        ? `Psalm ${app.state.currentChapter}`
        : `${app.getDisplayName(book)} ${app.state.currentChapter}`;
    app.verseModalBook.textContent = displayBook;
    app.verseGrid.innerHTML = '';

    const verseCount = getCurrentVerseCount(app);

    if (verseCount === 0) {
        app.verseGrid.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">No verses found in current passage</p>';
        return;
    }

    for (let i = 1; i <= verseCount; i++) {
        const btn = document.createElement('button');
        btn.className = 'chapter-item';
        btn.textContent = i;
        btn.addEventListener('click', () => {
            app.scrollToVerse(i);
            app.closeModal(app.verseModal);
        });
        app.verseGrid.appendChild(btn);
    }
}

export function getCurrentVerseCount(app) {
    return app.passageText.querySelectorAll('.verse-num').length;
}

// ── Translation modal ─────────────────────────────────────────────────────────

const _SVG_DOWNLOAD = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true"><path d="M11.29,16.71h0a1.15,1.15,0,0,0,.33.21.94.94,0,0,0,.76,0,1.15,1.15,0,0,0,.33-.21h0l4-4a1,1,0,0,0-1.42-1.42L13,13.59V3a1,1,0,0,0-2,0V13.59l-2.29-2.3a1,1,0,1,0-1.42,1.42Z"/><path d="M19,20H5a1,1,0,0,0,0,2H19a1,1,0,0,0,0-2Z"/></svg>`;

const _SVG_DOWNLOADED = `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true"><path d="M34.459 1.375a2.999 2.999 0 0 0-4.149.884L13.5 28.17l-8.198-7.58a2.999 2.999 0 1 0-4.073 4.405l10.764 9.952s.309.266.452.359a2.999 2.999 0 0 0 4.15-.884L35.343 5.524a2.999 2.999 0 0 0-.884-4.149z"/></svg>`;

const _SVG_SPINNER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="translation-dl-spinner" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;

const _SVG_TRASH = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M10 12L14 16M14 12L10 16M18 6L17.1991 18.0129C17.129 19.065 17.0939 19.5911 16.8667 19.99C16.6666 20.3412 16.3648 20.6235 16.0011 20.7998C15.588 21 15.0607 21 14.0062 21H9.99377C8.93927 21 8.41202 21 7.99889 20.7998C7.63517 20.6235 7.33339 20.3412 7.13332 19.99C6.90607 19.5911 6.871 19.065 6.80086 18.0129L6 6M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const _downloading = new Set();
const _hasHover = window.matchMedia('(hover: hover)').matches;

export function openTranslationModal(app) {
    populateTranslationModal(app);
    openModal(app, app.translationModal);
    const items = _translationItems(app);
    const activeIdx = items.findIndex((li) => li.classList.contains('translation-modal-item--active'));
    app._translationKbIndex = activeIdx >= 0 ? activeIdx : 0;
    _translationKbApply(app, items);
}

export async function populateTranslationModal(app) {
    if (!app.translationList) return;
    app.translationList.innerHTML = '';

    const registry = app._translationRegistry || [];

    if (registry.length === 0) {
        const msg = document.createElement('li');
        msg.textContent = 'No translations available.';
        msg.style.padding = 'var(--spacing-md)';
        msg.style.color = 'var(--text-muted)';
        app.translationList.appendChild(msg);
        return;
    }

    const idbChecks = await Promise.all(
        registry.map((t) =>
            LOCAL_TRANSLATIONS.has(t.id) ? Promise.resolve(true) : idbIsDownloaded(t.id)
        )
    );

    const installed = [];
    const available = [];

    registry.forEach((t, i) => {
        if (idbChecks[i]) installed.push(t);
        else available.push(t);
    });

    installed.sort((a, b) => a.id.localeCompare(b.id));

    const appendSectionHeading = (label) => {
        const li = document.createElement('li');
        li.className = 'translation-modal-section-heading';
        li.textContent = label;
        li.setAttribute('role', 'presentation');
        app.translationList.appendChild(li);
    };

    const appendItem = (t, isPrecached, isDownloaded) => {
        const wrapper = document.createElement('li');
        wrapper.className = 'translation-modal-item-wrapper';

        const li = document.createElement('div');
        li.className = 'translation-modal-item';
        if (t.id === app.state.translation) li.classList.add('translation-modal-item--active');

        const nameSpan = document.createElement('span');
        nameSpan.className = 'translation-modal-item__name';
        nameSpan.textContent = t.id;

        const descSpan = document.createElement('span');
        descSpan.className = 'translation-modal-item__desc';
        descSpan.textContent = t.name || '';

        li.appendChild(nameSpan);
        li.appendChild(descSpan);

        if (!isPrecached) {
            const iconEl = document.createElement('span');
            iconEl.className = 'translation-modal-item__status-icon';

            const progressWrap = document.createElement('div');
            progressWrap.className = 'translation-dl-progress';
            progressWrap.hidden = true;

            const progressTrack = document.createElement('div');
            progressTrack.className = 'translation-dl-progress__bar-track';

            const progressBar = document.createElement('div');
            progressBar.className = 'translation-dl-progress__bar';

            const progressLabel = document.createElement('span');
            progressLabel.className = 'translation-dl-progress__label';

            progressTrack.appendChild(progressBar);
            progressWrap.appendChild(progressTrack);
            progressWrap.appendChild(progressLabel);
            li.appendChild(iconEl);
            li.appendChild(progressWrap);

            if (_downloading.has(t.id)) {
                progressWrap.hidden = false;
                iconEl.innerHTML = _SVG_SPINNER;
                progressLabel.textContent = 'Downloading\u2026';
                li.classList.add('translation-modal-item--downloading');
            } else if (isDownloaded) {
                li.classList.add('translation-modal-item--downloaded');
                iconEl.innerHTML = _SVG_DOWNLOADED;
            } else {
                iconEl.innerHTML = _SVG_DOWNLOAD;
            }

            li.addEventListener('click', () => {
                if (_downloading.has(t.id)) return;
                if (li.classList.contains('translation-modal-item--downloaded')) {
                    app.changeTranslation(t.id);
                    app.closeModal(app.translationModal);
                    return;
                }
                _handleTranslationSelect(app, t, li, iconEl, progressWrap, progressBar, progressLabel);
            });

            if (isDownloaded && !isPrecached) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'translation-modal-delete-btn';
                deleteBtn.setAttribute('aria-label', `Uninstall ${t.id}`);
                deleteBtn.innerHTML = _SVG_TRASH;
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    _handleUninstall(app, t, wrapper);
                });

                if (_hasHover) {
                    deleteBtn.classList.add('translation-modal-delete-btn--inline');
                    iconEl.classList.add('translation-modal-item__icon-wrap');
                    iconEl.appendChild(deleteBtn);
                } else {
                    wrapper.appendChild(deleteBtn);
                    _attachSwipe(wrapper, li);
                }
            }
        } else {
            li.addEventListener('click', () => {
                app.changeTranslation(t.id);
                app.closeModal(app.translationModal);
            });
        }

        wrapper.appendChild(li);
        app.translationList.appendChild(wrapper);
    };

    if (installed.length > 0) {
        appendSectionHeading('Installed');
        for (const t of installed) appendItem(t, LOCAL_TRANSLATIONS.has(t.id), true);
    }

    if (available.length > 0) {
        appendSectionHeading('Available');
        for (const t of available) appendItem(t, false, false);
    }
}

// ── Fly-to-installed animation ────────────────────────────────────────────────

async function _flyToInstalled(app, t, sourceWrapper) {
    // Snapshot where the item is right now
    const fromRect = sourceWrapper.getBoundingClientRect();

    // Rebuild the list — the item now appears in the Installed section
    await populateTranslationModal(app);

    // Find the newly inserted wrapper in Installed
    const targetWrapper = Array.from(app.translationList.querySelectorAll('.translation-modal-item-wrapper'))
        .find((w) => {
            const name = w.querySelector('.translation-modal-item__name');
            return name && name.textContent === t.id;
        });

    if (!targetWrapper) return;

    const toRect = targetWrapper.getBoundingClientRect();

    // Hide the destination while the clone flies
    targetWrapper.style.opacity = '0';

    // Build a flying clone sized and positioned to match the source
    const clone = sourceWrapper.cloneNode(true);
    clone.style.cssText = `
        position: fixed;
        top: ${fromRect.top}px;
        left: ${fromRect.left}px;
        width: ${fromRect.width}px;
        height: ${fromRect.height}px;
        margin: 0;
        pointer-events: none;
        z-index: 9999;
        border-radius: var(--radius-md, 8px);
        background: var(--surface-primary, var(--color-surface));
        box-shadow: var(--shadow-lg, 0 12px 32px rgba(0,0,0,.2));
        transition: transform 380ms cubic-bezier(0.22, 1, 0.36, 1),
                    opacity  380ms cubic-bezier(0.22, 1, 0.36, 1),
                    box-shadow 380ms cubic-bezier(0.22, 1, 0.36, 1);
        will-change: transform, opacity;
    `;
    document.body.appendChild(clone);

    const dx = toRect.left - fromRect.left;
    const dy = toRect.top  - fromRect.top;

    // Force a paint before setting transform so transition fires
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            clone.style.transform = `translate(${dx}px, ${dy}px)`;
            clone.style.boxShadow = 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,.06))';
        });
    });

    clone.addEventListener('transitionend', () => {
        clone.remove();
        targetWrapper.style.opacity = '';
    }, { once: true });
}

// ── Swipe-to-reveal delete (touch only) ──────────────────────────────────────

const _SWIPE_THRESHOLD = 60;
const _DELETE_BTN_W   = 72;

// Tracks the currently open swipe wrapper so we can close it when another opens
// or when the user taps outside. Scoped to the module — one open item at a time.
let _openWrapper = null;

function _closeOpenWrapper() {
    if (_openWrapper) {
        const li = _openWrapper.querySelector('.translation-modal-item');
        if (li) {
            li.style.transition = 'transform 200ms ease';
            li.style.transform = 'translateX(0)';
        }
        _openWrapper.classList.remove('translation-modal-item-wrapper--open');
        _openWrapper = null;
    }
}

function _attachSwipe(wrapper, li) {
    let startX = 0;
    let startY = 0;
    let isDragging = false;
    let currentX = 0;
    let axis = null; // null=undecided, true=horizontal, false=vertical

    const clampX = (x) => Math.max(-_DELETE_BTN_W, Math.min(0, x));

    const setX = (x, animate) => {
        currentX = clampX(x);
        li.style.transition = animate ? 'transform 200ms ease' : 'none';
        li.style.transform = `translateX(${currentX}px)`;
    };

    const open = () => {
        if (_openWrapper && _openWrapper !== wrapper) _closeOpenWrapper();
        _openWrapper = wrapper;
        setX(-_DELETE_BTN_W, true);
        wrapper.classList.add('translation-modal-item-wrapper--open');
    };

    const close = () => {
        if (_openWrapper === wrapper) _openWrapper = null;
        setX(0, true);
        wrapper.classList.remove('translation-modal-item-wrapper--open');
    };

    let _onMove = null;
    let _onEnd  = null;

    function cleanup() {
        if (_onMove) { li.removeEventListener('touchmove', _onMove); _onMove = null; }
        if (_onEnd)  {
            li.removeEventListener('touchend',    _onEnd);
            li.removeEventListener('touchcancel', _onEnd);
            _onEnd = null;
        }
    }

    li.addEventListener('touchstart', (e) => {
        // If another wrapper is open, close it and absorb this touch
        if (_openWrapper && _openWrapper !== wrapper) {
            _closeOpenWrapper();
            return;
        }

        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isDragging = true;
        axis = null;
        li.style.transition = 'none';

        _onMove = (ev) => {
            if (!isDragging) return;

            const dx = ev.touches[0].clientX - startX;
            const dy = ev.touches[0].clientY - startY;

            if (axis === null) {
                if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
                axis = Math.abs(dx) > Math.abs(dy);
                if (!axis) {
                    // Vertical — bail out and let the list scroll
                    isDragging = false;
                    cleanup();
                    return;
                }
            }

            ev.preventDefault();
            ev.stopPropagation();
            const base = wrapper.classList.contains('translation-modal-item-wrapper--open') ? -_DELETE_BTN_W : 0;
            setX(base + dx, false);
        };

        _onEnd = () => {
            if (isDragging) {
                isDragging = false;
                if (currentX < -_SWIPE_THRESHOLD) open();
                else close();
            }
            cleanup();
        };

        // Listen on the li element only — never on document
        li.addEventListener('touchmove',   _onMove, { passive: false });
        li.addEventListener('touchend',    _onEnd,  { passive: true });
        li.addEventListener('touchcancel', _onEnd,  { passive: true });
    }, { passive: true });
}

// ── Uninstall handler ─────────────────────────────────────────────────────────

async function _handleUninstall(app, t, wrapper) {
    await idbDeleteTranslation(t.id);

    if (app.bibleApi?.evictTranslation) {
        app.bibleApi.evictTranslation(t.id);
    }

    if (app.state.translation === t.id) {
        const fallback = [...LOCAL_TRANSLATIONS][0];
        if (fallback) app.changeTranslation(fallback);
    }

    wrapper.style.transition = 'opacity 200ms ease, max-height 250ms ease 200ms';
    wrapper.style.overflow = 'hidden';
    wrapper.style.maxHeight = wrapper.offsetHeight + 'px';
    requestAnimationFrame(() => {
        wrapper.style.opacity = '0';
        wrapper.style.maxHeight = '0';
    });
    setTimeout(() => wrapper.remove(), 460);
}

async function _handleTranslationSelect(app, t, li, iconEl, progressWrap, progressBar, progressLabel) {
    if (!navigator.onLine) {
        _showInlineError(li, progressWrap, progressLabel, 'Connect to internet to download');
        return;
    }

    _downloading.add(t.id);
    li.classList.add('translation-modal-item--downloading');
    iconEl.innerHTML = _SVG_SPINNER;
    progressWrap.hidden = false;
    progressBar.style.width = '0%';
    progressLabel.textContent = 'Downloading\u2026';

    let bookList = null;
    try {
        const metaRes = await fetch(`./translations/${t.id}/meta.json`);
        if (metaRes.ok) {
            const meta = await metaRes.json();
            if (meta?.books?.length) bookList = meta.books.map((b) => b.name);
        }
    } catch (_) {}

    try {
        await app.bibleApi.downloadTranslation(t.id, bookList, (done, tot) => {
            const pct = Math.round((done / tot) * 100);
            progressBar.style.width = `${pct}%`;
            progressLabel.textContent = `${done}\u202f/\u202f${tot}`;
        });

        _downloading.delete(t.id);
        li.classList.remove('translation-modal-item--downloading');
        li.classList.add('translation-modal-item--downloaded');
        iconEl.innerHTML = _SVG_DOWNLOADED;
        progressWrap.hidden = true;

        // Let the checkmark sit for 500ms, then fly the item to Installed
        const sourceWrapper = li.closest('.translation-modal-item-wrapper');
        setTimeout(() => {
            if (sourceWrapper) {
                _flyToInstalled(app, t, sourceWrapper);
            }
        }, 500);
    } catch (err) {
        _downloading.delete(t.id);
        li.classList.remove('translation-modal-item--downloading');
        iconEl.innerHTML = _SVG_DOWNLOAD;
        progressBar.style.width = '0%';
        _showInlineError(li, progressWrap, progressLabel, 'Download failed \u2014 try again');
        console.error('Translation download failed', err);
    }
}

function _showInlineError(li, progressWrap, progressLabel, message) {
    progressWrap.hidden = false;
    progressWrap.classList.add('translation-dl-progress--error');
    progressLabel.textContent = message;
    setTimeout(() => {
        progressWrap.hidden = true;
        progressWrap.classList.remove('translation-dl-progress--error');
        progressLabel.textContent = '';
    }, 3000);
}

// ── Translation modal keyboard helpers ───────────────────────────────────────

function _translationItems(app) {
    return app.translationList
        ? Array.from(app.translationList.querySelectorAll('.translation-modal-item'))
        : [];
}

function _translationKbApply(app, items) {
    items.forEach((li, i) => {
        li.classList.toggle('translation-modal-item--focused', i === app._translationKbIndex);
    });
    const focused = items[app._translationKbIndex];
    if (focused) focused.scrollIntoView({ block: 'nearest' });
}

function _translationKbClear(app) {
    app._translationKbIndex = -1;
    if (!app.translationList) return;
    app.translationList
        .querySelectorAll('.translation-modal-item--focused')
        .forEach((li) => li.classList.remove('translation-modal-item--focused'));
}

export function translationKbMove(app, delta) {
    const items = _translationItems(app);
    if (!items.length) return;
    const current = app._translationKbIndex ?? -1;
    app._translationKbIndex = (current + delta + items.length) % items.length;
    _translationKbApply(app, items);
}

export function translationKbSelect(app) {
    const items = _translationItems(app);
    const idx   = app._translationKbIndex ?? -1;
    if (idx < 0 || idx >= items.length) return;
    items[idx].click();
}

// ── Drag-to-resize ────────────────────────────────────────────────────────────

function attachDragHandlers(app, modal, dismissOnDrag = true) {
    const content = modal.querySelector('.modal-content');
    const header  = modal.querySelector('.modal-header');
    const body    = modal.querySelector('.modal-body');

    if (!content || !header) return;

    let isTouchDragging = false;
    let touchStartY = 0;
    let touchStartHeight = 0;
    let touchStartScrollTop = 0;

    header.addEventListener('touchstart', (e) => {
        if (!header.contains(e.target)) return;
        isTouchDragging = true;
        touchStartY = e.touches[0].clientY;
        touchStartHeight = content.offsetHeight;
        touchStartScrollTop = body?.scrollTop ?? 0;
        content.classList.add('dragging');
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (!isTouchDragging) return;
        const deltaY = touchStartY - e.touches[0].clientY;
        const newH = Math.max(200, Math.min(window.innerHeight * 0.9, touchStartHeight + deltaY));
        content.style.height = `${newH}px`;
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
        if (!isTouchDragging) return;
        isTouchDragging = false;
        content.classList.remove('dragging');
        const totalDrag = e.changedTouches[0].clientY - touchStartY;
        if (dismissOnDrag && totalDrag > 150 && touchStartScrollTop === 0) {
            app.closeModal(modal);
            setTimeout(() => { content.style.height = '50vh'; }, 300);
        }
    }, { passive: true });

    let isMouseDragging = false;
    let mouseStartY = 0;
    let mouseStartHeight = 0;

    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.close-btn')) return;
        isMouseDragging = true;
        mouseStartY = e.clientY;
        mouseStartHeight = content.offsetHeight;
        content.classList.add('dragging');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isMouseDragging) return;
        const newH = Math.max(200, Math.min(window.innerHeight * 0.9, mouseStartHeight + (mouseStartY - e.clientY)));
        content.style.height = `${newH}px`;
    });

    document.addEventListener('mouseup', (e) => {
        if (!isMouseDragging) return;
        isMouseDragging = false;
        content.classList.remove('dragging');
        if (dismissOnDrag && e.clientY - mouseStartY > 150) {
            app.closeModal(modal);
            setTimeout(() => { content.style.height = '50vh'; }, 300);
        }
    });
}

export function attachDragToResize(app) {
    if (app.settingsModal)   attachDragHandlers(app, app.settingsModal);
    if (app.referencesModal) attachDragHandlers(app, app.referencesModal);
}
