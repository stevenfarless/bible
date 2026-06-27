// tests/unit/utils.test.js
// Unit tests for js/utils.js — covers all acceptance-criteria categories
// from issue #89: reference parsing, verse range math, reading state
// defaults, and highlight selector generation.

import { describe, it, expect } from 'vitest';
import {
    escapeHtml,
    parseReference,
    buildCanonical,
    clampVerseRange,
    filterVerseNumbers,
    buildVerseSelector,
    buildVerseId,
    initializeState,
    eventsForChapter,
} from '../../js/utils.js';

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------
describe('escapeHtml', () => {
    it('escapes ampersands', () => {
        expect(escapeHtml('bread & wine')).toBe('bread &amp; wine');
    });

    it('escapes angle brackets', () => {
        expect(escapeHtml('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
    });

    it('escapes double quotes', () => {
        expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('escapes single quotes', () => {
        expect(escapeHtml("it's fine")).toBe('it&#39;s fine');
    });

    it('coerces non-string values', () => {
        expect(escapeHtml(42)).toBe('42');
    });
});

// ---------------------------------------------------------------------------
// parseReference — passage reference parsing
// ---------------------------------------------------------------------------
describe('parseReference', () => {
    it('parses a whole-chapter reference', () => {
        expect(parseReference('John 3')).toEqual({
            book: 'John',
            chapter: 3,
            verseStart: null,
            verseEnd: null,
        });
    });

    it('parses a single-verse reference', () => {
        expect(parseReference('John 3:16')).toEqual({
            book: 'John',
            chapter: 3,
            verseStart: 16,
            verseEnd: null,
        });
    });

    it('parses a verse-range reference', () => {
        expect(parseReference('Romans 8:1-17')).toEqual({
            book: 'Romans',
            chapter: 8,
            verseStart: 1,
            verseEnd: 17,
        });
    });

    it('parses a numbered-book reference', () => {
        expect(parseReference('1 Corinthians 13')).toEqual({
            book: '1 Corinthians',
            chapter: 13,
            verseStart: null,
            verseEnd: null,
        });
    });

    it('parses multi-word book names', () => {
        const result = parseReference('Song of Solomon 2:1');
        expect(result).not.toBeNull();
        expect(result.book).toBe('Song of Solomon');
        expect(result.chapter).toBe(2);
        expect(result.verseStart).toBe(1);
    });

    it('returns null for an empty string', () => {
        expect(parseReference('')).toBeNull();
    });

    it('returns null for a completely invalid string', () => {
        expect(parseReference('not a reference')).toBeNull();
    });

    it('trims leading and trailing whitespace', () => {
        const result = parseReference('  Psalm 23  ');
        expect(result).not.toBeNull();
        expect(result.book).toBe('Psalm');
        expect(result.chapter).toBe(23);
    });
});

// ---------------------------------------------------------------------------
// buildCanonical — canonical string formatting
// ---------------------------------------------------------------------------
describe('buildCanonical', () => {
    it('formats a whole-chapter reference', () => {
        expect(buildCanonical('John', 3, null, null)).toBe('John 3');
    });

    it('formats a single-verse reference', () => {
        expect(buildCanonical('John', 3, 16, 16)).toBe('John 3:16');
    });

    it('formats a verse-range reference', () => {
        expect(buildCanonical('Romans', 8, 1, 17)).toBe('Romans 8:1-17');
    });

    it('omits the end verse when verseEnd equals verseStart', () => {
        expect(buildCanonical('Psalm', 23, 1, 1)).toBe('Psalm 23:1');
    });
});

// ---------------------------------------------------------------------------
// clampVerseRange — verse range math
// ---------------------------------------------------------------------------
describe('clampVerseRange', () => {
    it('passes through a range that fits within the chapter', () => {
        expect(clampVerseRange(1, 17, 50)).toEqual({ verseStart: 1, verseEnd: 17 });
    });

    it('clamps verseEnd to the chapter verse count', () => {
        expect(clampVerseRange(1, 999, 36)).toEqual({ verseStart: 1, verseEnd: 36 });
    });

    it('clamps verseStart to 1 when below bounds', () => {
        expect(clampVerseRange(-5, 5, 30)).toEqual({ verseStart: 1, verseEnd: 5 });
    });

    it('returns nulls for a whole-chapter range', () => {
        expect(clampVerseRange(null, null, 50)).toEqual({ verseStart: null, verseEnd: null });
    });

    it('normalises a single-verse call (no verseEnd)', () => {
        expect(clampVerseRange(16, null, 50)).toEqual({ verseStart: 16, verseEnd: 16 });
    });
});

// ---------------------------------------------------------------------------
// filterVerseNumbers — verse range filtering
// ---------------------------------------------------------------------------
describe('filterVerseNumbers', () => {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8'];

    it('returns all verses when range is null', () => {
        expect(filterVerseNumbers(keys, null, null)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('returns only verses in range', () => {
        expect(filterVerseNumbers(keys, 3, 5)).toEqual([3, 4, 5]);
    });

    it('returns empty array when range is out of bounds', () => {
        expect(filterVerseNumbers(keys, 20, 30)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// buildVerseSelector — highlight / selector generation
// ---------------------------------------------------------------------------
describe('buildVerseSelector', () => {
    it('builds the correct CSS selector for a verse', () => {
        expect(buildVerseSelector(16)).toBe('.verse[data-verse="16"]');
    });

    it('works for verse 1', () => {
        expect(buildVerseSelector(1)).toBe('.verse[data-verse="1"]');
    });
});

// ---------------------------------------------------------------------------
// buildVerseId — element id generation
// ---------------------------------------------------------------------------
describe('buildVerseId', () => {
    it('combines chapter and verse into an id string', () => {
        expect(buildVerseId(3, 16)).toBe('v3-16');
    });
});

// ---------------------------------------------------------------------------
// initializeState — reading state serialization / defaults
// ---------------------------------------------------------------------------
describe('initializeState', () => {
    it('returns an object with the expected default book and chapter', () => {
        const state = initializeState();
        expect(state.currentBook).toBe('John');
        expect(state.currentChapter).toBe(1);
    });

    it('starts with no verse selected', () => {
        expect(initializeState().selectedVerse).toBeNull();
    });

    it('defaults to KJV translation', () => {
        expect(initializeState().translation).toBe('KJV');
    });

    it('defaults fontSize to 18', () => {
        expect(initializeState().fontSize).toBe(18);
    });

    it('shows verse numbers and headings by default', () => {
        const state = initializeState();
        expect(state.showVerseNumbers).toBe(true);
        expect(state.showHeadings).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// eventsForChapter — scaffold filtering
// ---------------------------------------------------------------------------
describe('eventsForChapter', () => {
    it('filters and sorts events for the requested chapter', () => {
        const events = [
            { ch: 2, v: 1, type: 'heading' },
            { ch: 1, v: 4, type: 'para_break' },
            { ch: 1, v: 2, type: 'heading' },
        ];

        expect(eventsForChapter(events, 1)).toEqual([
            { ch: 1, v: 2, type: 'heading' },
            { ch: 1, v: 4, type: 'para_break' },
        ]);
    });
});
