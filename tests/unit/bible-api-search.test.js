import { describe, it, expect } from 'vitest';
import { BibleApi } from '../../bible-api.js';

function makeApi() {
    const api = new BibleApi('KJV');

    api._searchIndexCache.set('KJV', {
        'Genesis 1:1': 'he that hateth his brother',
        'Genesis 1:2': 'he hath spoken',
        'Genesis 1:3': 'they hated him',
        'Genesis 1:4': 'sin entered the world',
        'Genesis 1:5': 'since that day',
        'Genesis 1:6': 'the man stood',
        'Genesis 1:7': 'many were there',
        'Genesis 1:8': 'he spoke plainly',
        'Genesis 1:9': 'the word was spoken',
    });

    api._bookCache.set('KJV/Genesis', {
        Genesis: {
            '1': {
                '1': 'He that hateth his brother',
                '2': 'He hath spoken',
                '3': 'They hated him',
                '4': 'Sin entered the world',
                '5': 'Since that day',
                '6': 'The man stood',
                '7': 'Many were there',
                '8': 'He spoke plainly',
                '9': 'The word was spoken',
            },
        },
    });

    return api;
}

describe('BibleApi search word matching', () => {
    it('matches hate forms without matching hath', async () => {
        const api = makeApi();
        const { results } = await api.searchPassages('hate');

        expect(results.map((result) => result.reference)).toEqual([
            'Genesis 1:1',
            'Genesis 1:3',
        ]);
    });

    it('does not match sin inside since', async () => {
        const api = makeApi();
        const { results } = await api.searchPassages('sin');

        expect(results.map((result) => result.reference)).toEqual([
            'Genesis 1:4',
        ]);
    });

    it('does not match man inside many', async () => {
        const api = makeApi();
        const { results } = await api.searchPassages('man');

        expect(results.map((result) => result.reference)).toEqual([
            'Genesis 1:6',
        ]);
    });

    it('does not match he inside the', async () => {
        const api = makeApi();
        const { results } = await api.searchPassages('he');

        expect(results.map((result) => result.reference)).toEqual([
            'Genesis 1:1',
            'Genesis 1:2',
            'Genesis 1:8',
        ]);
    });
});
