#!/usr/bin/env python3
from pathlib import Path

SEARCH_PATH = Path("search.js")
TEST_PATH = Path("tests/unit/search.test.js")


def read(path):
    return path.read_text(encoding="utf-8")


def write(path, text):
    path.write_text(text, encoding="utf-8")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def patch_search_js():
    text = read(SEARCH_PATH)

    if "export function escapeHtml(str)" not in text:
        text = replace_once(
            text,
            '''export function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
''',
            '''export function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
''',
            "search.js escapeHtml helper",
        )

    if "const escapedText = escapeHtml(text);" not in text:
        text = replace_once(
            text,
            '''export function highlightSearchTerm(text, term) {
    if (text == null) return '';
    const safeText = String(text);
    const rawTerm = term == null ? '' : String(term).trim();
    if (!rawTerm) return safeText;
    try {
        const regex = new RegExp(escapeRegExp(rawTerm), 'gi');
        return safeText.replace(regex, (match) => `<strong>${match}</strong>`);
    } catch (err) {
        console.warn('highlightSearchTerm failed', err);
        return safeText;
    }
}
''',
            '''export function highlightSearchTerm(text, term) {
    if (text == null) return '';

    const escapedText = escapeHtml(text);
    const rawTerm = term == null ? '' : String(term).trim();

    if (!rawTerm) return escapedText;

    try {
        const escapedTerm = escapeHtml(rawTerm);
        const regex = new RegExp(escapeRegExp(escapedTerm), 'gi');
        return escapedText.replace(regex, (match) => `<strong>${match}</strong>`);
    } catch (err) {
        console.warn('highlightSearchTerm failed', err);
        return escapedText;
    }
}
''',
            "search.js highlightSearchTerm",
        )

    local_esc = '''
    const esc = (str) =>
        String(str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
'''
    if local_esc in text:
        text = replace_once(text, local_esc, "", "search.js local esc helper")

    if "esc(" in text:
        text = text.replace("esc(", "escapeHtml(")

    if "const preview = escapeHtml(stripHTML(data.passages[0]).substring(0, 200));" not in text:
        text = replace_once(
            text,
            '''        const safeCanonical = String(data.canonical || '').replace(/"/g, '&quot;');
        const preview = stripHTML(data.passages[0]).substring(0, 200);
''',
            '''        const safeCanonical = escapeHtml(data.canonical || '');
        const preview = escapeHtml(stripHTML(data.passages[0]).substring(0, 200));
''',
            "search.js reference lookup escaping",
        )

    write(SEARCH_PATH, text)


def write_search_test():
    TEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    if TEST_PATH.exists():
        text = read(TEST_PATH)
        if "escapes malicious-looking result text before adding highlight markup" in text:
            return
        raise SystemExit(f"{TEST_PATH} already exists without expected issue 432 tests")

    write(
        TEST_PATH,
        '''import { describe, expect, it } from 'vitest';
import { highlightSearchTerm } from '../../search.js';

describe('highlightSearchTerm', () => {
    it('escapes malicious-looking result text before adding highlight markup', () => {
        const result = highlightSearchTerm(
            '<img src=x onerror=alert(1)> beginning',
            'beginning'
        );

        expect(result).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(result).toContain('<strong>beginning</strong>');
        expect(result).not.toContain('<img');
    });

    it('escapes unhighlighted text too', () => {
        expect(highlightSearchTerm('<b>bold</b>', '')).toBe('&lt;b&gt;bold&lt;/b&gt;');
    });

    it('can highlight a term that contains html-looking characters', () => {
        expect(highlightSearchTerm('<tag>', '<tag>')).toBe('<strong>&lt;tag&gt;</strong>');
    });
});
''',
    )


def main():
    patch_search_js()
    write_search_test()


if __name__ == "__main__":
    main()
