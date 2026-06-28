import { describe, expect, it } from 'vitest';
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
