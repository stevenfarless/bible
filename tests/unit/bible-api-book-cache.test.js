import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const translationStore = vi.hoisted(() => ({
    idbGetBook: vi.fn(),
    idbPutBook: vi.fn(),
    idbGetSearchIndex: vi.fn(),
    idbPutSearchIndex: vi.fn(),
    idbIsDownloaded: vi.fn(),
    idbMarkDownloaded: vi.fn(),
    idbDeleteTranslation: vi.fn(),
}));

vi.mock('../../translation-store.js', () => translationStore);

import { BibleApi } from '../../bible-api.js';
import { idbGetBook } from '../../translation-store.js';

const originalFetch = globalThis.fetch;
const genesisData = {
    Genesis: {
        '1': {
            '1': 'In the beginning',
        },
    },
};

describe('BibleApi book-load cache misses', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        idbGetBook.mockReset();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        globalThis.fetch = originalFetch;
    });

    it('retries a non-precached local book after an IndexedDB miss', async () => {
        const api = new BibleApi('ASV');
        idbGetBook
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(genesisData);

        const first = await api._loadBook('ASV', 'Genesis');
        const second = await api._loadBook('ASV', 'Genesis');

        expect(first).toBeNull();
        expect(second).toBe(genesisData);
        expect(idbGetBook).toHaveBeenCalledTimes(2);
        expect(api._bookCache.get('ASV/Genesis')).toBe(genesisData);
    });

    it('retries a precached local book after a failed network load', async () => {
        const api = new BibleApi('KJV');
        const fetchMock = vi
            .fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce({
                ok: true,
                json: async () => genesisData,
            });
        globalThis.fetch = fetchMock;

        const first = await api._loadBook('KJV', 'Genesis');
        const second = await api._loadBook('KJV', 'Genesis');

        expect(first).toBeNull();
        expect(second).toBe(genesisData);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(api._bookCache.get('KJV/Genesis')).toBe(genesisData);
    });
});
