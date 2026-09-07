#!/usr/bin/env python3
"""One-time patch to preserve non-numeric Brenton verse labels across reader UI paths."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def replace_once(filename: str, old: str, new: str) -> None:
    path = ROOT / filename
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"Expected source block not found in {filename}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "events.js",
    '''    const selectVerse = (verse) => {
      const num = parseInt(verse?.dataset.verse, 10);
      if (!num) return;

      if (app.state.selectedVerse === num) {
        app.state.selectedVerse = null;
        app.applyVerseGlow();
      } else {
        app.scrollToVerse(num);
      }
    };''',
    '''    const selectVerse = (verse) => {
      const raw = verse?.dataset.verse;
      if (!raw) return;
      const value = /^\\d+$/.test(raw) ? Number(raw) : raw.toLowerCase();

      if (app.state.selectedVerse === value) {
        app.state.selectedVerse = null;
        app.applyVerseGlow();
      } else {
        app.scrollToVerse(value);
      }
    };''',
)

replace_once(
    "navigation.js",
    '''/**
 * Scrolls to the next verse in the current chapter, or advances to the
 * next chapter if already on the last verse.
 * @param {object} app
 */
export function navigateToNextVerse(app) {
    const currentVerse = app.state.selectedVerse || 1;
    const maxVerse = app.getCurrentVerseCount();

    if (currentVerse < maxVerse) {
        app.scrollToVerse(currentVerse + 1);
    } else {
        app.navigateChapter(1);
    }
}

/**
 * Scrolls to the previous verse in the current chapter, or goes back to
 * the last verse of the previous chapter (or previous book) if already
 * on verse 1.
 * @param {object} app
 */
export function navigateToPreviousVerse(app) {
    const currentVerse = app.state.selectedVerse || 1;

    if (currentVerse > 1) {
        app.scrollToVerse(currentVerse - 1);
        return;
    }
''',
    '''function getCurrentVerseIds(app) {
    return Array.from(
        app.passageText.querySelectorAll('.verse[data-verse]'),
        (verse) => {
            const raw = verse.dataset.verse;
            return /^\\d+$/.test(raw) ? Number(raw) : raw.toLowerCase();
        }
    );
}

/**
 * Scrolls to the next verse in the current chapter, or advances to the
 * next chapter if already on the last verse.
 * @param {object} app
 */
export function navigateToNextVerse(app) {
    const verses = getCurrentVerseIds(app);
    const currentIndex = app.state.selectedVerse == null
        ? 0
        : verses.findIndex((verse) => String(verse) === String(app.state.selectedVerse));

    if (currentIndex < verses.length - 1) {
        app.scrollToVerse(verses[currentIndex + 1]);
    } else {
        app.navigateChapter(1);
    }
}

/**
 * Scrolls to the previous verse in the current chapter, or goes back to
 * the last verse of the previous chapter (or previous book) if already
 * on verse 1.
 * @param {object} app
 */
export function navigateToPreviousVerse(app) {
    const verses = getCurrentVerseIds(app);
    const currentIndex = app.state.selectedVerse == null
        ? 0
        : verses.findIndex((verse) => String(verse) === String(app.state.selectedVerse));

    if (currentIndex > 0) {
        app.scrollToVerse(verses[currentIndex - 1]);
        return;
    }
''',
)

replace_once(
    "modals.js",
    '''    const grid = document.createElement('div');
    grid.className = 'chapter-grid';
    const verseCount = getCurrentVerseCount(app);

    if (verseCount === 0) {''',
    '''    const grid = document.createElement('div');
    grid.className = 'chapter-grid';
    const verseIds = Array.from(
        app.passageText.querySelectorAll('.verse[data-verse]'),
        (verse) => {
            const raw = verse.dataset.verse;
            return /^\\d+$/.test(raw) ? Number(raw) : raw.toLowerCase();
        }
    );

    if (verseIds.length === 0) {''',
)

replace_once(
    "modals.js",
    '''    for (let i = 1; i <= verseCount; i++) {
        const btn = document.createElement('button');
        btn.className = 'chapter-item';
        btn.type = 'button';
        btn.textContent = i;
        btn.classList.toggle('picker-item--active', i === activeVerse);
        btn.addEventListener('click', () => {
            app._dbgUserAction?.('picker selected verse: ' + app.state.currentBook + ' ' + app.state.currentChapter + ':' + i);
            app._dbgEvent?.('picker selected verse: ' + app.state.currentBook + ' ' + app.state.currentChapter + ':' + i);
            app.referencePickerDraft = null;
            app.scrollToVerse(i);
            closeReferencePicker(app);
        });
        grid.appendChild(btn);
    }''',
    '''    for (const verseId of verseIds) {
        const btn = document.createElement('button');
        btn.className = 'chapter-item';
        btn.type = 'button';
        btn.textContent = verseId;
        btn.classList.toggle(
            'picker-item--active',
            String(verseId) === String(activeVerse)
        );
        btn.addEventListener('click', () => {
            app._dbgUserAction?.('picker selected verse: ' + app.state.currentBook + ' ' + app.state.currentChapter + ':' + verseId);
            app._dbgEvent?.('picker selected verse: ' + app.state.currentBook + ' ' + app.state.currentChapter + ':' + verseId);
            app.referencePickerDraft = null;
            app.scrollToVerse(verseId);
            closeReferencePicker(app);
        });
        grid.appendChild(btn);
    }''',
)

bookmarks = ROOT / "bookmarks.js"
text = bookmarks.read_text(encoding="utf-8")

old = '''const BOOKMARK_COLORS = ["red", "green", "blue"];
const BOOKMARK_COLOR_SET = new Set(BOOKMARK_COLORS);

function emptyBookmarks() {'''
new = '''const BOOKMARK_COLORS = ["red", "green", "blue"];
const BOOKMARK_COLOR_SET = new Set(BOOKMARK_COLORS);
const VERSE_ID_PATTERN = /^[1-9]\\d*(?:[a-z]+|-[1-9]\\d*[a-z]*)?$/i;

function normalizeVerseId(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!VERSE_ID_PATTERN.test(raw)) return null;
  return /^\\d+$/.test(raw) ? Number(raw) : raw;
}

function emptyBookmarks() {'''
if old not in text:
    raise RuntimeError("Expected bookmark constants block not found")
text = text.replace(old, new, 1)

text = text.replace(
    '    Number.isInteger(Number(item.verse)) &&',
    '    normalizeVerseId(item.verse) !== null &&',
    1,
)
text = text.replace(
    '      verse: Number(item.verse),',
    '      verse: normalizeVerseId(item.verse),',
    1,
)
text = text.replace(
    '''function getBookmarkId(book, chapter, verse) {
  return `${makeBookKey(book)}_${Number(chapter)}_${Number(verse)}`;
}

function getSelectedVerse(app) {
  const verse = Number(app.state?.selectedVerse);
  return Number.isInteger(verse) && verse > 0 ? verse : null;
}''',
    '''function getBookmarkId(book, chapter, verse) {
  return `${makeBookKey(book)}_${Number(chapter)}_${normalizeVerseId(verse)}`;
}

function getSelectedVerse(app) {
  return normalizeVerseId(app.state?.selectedVerse);
}''',
    1,
)
text = text.replace(
    '      return Number(a.verse) - Number(b.verse);',
    '      return String(a.verse).localeCompare(String(b.verse), undefined, { numeric: true });',
    1,
)
text = text.replace(
    '      `.verse[data-verse="${Number(item.verse)}"]`,',
    '      `.verse[data-verse="${item.verse}"]`,',
    1,
)
text = text.replace(
    '    `.verse[data-verse="${Number(item.verse)}"]`,',
    '    `.verse[data-verse="${item.verse}"]`,',
    1,
)
text = text.replace(
    '    app.scrollToVerse?.(Number(item.verse));',
    '    app.scrollToVerse?.(item.verse);',
    1,
)

bookmarks.write_text(text, encoding="utf-8")
