// @ts-check
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
                self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;

                try {
                        localStorage.setItem('syncPromptDismissedV1', '1');
                } catch (_) {}
        });
});

async function waitForApp(page) {
        await page.waitForSelector('body[data-app-ready]', { timeout: 10000 });
}

async function waitForPassage(page) {
        await waitForApp(page);
        await page.waitForFunction(
                () => {
                        const title = document.getElementById('passageTitle');
                        const loading = document.querySelector('#passageText .loading');
                        return title?.textContent?.trim().length > 0 && !loading;
                },
                { timeout: 10000 }
        );
}

async function openSettings(page) {
        const settings = page.locator('#settingsModal');
        const isOpen = await settings.evaluate(el => el.classList.contains('active'));

        if (!isOpen) {
                await page.locator('#settingsBtn').click();
        }

        await expect(settings).toBeVisible();
}

async function openAboutSection(page) {
        await openSettings(page);

        const section = page.locator('.accordion-section[data-section="about"]');
        const isActive = await section.evaluate(el => el.classList.contains('active'));

        if (!isActive) {
                await section.locator('.accordion-header').click();
        }

        await expect(section).toHaveClass(/active/);
        await expect(section.locator('.accordion-panel')).toBeVisible();
}

async function openAboutSubsection(page, sectionDataValue) {
        await openAboutSection(page);

        const section = page.locator(`.sub-accordion-section[data-section="${sectionDataValue}"]`);
        const isActive = await section.evaluate(el => el.classList.contains('active'));

        if (!isActive) {
                await section.locator('.sub-accordion-header').click();
        }

        await expect(section).toHaveClass(/active/);
}

test('about: release metadata waits until About subsections open', async ({ page }) => {
        const releaseRequests = [];

        await page.route('https://api.github.com/repos/stevenfarless/lege-lux/releases/latest', async route => {
                releaseRequests.push(route.request().url());
                await route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                                tag_name: 'v-test',
                                body: '',
                        }),
                });
        });

        await page.route('https://api.github.com/repos/stevenfarless/lege-lux/releases?per_page=10', async route => {
                releaseRequests.push(route.request().url());
                await route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify([
                                {
                                        tag_name: 'v-next',
                                        prerelease: true,
                                        body: 'Coming soon notes',
                                },
                        ]),
                });
        });

        await page.goto('/');
        await waitForPassage(page);

        expect(releaseRequests).toHaveLength(0);

        await openSettings(page);

        expect(releaseRequests).toHaveLength(0);

        await openAboutSection(page);

        await expect.poll(() => releaseRequests.length).toBe(1);
        expect(releaseRequests[0]).toContain('/releases/latest');

        await openAboutSubsection(page, 'coming-soon');

        await expect.poll(() => releaseRequests.length).toBe(2);
        expect(releaseRequests[1]).toContain('/releases?per_page=10');
});

test('about: marked loads only after Whats new opens', async ({ page }) => {
        const markedRequests = [];

        await page.route(
                'https://api.github.com/repos/stevenfarless/lege-lux/releases/latest',
                route => route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                                tag_name: 'v-test',
                                body: '**Test release notes**',
                        }),
                })
        );

        await page.route('**/marked.min.js', async route => {
                markedRequests.push(route.request().url());
                await route.fulfill({
                        status: 200,
                        contentType: 'text/javascript',
                        body: `
                                window.marked = {
                                        parse(value) {
                                                return '<strong>' + value + '</strong>';
                                        }
                                };
                        `,
                });
        });

        await page.goto('/');
        await waitForPassage(page);

        expect(markedRequests).toHaveLength(0);

        await openSettings(page);

        expect(markedRequests).toHaveLength(0);

        await openAboutSection(page);

        await expect(page.locator('#aboutVersion')).toContainText('v-test');
        expect(markedRequests).toHaveLength(0);

        await openAboutSubsection(page, 'whats-new');

        await expect.poll(() => markedRequests.length).toBe(1);
        await expect(page.locator('#whatsNewContent')).toContainText(
                'Test release notes'
        );
});
