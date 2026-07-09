// @ts-check
import { test, expect } from '@playwright/test';

const testEmail = process.env.TEST_USER_EMAIL;
const testPassword = process.env.TEST_USER_PASSWORD;

test.use({
        trace: 'off',
        screenshot: 'off',
        video: 'off',
});

test('auth restoration: delayed remote font size cannot overwrite a newer local value', async ({ page }) => {
        test.skip(
                !testEmail || !testPassword,
                'TEST_USER_EMAIL and TEST_USER_PASSWORD are required'
        );

        await page.goto('/');
        await page.waitForSelector('body[data-app-ready]', { timeout: 10000 });
        await page.waitForFunction(
                () => window._bibleApp?.authStateResolved === true,
                null,
                { timeout: 10000 }
        );

        await page.evaluate(
                async ({ email, password }) => {
                        const app = window._bibleApp;
                        await app.ensureInteractiveAuth();
                        await app.auth.signInWithEmailAndPassword(email, password);
                },
                { email: testEmail, password: testPassword }
        );

        await page.waitForFunction(
                () => Boolean(
                        window._bibleApp?.currentUser &&
                        window._bibleApp?.database
                ),
                null,
                { timeout: 15000 }
        );

        const result = await page.evaluate(async () => {
                const app = window._bibleApp;
                const uid = app.currentUser.uid;
                const fontPath = `users/${uid}/settings/fontSize`;
                const userPath = `users/${uid}`;
                const originalRef = app.database.ref.bind(app.database);
                const fontRef = originalRef(fontPath);
                const originalSnapshot = await fontRef.once('value');
                const originalFontSize = originalSnapshot.val();

                let releaseSnapshot;
                let snapshotCaptured = false;
                const snapshotGate = new Promise((resolve) => {
                        releaseSnapshot = resolve;
                });

                try {
                        await fontRef.set(18);
                        app.state.fontSize = 18;
                        localStorage.setItem('fontSize', '18');
                        app.applySettings();

                        app.database.ref = (path) => {
                                const ref = originalRef(path);
                                if (path !== userPath) return ref;

                                return {
                                        ...ref,
                                        once: async (...args) => {
                                                const snapshot = await ref.once(...args);
                                                snapshotCaptured = true;
                                                await snapshotGate;
                                                return snapshot;
                                        },
                                };
                        };

                        const restoration = app.loadUserData();

                        while (!snapshotCaptured) {
                                await new Promise((resolve) => setTimeout(resolve, 0));
                        }

                        await app.updateFontSize(24);
                        releaseSnapshot();
                        await restoration;

                        return {
                                stateFontSize: app.state.fontSize,
                                storedFontSize: localStorage.getItem('fontSize'),
                                computedFontSize: getComputedStyle(app.passageText).fontSize,
                        };
                } finally {
                        app.database.ref = originalRef;
                        if (originalFontSize == null) {
                                await fontRef.set(null);
                        } else {
                                await fontRef.set(originalFontSize);
                        }
                }
        });

        expect(result).toEqual({
                stateFontSize: 24,
                storedFontSize: '24',
                computedFontSize: '24px',
        });
});
