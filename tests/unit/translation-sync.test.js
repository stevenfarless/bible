import { describe, expect, it, vi } from 'vitest';

vi.mock('../../bible-api.js', () => ({
    LOCAL_TRANSLATIONS: new Set([
        'ASV', 'BLB', 'BSB', 'CSB', 'ESV', 'ISV', 'KJV', 'LEB',
        'MEV', 'MSB', 'NET', 'NIV', 'NKJV', 'NLT', 'NRSVUE', 'WEB',
    ]),
    PRECACHED_TRANSLATIONS: new Set(['BSB', 'KJV']),
}));

vi.mock('../../translation-store.js', () => ({
    idbDeleteTranslation: vi.fn(),
    idbGetBook: vi.fn(),
    idbIsDownloaded: vi.fn(),
}));

const {
    chooseDeviceTranslation,
    isBuiltInTranslation,
    normalizeTranslationId,
} = await import('../../translation-sync.js');

describe('translation library sync', () => {
    it('treats KJV and BSB as built-in translations', () => {
        expect(isBuiltInTranslation('KJV')).toBe(true);
        expect(isBuiltInTranslation('bsb')).toBe(true);
        expect(isBuiltInTranslation('NKJV')).toBe(false);
    });

    it('normalizes translation identifiers', () => {
        expect(normalizeTranslationId(' nrsvue ')).toBe('NRSVUE');
    });

    it('uses an available preferred translation', () => {
        expect(chooseDeviceTranslation({
            preferred: 'NKJV',
            active: 'BSB',
            available: new Set(['NKJV']),
            fallback: 'KJV',
        })).toEqual({ active: 'NKJV', pendingPreferred: null });
    });

    it('keeps an available temporary translation when the preference is missing', () => {
        expect(chooseDeviceTranslation({
            preferred: 'NKJV',
            active: 'NIV',
            available: new Set(['NIV']),
            fallback: 'KJV',
        })).toEqual({ active: 'NIV', pendingPreferred: 'NKJV' });
    });

    it('falls back to BSB when the preferred and active translations are missing', () => {
        expect(chooseDeviceTranslation({
            preferred: 'NKJV',
            active: 'NKJV',
            available: new Set(),
            fallback: 'BSB',
        })).toEqual({ active: 'BSB', pendingPreferred: 'NKJV' });
    });
});
