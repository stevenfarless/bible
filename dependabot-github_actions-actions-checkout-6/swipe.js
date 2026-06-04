// swipe.js
// Phase 3 three-panel drag-follow chapter navigation.
//
// Architecture
// ────────────
// #passageText stays as app.passageText (current panel) so every existing
// reader that writes to it works without change.
//
// On initSwipe() we wrap #passageText in a new #swipeViewport clipping div
// and prepend/append two sibling panels:
//
//   #swipeViewport  (overflow: hidden, position: relative)
//     #swipePrev    (position: absolute, left: -100vw)
//     #passageText  (position: absolute, left: 0)          ← app.passageText
//     #swipeNext    (position: absolute, left: +100vw)
//
// After every loadPassage() resolves, pre-render adjacent chapters into the
// sibling panels using the same bibleApi render pipeline.
//
// On commit the incoming panel is promoted to current:
//   - its node is swapped with #passageText in the DOM
//   - app.passageText is reassigned to the new centre node
//   - the outgoing panel moves to the far side
//   - app.swipe.prevPanel and app.swipe.nextPanel are both reassigned so
//     the next drag always moves the correct nodes
//
// _animating is set true from the moment a commit animation starts until the
// setTimeout callback completes. Any touchstart while _animating is true is
// dropped, preventing concurrent panel swaps from corrupting the slot refs.
//
// Callers outside this module only need:
//   import { initSwipe } from './swipe.js';
//   // in attachEventListeners:
//   initSwipe(app);
//   // after every loadPassage() resolves (including translation/settings changes):
//   app.swipe?.syncAdjacentPanels();

import { loadStructure, eventsForChapter } from './bsb-structure.js';

const TAN_30 = Math.tan(Math.PI / 6); // ≈ 0.577
const COMMIT_THRESHOLD = 0.35;         // fraction of viewport width
const ANIMATION_MS = 280;

// ── Helpers ───────────────────────────────────────────────────────────────

function _isModalOpen() {
    return !!document.querySelector('.modal.active');
}

function _isSearchOpen(app) {
    return !!app.searchContainer?.classList.contains('active');
}

// Return { book, chapter } for the chapter immediately before/after the
// current one, following the same book-boundary logic as navigateChapter.
function _adjacentPosition(app, direction) {
    const books = app.getAllBooks();
    const idx   = books.indexOf(app.state.currentBook);
    if (idx === -1) return null;

    let book    = app.state.currentBook;
    let chapter = app.state.currentChapter + direction;
    const count = app.getChapterCount(book);

    if (chapter < 1) {
        if (idx === 0) return null;
        book    = books[idx - 1];
        chapter = app.getChapterCount(book);
    } else if (chapter > count) {
        if (idx === books.length - 1) return null;
        book    = books[idx + 1];
        chapter = 1;
    }

    return { book, chapter };
}

// Fetch and render a passage into a panel element.
// Returns true on success, false if the position is out of range or fetch fails.
async function _renderIntoPanel(app, panel, pos) {
    if (!pos) {
        panel.innerHTML = '';
        panel.dataset.book    = '';
        panel.dataset.chapter = '';
        return false;
    }

    try {
        let scaffoldEvents = [];
        try {
            const allEvents = await loadStructure(pos.book);
            scaffoldEvents  = eventsForChapter(allEvents, pos.chapter);
        } catch (_) {}

        const data = await app.bibleApi.fetchPassage(
            `${pos.book} ${pos.chapter}`,
            scaffoldEvents,
            app.state.showHeadings !== false
        );

        if (!data) {
            panel.innerHTML = '';
            panel.dataset.book    = '';
            panel.dataset.chapter = '';
            return false;
        }

        panel.innerHTML = data.passages[0];
        panel.classList.toggle('verse-by-verse', !!app.state.verseByVerse);
        panel.dataset.book    = pos.book;
        panel.dataset.chapter = String(pos.chapter);
        return true;
    } catch (_) {
        panel.innerHTML = '';
        panel.dataset.book    = '';
        panel.dataset.chapter = '';
        return false;
    }
}

// ── Panel position helpers ─────────────────────────────────────────────────

function _setTranslateX(el, px) {
    el.style.transform = `translateX(${px}px)`;
}

function _clearTranslateX(el) {
    el.style.transform = '';
}

// ── Commit / cancel animation ──────────────────────────────────────────────

