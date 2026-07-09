// @ts-check
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
                self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;

                try {
                        localStorage.setItem('syncPromptDismissedV1', '1');
                } catch (_) { }
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

test('about: release notes sanitize rendered markdown', async ({ page }) => {
        await page.route('https://api.github.com/repos/stevenfarless/lege-lux/releases/latest', async route => {
                await route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                                tag_name: 'v-test',
                                body: [
                                        '## Test release',
                                        '<script>window.__releaseNotesXss = true</script>',
                                        '<img src=x onerror="window.__releaseNotesXss = true">',
                                        '[bad link](javascript:alert(1))',
                                        '[safe link](https://example.com)'
                                ].join('\n')
                        }),
                });
        });

        await page.route('https://api.github.com/repos/stevenfarless/lege-lux/releases?per_page=10', async route => {
                await route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify([
                                {
                                        tag_name: 'v-next',
                                        prerelease: true,
                                        body: [
                                                '## Coming soon test',
                                                '<script>window.__releaseNotesXss = true</script>',
                                                '<button onclick="window.__releaseNotesXss = true">bad</button>',
                                                '[bad link](javascript:alert(1))'
                                        ].join('\n')
                                }
                        ]),
                });
        });

        await page.route('**/marked.min.js', async route => {
                await route.fulfill({
                        status: 200,
                        contentType: 'application/javascript',
                        body: String.raw`
                                window.marked = {
                                        parse(markdown) {
                                                return markdown
                                                        .replace(/^## (.*)$/gm, '<h2>$1</h2>')
                                                        .replace(/\[bad link\]\((.*?)\)/g, '<a href="$1">bad link</a>')
                                                        .replace(/\[safe link\]\((.*?)\)/g, '<a href="$1">safe link</a>');
                                        }
                                };
                        `,
                });
        });

        await page.goto('/');
        await waitForPassage(page);

        await openAboutSubsection(page, 'whats-new');

        const whatsNewContent = page.locator('#whatsNewContent');
        await expect(whatsNewContent).toContainText('Test release');
        await expect(whatsNewContent.locator('script')).toHaveCount(0);
        await expect(whatsNewContent.locator('img')).toHaveCount(0);
        await expect(whatsNewContent.locator('[onerror]')).toHaveCount(0);
        await expect(whatsNewContent.locator('[onclick]')).toHaveCount(0);
        await expect(whatsNewContent.locator('a[href^="javascript:"]')).toHaveCount(0);
        await expect(whatsNewContent.locator('a[href^="https://example.com"]')).toHaveCount(1);

        await openAboutSubsection(page, 'coming-soon');

        const comingSoonContent = page.locator('#comingSoonContent');
        await expect(comingSoonContent).toContainText('Coming soon test');
        await expect(comingSoonContent.locator('script')).toHaveCount(0);
        await expect(comingSoonContent.locator('[onclick]')).toHaveCount(0);
        await expect(comingSoonContent.locator('a[href^="javascript:"]')).toHaveCount(0);

        await expect.poll(() => page.evaluate(() => window.__releaseNotesXss)).toBe(undefined);
});
