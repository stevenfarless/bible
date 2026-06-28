#!/usr/bin/env python3
from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def replace_test_block(text, old_name, next_name, new_block):
    if new_block.split("\n", 1)[0] in text:
        return text

    start = text.find(f"test('{old_name}'")
    if start < 0:
        raise SystemExit(f"Could not find test block: {old_name}")

    end = text.find(f"\ntest('{next_name}'", start)
    if end < 0:
        raise SystemExit(f"Could not find following test block: {next_name}")

    return text[:start] + new_block + text[end:]


def patch_index():
    path = "index.html"
    text = read(path)
    if 'id="verseGoButton"' in text:
        return

    text = replace_once(
        text,
        '''            <div class="modal-body">
                <div id="verseGrid" class="chapter-grid"></div>
            </div>
''',
        '''            <div class="modal-body">
                <div class="picker-actions">
                    <button id="verseGoButton" class="primary-btn" type="button"
                        aria-label="Go to selected chapter without choosing a verse">
                        Go
                    </button>
                </div>
                <div id="verseGrid" class="chapter-grid"></div>
            </div>
''',
        "index.html verse modal body",
    )
    write(path, text)


def patch_components():
    path = "css/components.css"
    text = read(path)
    if ".picker-actions {" in text:
        return

    anchor = '''.chapter-item:hover {
    background-color: var(--primary-color);
    border-color: var(--primary-color);
    color: var(--bg-base);
    transform: scale(1.05);
}

'''
    insert = anchor + '''.picker-actions {
    display: flex;
    justify-content: flex-end;
    margin-bottom: var(--spacing-md);
}

.picker-actions .primary-btn {
    min-width: 96px;
}

'''
    text = replace_once(text, anchor, insert, "css/components.css picker actions")
    write(path, text)


def patch_ui():
    path = "ui.js"
    text = read(path)

    if '"verseGoButton",' not in text:
        text = replace_once(
            text,
            '    "verseGrid",\n',
            '    "verseGrid",\n    "verseGoButton",\n',
            "ui.js required ids",
        )

    if 'app.verseGoButton = document.getElementById("verseGoButton");' not in text:
        text = replace_once(
            text,
            '    app.verseGrid = document.getElementById("verseGrid");\n',
            (
                '    app.verseGrid = document.getElementById("verseGrid");\n'
                '    app.verseGoButton = document.getElementById("verseGoButton");\n'
            ),
            "ui.js cache verseGoButton",
        )

    write(path, text)


def patch_app():
    path = "app.js"
    text = read(path)
    if "this.referencePickerDraft = null;" in text:
        return

    text = replace_once(
        text,
        "        this._translationKbIndex = -1;\n",
        "        this._translationKbIndex = -1;\n        this.referencePickerDraft = null;\n",
        "app.js referencePickerDraft",
    )
    write(path, text)


def patch_modals():
    path = "modals.js"
    text = read(path)

    if "app.referencePickerDraft = { book, chapter: 1 };" not in text:
        text = replace_once(
            text,
            '''        button.addEventListener('click', () => {
            app.state.selectedVerse = null;
            app.loadPassage(book, 1);
            app.closeModal(app.bookModal);
        });
''',
            '''        button.addEventListener('click', () => {
            app.referencePickerDraft = { book, chapter: 1 };
            app.state.selectedVerse = null;
            app.closeModal(app.bookModal);
            app.openChapterModal();
        });
''',
            "modals.js book button",
        )

    if "const book = app.referencePickerDraft?.book || app.state.currentBook;" not in text:
        text = replace_once(
            text,
            '''    app.chapterModalBook.textContent = app.getDisplayName(app.state.currentBook);
    app.chapterGrid.innerHTML = '';

    const chapterCount = app.getChapterCount(app.state.currentBook);
''',
            '''    const book = app.referencePickerDraft?.book || app.state.currentBook;

    app.chapterModalBook.textContent = app.getDisplayName(book);
    app.chapterGrid.innerHTML = '';

    const chapterCount = app.getChapterCount(book);
''',
            "modals.js chapter draft book",
        )

    if "await app.loadPassage(book, i);" not in text:
        text = replace_once(
            text,
            '''        btn.addEventListener('click', () => {
            app.state.selectedVerse = null;
            app.loadPassage(app.state.currentBook, i);
            app.closeModal(app.chapterModal);
        });
''',
            '''        btn.addEventListener('click', async () => {
            const book = app.referencePickerDraft?.book || app.state.currentBook;

            app.referencePickerDraft = { book, chapter: i };
            app.state.selectedVerse = null;

            await app.loadPassage(book, i);

            app.closeModal(app.chapterModal);
            app.openVerseModal();
        });
''',
            "modals.js chapter button",
        )

    if "app.referencePickerDraft = null;\n            app.scrollToVerse(i);" not in text:
        text = replace_once(
            text,
            '''        btn.addEventListener('click', () => {
            app.scrollToVerse(i);
            app.closeModal(app.verseModal);
        });
''',
            '''        btn.addEventListener('click', () => {
            app.referencePickerDraft = null;
            app.scrollToVerse(i);
            app.closeModal(app.verseModal);
        });
''',
            "modals.js verse button",
        )

    write(path, text)


