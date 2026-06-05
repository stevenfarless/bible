// modals.js
// Modal open/close, population, and drag-to-resize for BibleApp.

import { LOCAL_TRANSLATIONS } from './bible-api.js';
import { idbIsDownloaded } from './translation-store.js';

// ── Open / close ──────────────────────────────────────────────────────────────

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

// Tracks which translations are actively downloading so re-taps are ignored.
const _downloading = new Set();

export function openTranslationModal(app) {
    populateTranslationModal(app);
    openModal(app, app.translationModal);
    const items = _translationItems(app);
    const activeIdx = items.findIndex((li) => li.classList.contains('translation-modal-item--active'));
    app._translationKbIndex = activeIdx >= 0 ? activeIdx : 0;
    _translationKbApply(app, items);
}

export function populateTranslationModal(app) {
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

    for (const t of registry) {
        const isPrecached = LOCAL_TRANSLATIONS.has(t.id);
        const li = document.createElement('li');
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
            // Inline download progress bar (hidden until download starts)
            const progressWrap = document.createElement('div');
            progressWrap.className = 'translation-dl-progress';
            progressWrap.hidden = true;

            const progressBar = document.createElement('div');
            progressBar.className = 'translation-dl-progress__bar';

            const progressLabel = document.createElement('span');
            progressLabel.className = 'translation-dl-progress__label';

            progressWrap.appendChild(progressBar);
            progressWrap.appendChild(progressLabel);
            li.appendChild(progressWrap);

            // If already in-progress (modal was reopened mid-download), restore state
            if (_downloading.has(t.id)) {
                progressWrap.hidden = false;
                progressLabel.textContent = 'Downloading\u2026';
                li.classList.add('translation-modal-item--downloading');
            }

            // Async: mark as downloaded if IDB already has it
            idbIsDownloaded(t.id).then((already) => {
                if (already) li.classList.add('translation-modal-item--downloaded');
            });

            li.addEventListener('click', () => {
                if (_downloading.has(t.id)) return;
                if (li.classList.contains('translation-modal-item--downloaded')) {
                    app.changeTranslation(t.id);
                    app.closeModal(app.translationModal);
                    return;
                }
                _handleTranslationSelect(app, t, li, progressWrap, progressBar, progressLabel);
            });
        } else {
            li.addEventListener('click', () => {
                app.changeTranslation(t.id);
                app.closeModal(app.translationModal);
            });
        }

        app.translationList.appendChild(li);
    }
}

async function _handleTranslationSelect(app, t, li, progressWrap, progressBar, progressLabel) {
    if (!navigator.onLine) {
        _showInlineError(li, progressWrap, progressLabel, 'Connect to internet to download');
        return;
    }

    _downloading.add(t.id);
    li.classList.add('translation-modal-item--downloading');
    progressWrap.hidden = false;
    progressBar.style.width = '0%';
    progressLabel.textContent = 'Downloading\u2026';

    // Fetch meta.json for the correct book list (incl. deuterocanon)
    let bookList = null;
    try {
        const metaRes = await fetch(`./translations/${t.id}/meta.json`);
        if (metaRes.ok) {
            const meta = await metaRes.json();
            if (meta?.books?.length) bookList = meta.books.map((b) => b.name);
        }
    } catch (_) {}

    const total = bookList?.length || 66;

    try {
        await app.bibleApi.downloadTranslation(t.id, bookList, (done, tot) => {
            const pct = Math.round((done / tot) * 100);
            progressBar.style.width = `${pct}%`;
            progressLabel.textContent = `${done}\u202f/\u202f${tot}`;
        });

        _downloading.delete(t.id);
        li.classList.remove('translation-modal-item--downloading');
        li.classList.add('translation-modal-item--downloaded');
        progressWrap.hidden = true;

        // Auto-switch to the newly downloaded translation and close
        app.changeTranslation(t.id);
        app.closeModal(app.translationModal);
    } catch (err) {
        _downloading.delete(t.id);
        li.classList.remove('translation-modal-item--downloading');
        progressBar.style.width = '0%';
        _showInlineError(li, progressWrap, progressLabel, 'Download failed — try again');
        console.error('Translation download failed', err);
    }
}

function _showInlineError(li, progressWrap, progressLabel, message) {
    progressWrap.hidden = false;
    progressWrap.classList.add('translation-dl-progress--error');
    progressLabel.textContent = message;
    // Auto-clear after 3 s
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
    const registry = app._translationRegistry || [];
    const t = registry[idx];
    if (!t) return;
    // Simulate a click on the item so download logic runs if needed
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