function _addTransition(el) {
    el.style.transition = `transform ${ANIMATION_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
}

function _removeTransition(el) {
    el.style.transition = '';
}

// ── Core init ─────────────────────────────────────────────────────────────

export function initSwipe(app) {
    const currentPanel = document.getElementById('passageText');
    if (!currentPanel) return;

    // Build the viewport wrapper
    const viewport = document.createElement('div');
    viewport.id = 'swipeViewport';
    Object.assign(viewport.style, {
        position:   'relative',
        overflow:   'hidden',
        width:      '100%',
        // Height is set dynamically to match the current panel
    });

    // Insert viewport before currentPanel, then move currentPanel inside
    currentPanel.parentNode.insertBefore(viewport, currentPanel);
    viewport.appendChild(currentPanel);

    // Prev panel
    const prevPanel = document.createElement('div');
    prevPanel.id        = 'swipePrev';
    prevPanel.className = currentPanel.className;
    Object.assign(prevPanel.style, {
        position: 'absolute',
        top:      '0',
        left:     '0',
        width:    '100%',
        transform: 'translateX(-100vw)',
    });

    // Next panel
    const nextPanel = document.createElement('div');
    nextPanel.id        = 'swipeNext';
    nextPanel.className = currentPanel.className;
    Object.assign(nextPanel.style, {
        position: 'absolute',
        top:      '0',
        left:     '0',
        width:    '100%',
        transform: 'translateX(100vw)',
    });

    viewport.insertBefore(prevPanel, currentPanel);
    viewport.appendChild(nextPanel);

    // Track state on the app instance
    app.swipe = {
        viewport,
        prevPanel,
        nextPanel,
        // Sync class list and inline font size from current panel to siblings
        _syncClasses() {
            const src = app.passageText;
            for (const panel of [this.prevPanel, this.nextPanel]) {
                panel.className = src.className;
                panel.style.fontSize = src.style.fontSize;
            }
        },
        // Re-render both adjacent panels after the current passage changes.
        // Fire-and-forget — failures leave the panel empty (handled gracefully on commit).
        async syncAdjacentPanels() {
            this._syncClasses();
            const prevPos = _adjacentPosition(app, -1);
            const nextPos = _adjacentPosition(app, +1);
            await Promise.all([
                _renderIntoPanel(app, this.prevPanel, prevPos),
                _renderIntoPanel(app, this.nextPanel, nextPos),
            ]);
        },
    };

    // ── Touch handling ────────────────────────────────────────────────────
    // All panel references go through app.swipe so they stay current after
    // each commit swaps which DOM node is prev/next.

    let _startX = 0;
    let _startY = 0;
    let _tracking  = false; // true once we've confirmed a horizontal gesture
    let _vetoed    = false; // true once we've confirmed a vertical gesture
    let _animating = false; // true while a commit animation setTimeout is pending
    let _currentOffsetPx = 0;

    const vw = () => window.innerWidth;

    viewport.addEventListener('touchstart', (e) => {
        // Ignore new touches until the in-flight commit animation settles.
        if (_animating) {
            _vetoed = true;
            return;
        }
        _startX  = e.changedTouches[0].screenX;
        _startY  = e.changedTouches[0].screenY;
        _tracking = false;
        _vetoed   = false;
        _currentOffsetPx = 0;
    }, { passive: true });

    viewport.addEventListener('touchmove', (e) => {
        if (_vetoed) return;
        if (_isModalOpen() || _isSearchOpen(app)) return;

        const dx = e.changedTouches[0].screenX - _startX;
        const dy = e.changedTouches[0].screenY - _startY;

        if (!_tracking) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;

            if (Math.abs(dy) > Math.abs(dx) * TAN_30 || Math.abs(dy) > Math.abs(dx)) {
                _vetoed = true;
                return;
            }
            _tracking = true;

            app.passageText.style.position = 'absolute';
            app.passageText.style.top      = '0';
            app.passageText.style.left     = '0';
            app.passageText.style.width    = '100%';
            viewport.style.height = app.passageText.offsetHeight + 'px';
        }

        e.preventDefault();

        _currentOffsetPx = dx;
        const W = vw();
        _setTranslateX(app.passageText, dx);
        _setTranslateX(app.swipe.prevPanel, dx - W);
        _setTranslateX(app.swipe.nextPanel, dx + W);
    }, { passive: false });

    viewport.addEventListener('touchend', (e) => {
        if (_vetoed || !_tracking) {
            _tracking = false;
            _vetoed   = false;
            return;
        }
        _tracking = false;

        const dx = _currentOffsetPx;
        const W  = vw();
        const commit = Math.abs(dx) >= W * COMMIT_THRESHOLD;
        const direction = dx < 0 ? 1 : -1; // left swipe = next = +1

        if (!commit || Math.abs(dx) < 50) {
            _addTransition(app.passageText);
            _addTransition(app.swipe.prevPanel);
            _addTransition(app.swipe.nextPanel);

            _setTranslateX(app.passageText, 0);
            _setTranslateX(app.swipe.prevPanel, -W);
            _setTranslateX(app.swipe.nextPanel, +W);

            const cleanup = () => {
                _removeTransition(app.passageText);
                _removeTransition(app.swipe.prevPanel);
                _removeTransition(app.swipe.nextPanel);
                app.passageText.style.position = '';
                app.passageText.style.top      = '';
                app.passageText.style.left     = '';
                app.passageText.style.width    = '';
                viewport.style.height          = '';
            };
            setTimeout(cleanup, ANIMATION_MS);
            return;
        }

        const incomingPanel   = direction === 1 ? app.swipe.nextPanel : app.swipe.prevPanel;
        const uninvolvedPanel = direction === 1 ? app.swipe.prevPanel : app.swipe.nextPanel;
        const incomingPos     = direction === 1
            ? { book: app.swipe.nextPanel.dataset.book, chapter: parseInt(app.swipe.nextPanel.dataset.chapter, 10) }
            : { book: app.swipe.prevPanel.dataset.book,  chapter: parseInt(app.swipe.prevPanel.dataset.chapter,  10) };

        if (!incomingPos.book) {
            _addTransition(app.passageText);
            _addTransition(app.swipe.prevPanel);
            _addTransition(app.swipe.nextPanel);
            _setTranslateX(app.passageText, 0);
            _setTranslateX(app.swipe.prevPanel, -W);
            _setTranslateX(app.swipe.nextPanel, +W);
            setTimeout(() => {
                _removeTransition(app.passageText);
                _removeTransition(app.swipe.prevPanel);
                _removeTransition(app.swipe.nextPanel);
                app.passageText.style.position = '';
                app.passageText.style.top      = '';
                app.passageText.style.left     = '';
                app.passageText.style.width    = '';
                viewport.style.height          = '';
            }, ANIMATION_MS);
            return;
        }

        _animating = true;

        _addTransition(app.passageText);
        _addTransition(app.swipe.prevPanel);
        _addTransition(app.swipe.nextPanel);

        const outOffset = direction === 1 ? -W : +W;
        _setTranslateX(app.passageText, outOffset);
        _setTranslateX(app.swipe.prevPanel,  outOffset - W);
        _setTranslateX(app.swipe.nextPanel,  outOffset + W);

        setTimeout(async () => {
            _removeTransition(app.passageText);
            _removeTransition(app.swipe.prevPanel);
            _removeTransition(app.swipe.nextPanel);

            const outgoingPanel = app.passageText;

            // Copy inline font size before promoting so the incoming panel
            // matches whatever size the app has applied to the current panel.
            incomingPanel.style.fontSize = outgoingPanel.style.fontSize;

            _clearTranslateX(incomingPanel);
            incomingPanel.style.position = '';
            incomingPanel.style.top      = '';
            incomingPanel.style.left     = '';
            incomingPanel.style.width    = '';

            const oldId         = incomingPanel.id;
            incomingPanel.id    = 'passageText';
            outgoingPanel.id    = oldId;
            app.passageText     = incomingPanel;

            // Move the outgoing panel to the far side (opposite to where we came from).
            // direction===1 (left swipe → went forward): outgoing goes to prev slot
            // direction===-1 (right swipe → went back):  outgoing goes to next slot
            _clearTranslateX(outgoingPanel);
            outgoingPanel.style.position = 'absolute';
            outgoingPanel.style.top      = '0';
            outgoingPanel.style.left     = '0';
            outgoingPanel.style.width    = '100%';
            _setTranslateX(outgoingPanel, direction === 1 ? -W : +W);

            // Reassign BOTH slot references.
            // After a direction===1 commit:
            //   prev slot → outgoing (just moved there)
            //   next slot → uninvolved (was prev before; will hold ch+1 after sync)
            // After a direction===-1 commit:
            //   next slot → outgoing (just moved there)
            //   prev slot → uninvolved (was next before; will hold ch-1 after sync)
            if (direction === 1) {
                app.swipe.prevPanel = outgoingPanel;
                app.swipe.nextPanel = uninvolvedPanel;
            } else {
                app.swipe.nextPanel = outgoingPanel;
                app.swipe.prevPanel = uninvolvedPanel;
            }

            viewport.style.height = '';

            app.state.currentBook    = incomingPos.book;
            app.state.currentChapter = incomingPos.chapter;

            const title = incomingPos.book === 'Psalm'
                ? `Psalm ${incomingPos.chapter}`
                : `${app.getDisplayName(incomingPos.book)} ${incomingPos.chapter}`;

            if (app.passageTitle) app.passageTitle.textContent = title;
            app.updateNavigationState?.();
            app.updateCopyright?.();
            if (app.currentVerseSpan) app.currentVerseSpan.textContent = '1';
            app.showChrome?.();
            window.scrollTo(0, 0);
            app.saveReadingPosition?.();
            app._savePassageCache?.(
                incomingPos.book,
                incomingPos.chapter,
                app.state.translation || 'KJV',
                title,
                app.passageText.innerHTML
            );
            app._dbgEvent?.(`swipe commit: ${incomingPos.book} ${incomingPos.chapter} (direction=${direction})`);
            app._dbgUserAction?.(`swipe: ${direction === 1 ? 'next' : 'prev'} → ${incomingPos.book} ${incomingPos.chapter}`);

            _animating = false;

            await app.swipe.syncAdjacentPanels();
        }, ANIMATION_MS);
    }, { passive: true });
}
