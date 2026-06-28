#!/usr/bin/env python3
from pathlib import Path

SETTINGS_PATH = Path("settings.js")
ABOUT_TEST_PATH = Path("tests/about-release.spec.js")


def read(path):
    return path.read_text(encoding="utf-8")


def write(path, text):
    path.write_text(text, encoding="utf-8")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def patch_settings_js():
    text = read(SETTINGS_PATH)

    if "function sanitizeReleaseNotesHtml(html)" not in text:
        text = replace_once(
            text,
            "\nfunction ensureRecaptchaBadgeHidden() {",
            """
const RELEASE_NOTES_ALLOWED_TAGS = new Set([
    'A',
    'BLOCKQUOTE',
    'BR',
    'CODE',
    'EM',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'HR',
    'LI',
    'OL',
    'P',
    'PRE',
    'STRONG',
    'UL',
]);

const RELEASE_NOTES_DANGEROUS_TAGS = new Set([
    'SCRIPT',
    'STYLE',
    'IFRAME',
    'OBJECT',
    'EMBED',
    'SVG',
    'MATH',
    'LINK',
    'META',
]);

function isSafeReleaseNoteUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return false;

    try {
        const url = new URL(raw, window.location.origin);
        return url.protocol === 'http:'
            || url.protocol === 'https:'
            || url.protocol === 'mailto:';
    } catch (_) {
        return false;
    }
}

function sanitizeReleaseNotesHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html ?? '');

    const cleanNode = (node) => {
        for (const child of Array.from(node.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) continue;

            if (child.nodeType !== Node.ELEMENT_NODE) {
                child.remove();
                continue;
            }

            const tag = child.tagName.toUpperCase();

            if (RELEASE_NOTES_DANGEROUS_TAGS.has(tag)) {
                child.remove();
                continue;
            }

            if (!RELEASE_NOTES_ALLOWED_TAGS.has(tag)) {
                child.replaceWith(document.createTextNode(child.textContent || ''));
                continue;
            }

            const href = child.getAttribute('href');
            const title = child.getAttribute('title');

            for (const attr of Array.from(child.attributes)) {
                child.removeAttribute(attr.name);
            }

            if (tag === 'A') {
                if (isSafeReleaseNoteUrl(href)) {
                    child.setAttribute('href', new URL(href, window.location.origin).href);
                    child.setAttribute('target', '_blank');
                    child.setAttribute('rel', 'noopener noreferrer');
                }

                if (title) {
                    child.setAttribute('title', title);
                }
            }

            cleanNode(child);
        }
    };

    cleanNode(template.content);
    return template.innerHTML;
}

function renderReleaseNotesMarkdown(marked, body) {
    return sanitizeReleaseNotesHtml(marked.parse(String(body ?? '')));
}

function ensureRecaptchaBadgeHidden() {""",
            "settings.js release notes sanitizer insertion",
        )

    text = replace_once(
        text,
        "contentEl.innerHTML = marked.parse(release.body);",
        "contentEl.innerHTML = renderReleaseNotesMarkdown(marked, release.body);",
        "settings.js What’s new markdown rendering",
    ) if "contentEl.innerHTML = marked.parse(release.body);" in text else text

    text = replace_once(
        text,
        "el.innerHTML = marked.parse(pre.body);",
        "el.innerHTML = renderReleaseNotesMarkdown(marked, pre.body);",
        "settings.js Coming soon markdown rendering",
    ) if "el.innerHTML = marked.parse(pre.body);" in text else text

    write(SETTINGS_PATH, text)


def patch_about_release_test():
    text = read(ABOUT_TEST_PATH)
    if "about: release notes sanitize rendered markdown" in text:
        return

    text = text.rstrip() + r"""

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
"""

    write(ABOUT_TEST_PATH, text.rstrip() + "\n")


def main():
    patch_settings_js()
    patch_about_release_test()


if __name__ == "__main__":
    main()
