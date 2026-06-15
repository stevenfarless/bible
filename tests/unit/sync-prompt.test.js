import { describe, expect, it, vi } from 'vitest';
import {
    SYNC_PROMPT_DISMISSED_KEY,
    completeSyncPrompt,
    dismissSyncPrompt,
    maybeShowSyncPrompt,
    openSyncPromptLogin,
} from '../../sync-prompt.js';

function createStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: vi.fn((key) => values.get(key) ?? null),
        setItem: vi.fn((key, value) => values.set(key, String(value))),
    };
}

function createApp() {
    return {
        currentUser: null,
        syncPrompt: { hidden: true },
        loginModal: { id: 'loginModal' },
        openModal: vi.fn(),
    };
}

describe('sync sign-in prompt', () => {
    it('shows for a signed-out user without a completion flag', () => {
        const app = createApp();
        const storage = createStorage();

        expect(maybeShowSyncPrompt(app, storage)).toBe(true);
        expect(app.syncPrompt.hidden).toBe(false);
    });

    it('persists dismissal and hides the prompt', () => {
        const app = createApp();
        app.syncPrompt.hidden = false;
        const storage = createStorage();

        expect(dismissSyncPrompt(app, storage)).toBe(true);
        expect(storage.setItem).toHaveBeenCalledWith(SYNC_PROMPT_DISMISSED_KEY, '1');
        expect(app.syncPrompt.hidden).toBe(true);
    });

    it('does not show after dismissal has been stored', () => {
        const app = createApp();
        const storage = createStorage({ [SYNC_PROMPT_DISMISSED_KEY]: '1' });

        expect(maybeShowSyncPrompt(app, storage)).toBe(false);
        expect(app.syncPrompt.hidden).toBe(true);
    });

    it('completes and hides the prompt for an authenticated user', () => {
        const app = createApp();
        app.currentUser = { uid: 'user-1' };
        app.syncPrompt.hidden = false;
        const storage = createStorage();

        expect(completeSyncPrompt(app, storage)).toBe(true);
        expect(storage.setItem).toHaveBeenCalledWith(SYNC_PROMPT_DISMISSED_KEY, '1');
        expect(app.syncPrompt.hidden).toBe(true);
    });

    it('opens login without permanently dismissing the prompt', () => {
        const app = createApp();
        app.syncPrompt.hidden = false;

        expect(openSyncPromptLogin(app)).toBe(true);
        expect(app.syncPrompt.hidden).toBe(true);
        expect(app.openModal).toHaveBeenCalledWith(app.loginModal);
    });

    it('continues safely when storage is unavailable', () => {
        const app = createApp();
        app.syncPrompt.hidden = false;
        const storage = {
            getItem: () => { throw new Error('blocked'); },
            setItem: () => { throw new Error('blocked'); },
        };

        expect(() => maybeShowSyncPrompt(app, storage)).not.toThrow();
        expect(() => dismissSyncPrompt(app, storage)).not.toThrow();
        expect(app.syncPrompt.hidden).toBe(true);
    });
});
