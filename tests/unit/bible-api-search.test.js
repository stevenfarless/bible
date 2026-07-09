import { describe, it, expect } from 'vitest';
import { BibleApi } from '../../bible-api.js';
import { buildInvertedSearchIndex } from '../../search-index-engine.js';

const SEARCH_INDEX_FIXTURE = {
    'Genesis 1:1': 'he that hateth his brother',
    'Genesis 1:2': 'he hath spoken',
    'Genesis 1:3': 'they hated him',
    'Genesis 1:4': 'sin entered the world',
    'Genesis 1:5': 'since that day',
    'Genesis 1:6': 'the man stood',
    'Genesis 1:7': 'many were there',
    'Genesis 1:8': 'he spoke plainly',
    'Genesis 1:9': 'the word was spoken',
    'Genesis 1:10': 'predestinated us unto adoption',
    'Genesis 1:11': 'predestin doctrine appears',
};

function makeApi({ index = buildInvertedSearchIndex(SEARCH_INDEX_FIXTURE) } = {}) {
    const api = new BibleApi('KJV');

    api._searchIndexCache.set('KJV', index);

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
                '10': 'Predestinated us unto adoption',
                '11': 'Predestin doctrine appears',
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

    it('matches long word prefixes and ranks exact matches first', async () => {
        const api = makeApi();
        const { results } = await api.searchPassages('predestin');

        expect(results.map((result) => result.reference)).toEqual([
            'Genesis 1:11',
            'Genesis 1:10',
        ]);
    });

    it('matches raw prefixes before normalization can alter the query', async () => {
        const api = makeApi();
        const { results } = await api.searchPassages('predest');

        expect(results.map((result) => result.reference)).toEqual([
            'Genesis 1:10',
            'Genesis 1:11',
        ]);
    });

    it('does not match short word prefixes', async () => {
        const api = makeApi();
        const { results } = await api.searchPassages('prede');

        expect(results.map((result) => result.reference)).toEqual([]);
    });

    it('does not match a middle slice of a word', async () => {
        const api = makeApi();
        const { results } = await api.searchPassages('destin');

        expect(results.map((result) => result.reference)).toEqual([]);
    });

    it('matches reference wildcards through the compact reference table', async () => {
        const api = makeApi();
        const { results } = await api.searchPassages('Genesis 1:*');

        expect(results.map((result) => result.reference)).toEqual([
            'Genesis 1:1',
            'Genesis 1:2',
            'Genesis 1:3',
            'Genesis 1:4',
            'Genesis 1:5',
            'Genesis 1:6',
            'Genesis 1:7',
            'Genesis 1:8',
            'Genesis 1:9',
            'Genesis 1:10',
            'Genesis 1:11',
        ]);
    });

    it('narrows wildcard text searches with postings and verifies verse text', async () => {
        const api = makeApi();
        const { results } = await api.searchPassages('predest*');

        expect(results.map((result) => result.reference)).toEqual([
            'Genesis 1:10',
            'Genesis 1:11',
        ]);
    });

    it('migrates legacy flat indexes without changing matches', async () => {
        const api = makeApi({ index: SEARCH_INDEX_FIXTURE });
        const { results } = await api.searchPassages('hate');

        expect(results.map((result) => result.reference)).toEqual([
            'Genesis 1:1',
            'Genesis 1:3',
        ]);
        expect(api._searchIndexCache.get('KJV')).not.toBe(SEARCH_INDEX_FIXTURE);
    });

    it('uses indexed preview text without fetching matched books', async () => {
        const api = new BibleApi('KJV');
        api._searchIndexCache.set('KJV', buildInvertedSearchIndex({
            'Romans 8:29': 'for whom he did foreknow, he also did predestinate',
        }));
        api._loadBook = async () => {
            throw new Error('search result hydration should not fetch books');
        };

        const { results } = await api.searchPassages('predestinate');

        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({
            reference: 'Romans 8:29',
            content: 'for whom he did foreknow, he also did predestinate',
        });
    });

    it('ranks exact matches first when falling back to book scanning', async () => {
        const api = makeApi({ index: null });
        const { results } = await api.searchPassages('predestin');

        expect(results.map((result) => result.reference)).toEqual([
            'Genesis 1:11',
            'Genesis 1:10',
        ]);
    });

    it('matches raw prefixes when falling back to book scanning', async () => {
        const api = makeApi({ index: null });
        const { results } = await api.searchPassages('predest');

        expect(results.map((result) => result.reference)).toEqual([
            'Genesis 1:10',
            'Genesis 1:11',
        ]);
    });
});
