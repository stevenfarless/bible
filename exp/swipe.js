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
//     #swipePrev    (position: absolute, left: -W px)
//     #passageText  (position: absolute, left: 0)          ← app.passageText
//     #swipeNext    (position: absolute, left: +W px)
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
const COMMIT_DISTANCE = 0.25;          // fraction of viewport width
const COMMIT_VELOCITY = 0.4;           // px/ms — fast flick threshold
const ANIMATION_MS_MAX = 280;
const ANIMATION_MS_MIN = 120;
const PARALLAX = .85;                  // changed from 0.9 to 0.85 - incoming panel speed relative to current
const RESISTANCE = 0.3;               // drag multiplier at Bible boundaries

// ── Helpers ───────────────────────────────────────────────────────────────

function _isModalOpen() {
    return !!document.querySelector('.modal.active');
}

function _isSearchOpen(app) {
    return !!app.searchContainer?.classList.contains('active');
}

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

// ── Transition helpers ─────────────────────────────────────────────────────

function _addTransition(el, ms) {
    el.style.transition = `transform ${ms}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
}

function _removeTransition(el) {
    el.style.transition = '';
}

function _animDuration(velocityPxMs) {
    const v = Math.abs(velocityPxMs);
    const t = Math.min(1, v / COMMIT_VELOCITY);
    return Math.round(ANIMATION_MS_MAX - t * (ANIMATION_MS_MAX - ANIMATION_MS_MIN));
}

// ── Haptic feedback ────────────────────────────────────────────────────────

function _haptic(strong = false) {
    if (!navigator.vibrate) return;
    navigator.vibrate(strong ? [30, 20, 30] : [12]);
}

// ── Core init ─────────────────────────────────────────────────────────────

export function initSwipe(app) {
    const currentPanel = document.getElementById('passageText');
    if (!currentPanel) return;

    const vw = () => window.innerWidth;

    const viewport = document.createElement('div');
    viewport.id = 'swipeViewport';
    Object.assign(viewport.style, {
        position: 'relative',
        overflow: 'hidden',
        width:    '100%',
    });

    currentPanel.parentNode.insertBefore(viewport, currentPanel);
    viewport.appendChild(currentPanel);

    const prevPanel = document.createElement('div');
    prevPanel.id        = 'swipePrev';
    prevPanel.className = currentPanel.className;
    Object.assign(prevPanel.style, {
        position:  'absolute',
        top:       '0',
        left:      '0',
        width:     '100%',
        transform: `translateX(${-vw()}px)`,
    });

    const nextPanel = document.createElement('div');
    nextPanel.id        = 'swipeNext';
    nextPanel.className = currentPanel.className;
    Object.assign(nextPanel.style, {
        position:  'absolute',
        top:       '0',
        left:      '0',
        width:     '100%',
        transform: `translateX(${vw()}px)`,
    });

    viewport.insertBefore(prevPanel, currentPanel);
    viewport.appendChild(nextPanel);

    app.swipe = {
        viewport,
        prevPanel,
        nextPanel,
        _syncClasses() {
            const src = app.passageText;
            for (const panel of [this.prevPanel, this.nextPanel]) {
                panel.className      = src.className;
                panel.style.fontSize = src.style.fontSize;
            }
        },
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

    // ── Re-snap panels when viewport width changes (rotation, resize) ─────
    // Without this the panels retain their old pixel offsets after rotation
    // and bleed into the visible area.

    const ro = new ResizeObserver(() => {
        if (_tracking || _animating) return;
        const W = vw();
        _setTranslateX(app.swipe.prevPanel, -W);
        _setTranslateX(app.swipe.nextPanel,  W);
    });
    ro.observe(viewport);

    // ── Touch handling ────────────────────────────────────────────────────

    let _startX = 0;
    let _startY = 0;
    let _lastX  = 0;
    let _lastT  = 0;
    let _velocity        = 0;
    let _tracking        = false;
    let _vetoed          = false;
    let _animating       = false;
    let _currentOffsetPx = 0;

    function _atBoundary(dx) {
        if (dx > 0) return !app.swipe.prevPanel.dataset.book;
        if (dx < 0) return !app.swipe.nextPanel.dataset.book;
        return false;
    }

    function _applyResistance(dx) {
        return _atBoundary(dx) ? dx * RESISTANCE : dx;
    }

    function _cleanupDrag() {
        viewport.classList.remove('swiping');
        _removeTransition(app.passageText);
        _removeTransition(app.swipe.prevPanel);
        _removeTransition(app.swipe.nextPanel);
        app.passageText.style.position = '';
        app.passageText.style.top      = '';
        app.passageText.style.left     = '';
        app.passageText.style.width    = '';
        viewport.style.height          = '';
    }

    viewport.addEventListener('touchstart', (e) => {
        if (_animating) {
            _vetoed = true;
            return;
        }
        _startX          = e.changedTouches[0].screenX;
        _startY          = e.changedTouches[0].screenY;
        _lastX           = _startX;
        _lastT           = e.timeStamp;
        _velocity        = 0;
        _tracking        = false;
        _vetoed          = false;
        _currentOffsetPx = 0;
    }, { passive: true });

    viewport.addEventListener('touchmove', (e) => {
        if (_vetoed) return;
        if (_isModalOpen() || _isSearchOpen(app)) return;

        const touch = e.changedTouches[0];
        const dx = touch.screenX - _startX;
        const dy = touch.screenY - _startY;

        const dt = e.timeStamp - _lastT;
        if (dt > 0) _velocity = (touch.screenX - _lastX) / dt;
        _lastX = touch.screenX;
        _lastT = e.timeStamp;

        if (!_tracking) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;

            if (Math.abs(dy) > Math.abs(dx) * TAN_30 || Math.abs(dy) > Math.abs(dx)) {
                _vetoed = true;
                return;
            }
            _tracking = true;
            viewport.classList.add('swiping');

            app.passageText.style.position = 'absolute';
            app.passageText.style.top      = '0';
            app.passageText.style.left     = '0';
            app.passageText.style.width    = '100%';
            viewport.style.height = app.passageText.offsetHeight + 'px';
        }

        e.preventDefault();

        const W         = vw();
        const effective = _applyResistance(dx);
        _currentOffsetPx = dx;

        _setTranslateX(app.passageText, effective);

        if (dx < 0) {
            _setTranslateX(app.swipe.nextPanel, W + effective * PARALLAX);
            _setTranslateX(app.swipe.prevPanel, effective - W);
        } else {
            _setTranslateX(app.swipe.prevPanel, effective - W + (effective - effective * PARALLAX));
            _setTranslateX(app.swipe.nextPanel, W + effective);
        }
    }, { passive: false });

    viewport.addEventListener('touchend', (e) => {
        if (_vetoed || !_tracking) {
            if (_tracking) _cleanupDrag();
            _tracking = false;
            _vetoed   = false;
            return;
        }
        _tracking = false;

        const dx    = _currentOffsetPx;
        const W     = vw();
        const absDx = Math.abs(dx);
        const absV  = Math.abs(_velocity);

        const commit    = (absDx >= W * COMMIT_DISTANCE || absV >= COMMIT_VELOCITY) && absDx >= 50;
        const direction = dx < 0 ? 1 : -1;
        const animMs    = _animDuration(_velocity);

        const cancelSwipe = () => {
            viewport.classList.remove('swiping');
            _addTransition(app.passageText, animMs);
            _addTransition(app.swipe.prevPanel, animMs);
            _addTransition(app.swipe.nextPanel, animMs);

            _setTranslateX(app.passageText, 0);
            _setTranslateX(app.swipe.prevPanel, -W);
            _setTranslateX(app.swipe.nextPanel, +W);

            setTimeout(() => {
                _cleanupDrag();
                _setTranslateX(app.swipe.prevPanel, -W);
                _setTranslateX(app.swipe.nextPanel, +W);
            }, animMs);
        };

        if (!commit) {
            if (_atBoundary(dx) && absDx > 20) _haptic(true);
            cancelSwipe();
            return;
        }

        const incomingPanel   = direction === 1 ? app.swipe.nextPanel : app.swipe.prevPanel;
        const uninvolvedPanel = direction === 1 ? app.swipe.prevPanel : app.swipe.nextPanel;
        const incomingPos     = direction === 1
            ? { book: app.swipe.nextPanel.dataset.book, chapter: parseInt(app.swipe.nextPanel.dataset.chapter, 10) }
            : { book: app.swipe.prevPanel.dataset.book,  chapter: parseInt(app.swipe.prevPanel.dataset.chapter,  10) };

        if (!incomingPos.book) {
            _haptic(true);
            cancelSwipe();
            return;
        }

        _haptic(false);
        _animating = true;

        viewport.classList.remove('swiping');
        _addTransition(app.passageText, animMs);
        _addTransition(app.swipe.prevPanel, animMs);
        _addTransition(app.swipe.nextPanel, animMs);

        const outOffset = direction === 1 ? -W : +W;
        _setTranslateX(app.passageText, outOffset);
        _setTranslateX(app.swipe.prevPanel, outOffset - W);
        _setTranslateX(app.swipe.nextPanel, outOffset + W);

        setTimeout(async () => {
            _removeTransition(app.passageText);
            _removeTransition(app.swipe.prevPanel);
            _removeTransition(app.swipe.nextPanel);

            const outgoingPanel = app.passageText;

            incomingPanel.style.fontSize = outgoingPanel.style.fontSize;
            incomingPanel.scrollTop      = 0;

            _clearTranslateX(incomingPanel);
            incomingPanel.style.position = '';
            incomingPanel.style.top      = '';
            incomingPanel.style.left     = '';
            incomingPanel.style.width    = '';

            // Snap the uninvolved panel to its canonical off-screen position
            // before slot reassignment. During the drag it accumulated a
            // parallax offset; leaving it there causes a visible flash when
            // it becomes the new prev/next panel.
            _setTranslateX(uninvolvedPanel, direction === 1 ? +W : -W);

            const oldId      = incomingPanel.id;
            incomingPanel.id = 'passageText';
            outgoingPanel.id = oldId;
            app.passageText  = incomingPanel;

            _clearTranslateX(outgoingPanel);
            outgoingPanel.style.position = 'absolute';
            outgoingPanel.style.top      = '0';
            outgoingPanel.style.left     = '0';
            outgoingPanel.style.width    = '100%';
            _setTranslateX(outgoingPanel, direction === 1 ? -W : +W);

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

            // Defer rendering into off-screen panels until the next frame so
            // the browser paints their correct ±W transforms before new HTML
            // is injected. Without this the content can appear at center
            // briefly before the off-screen snap is committed to paint.
            requestAnimationFrame(() => {
                app.swipe.syncAdjacentPanels();
            });
        }, animMs);
    }, { passive: true });
}
