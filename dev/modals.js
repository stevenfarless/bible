// modals.js
// Modal open/close, population, and drag-to-resize for BibleApp.

// ── Open / close ─────────────────────────────────────────────────────────────────────────────────────

export function openModal(app, modal) {
    if (!modal) return;
    modal.classList.add('active');
    document.body.classList.add('modal-open');
}

export function closeModal(app, modal) {
    if (!modal) return;

    // Clear translation keyboard focus state when the translation modal closes
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

// ── Book modal ──────────────────────────────────────────────────────────────────────────────────

export function openBookModal(app) {
    populateBookModal(app);
    openModal(app, app.bookModal);
}

/**
 * Renders the book picker dynamically from app.bibleBooks.
 *
 * app.bibleBooks is { testament: { book: chapterCount } } and may contain
 * any number of testament sections (OT, NT, Deuterocanon, etc.).
 * One .book-category block is created per section, so extended-canon
 * translations automatically get their extra sections without any HTML
 * or code changes.
 *
 * The two static #oldTestamentBooks / #newTestamentBooks divs in index.html
 * are preserved so REQUIRED_IDS validation stays clean, but this function
 * targets the .modal-body container directly and rebuilds it from scratch
 * on every open.
 */
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
                console.log('[DeutModal] button clicked');
                openDeuterocanonInfoModal(app);
            });
            heading.appendChild(infoBtn);
        }
        section.appendChild(heading);

        const grid = document.createElement('div');
        grid.className = 'book-grid';
        // Mirror the legacy IDs on the first two sections so any external
        // code that targets #oldTestamentBooks / #newTestamentBooks still works.
        if (testament === 'Old Testament') grid.id = 'oldTestamentBooks';
        if (testament === 'New Testament') grid.id = 'newTestamentBooks';

        for (const book of Object.keys(books)) {
            grid.appendChild(createBookButton(book));
        }

        section.appendChild(grid);
        modalBody.appendChild(section);
    }
}


// ── Deuterocanon info modal ─────────────────────────────────────────────────────────────────────────────────

export function openDeuterocanonInfoModal(app) {
    console.log('[DeutModal] openDeuterocanonInfoModal called');
    const modal = document.getElementById('deuterocanonInfoModal');
    console.log('[DeutModal] modal element:', modal);
    if (modal) {
        openModal(app, modal);
    } else {
        console.error('[DeutModal] element #deuterocanonInfoModal not found in DOM');
    }
}


// ── Chapter modal ─────────────────────────────────────────────────────────────────────────────────

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

// ── Verse modal ──────────────────────────────────────────────────────────────────────────────────

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

// ── Translation modal ────────────────────────────────────────────────────────────────────────────────

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

        li.addEventListener('click', () => {
            app.changeTranslation(t.id);
            app.closeModal(app.translationModal);
        });

        app.translationList.appendChild(li);
    }
}

// ── Translation modal keyboard helpers ───────────────────────────────────────────────

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
    app.changeTranslation(t.id);
    app.closeModal(app.translationModal);
}

// ── Drag-to-resize ───────────────────────────────────────────────────────────────────────────────────────

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