def patch_events():
    path = "events.js"
    text = read(path)

    if "app.bookSelector?.addEventListener('click', () => {" not in text:
        text = replace_once(
            text,
            '''    app.bookSelector?.addEventListener('click', () => app.openBookModal());
    app.chapterSelector?.addEventListener('click', () => app.openChapterModal());
    app.verseSelector?.addEventListener('click', () => app.openVerseModal());
''',
            '''    app.bookSelector?.addEventListener('click', () => {
        app.referencePickerDraft = null;
        app.openBookModal();
    });
    app.chapterSelector?.addEventListener('click', () => {
        app.referencePickerDraft = null;
        app.openChapterModal();
    });
    app.verseSelector?.addEventListener('click', () => {
        app.referencePickerDraft = null;
        app.openVerseModal();
    });
''',
            "events.js direct picker listeners",
        )

    if "app.verseGoButton?.addEventListener" not in text:
        anchor = "    app.closeVerseModal?.addEventListener('click', () => app.closeModal(app.verseModal));\n"
        text = replace_once(
            text,
            anchor,
            anchor + '''    app.verseGoButton?.addEventListener('click', () => {
        app.referencePickerDraft = null;
        app.closeModal(app.verseModal);
    });
''',
            "events.js verse Go listener",
        )

    write(path, text)


def patch_tests():
    path = "tests/smoke.spec.js"
    text = read(path)

    book_flow_test = '''test('reference picker: book, chapter, verse flow supports verse and Go', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#bookSelector').click();
        await expect(page.locator('#bookModal')).toBeVisible();

        await page.locator('#newTestamentBooks button', { hasText: 'John' }).first().click();

        await expect(page.locator('#bookModal')).not.toHaveClass(/active/);
        await expect(page.locator('#chapterModal')).toBeVisible();
        await expect(page.locator('#chapterModalBook')).toHaveText('John');

        await page.locator('#chapterGrid button', { hasText: '3' }).first().click();

        await expect(page.locator('#chapterModal')).not.toHaveClass(/active/);
        await expect(page.locator('#passageTitle')).toContainText('John 3');
        await expect(page.locator('#passageText')).not.toBeEmpty();
        await expect(page.locator('#verseModal')).toBeVisible();

        await page.locator('#verseGrid button', { hasText: '16' }).first().click();

        await expect(page.locator('#verseModal')).not.toHaveClass(/active/);
        await expect(page.locator('#currentVerse')).toHaveText('16');

        await page.locator('#bookSelector').click();
        await page.locator('#newTestamentBooks button', { hasText: 'Matt' }).first().click();
        await page.locator('#chapterGrid button', { hasText: '2' }).first().click();

        await expect(page.locator('#passageTitle')).toContainText('Matthew 2');
        await expect(page.locator('#verseModal')).toBeVisible();

        await page.locator('#verseGoButton').click();

        await expect(page.locator('#verseModal')).not.toHaveClass(/active/);
        await expect(page.locator('#passageTitle')).toContainText('Matthew 2');
        await expect(page.locator('#currentVerse')).toHaveText('1');
});
'''
    text = replace_test_block(
        text,
        "book navigation: selecting a book loads its first chapter",
        "book selector: testament filters",
        book_flow_test,
    )

    chapter_flow_test = '''test('chapter navigation: selecting a chapter opens verse picker and Go keeps chapter', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#chapterSelector').click();
        await expect(page.locator('#chapterModal')).toBeVisible();
        await page.locator('#chapterGrid button', { hasText: '2' }).first().click();

        await expect(page.locator('#chapterModal')).not.toHaveClass(/active/);
        await expect(page.locator('#passageTitle')).toContainText('Genesis 2');
        await expect(page.locator('#passageText')).not.toBeEmpty();
        await expect(page.locator('#verseModal')).toBeVisible();

        await page.locator('#verseGoButton').click();

        await expect(page.locator('#verseModal')).not.toHaveClass(/active/);
        await expect(page.locator('#passageTitle')).toContainText('Genesis 2');
});
'''
    text = replace_test_block(
        text,
        "chapter navigation: selecting a chapter loads passage text",
        "verse navigation: selecting a verse closes the verse modal",
        chapter_flow_test,
    )

    old_cache_steps = '''        await page.locator('#chapterSelector').click();
        await page.locator('#chapterGrid button', { hasText: '2' }).first().click();
        await waitForPassage(page);

        await page.locator('#chapterSelector').click();
        await page.locator('#chapterGrid button', { hasText: '1' }).first().click();
        await waitForPassage(page);
'''
    new_cache_steps = '''        await page.locator('#chapterSelector').click();
        await page.locator('#chapterGrid button', { hasText: '2' }).first().click();
        await expect(page.locator('#verseModal')).toBeVisible();
        await page.locator('#verseGoButton').click();
        await waitForPassage(page);

        await page.locator('#chapterSelector').click();
        await page.locator('#chapterGrid button', { hasText: '1' }).first().click();
        await expect(page.locator('#verseModal')).toBeVisible();
        await page.locator('#verseGoButton').click();
        await waitForPassage(page);
'''
    if new_cache_steps not in text:
        text = replace_once(
            text,
            old_cache_steps,
            new_cache_steps,
            "tests/smoke.spec.js passage cache picker flow",
        )

    write(path, text)


def main():
    patch_index()
    patch_components()
    patch_ui()
    patch_app()
    patch_modals()
    patch_events()
    patch_tests()


if __name__ == "__main__":
    main()
