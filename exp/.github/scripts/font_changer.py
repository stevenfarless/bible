from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def path(name):
    return ROOT / name


def read(name):
    return path(name).read_text(encoding='utf-8')


def write(name, content):
    path(name).write_text(content, encoding='utf-8')


def replace_once(content, old, new, file_name, description):
    if old in content:
        return content.replace(old, new, 1)

    if new in content:
        return content

    raise SystemExit(f'{file_name}: could not find {description}')


def replace_any_once(content, old_values, new, file_name, description):
    for old in old_values:
        if old in content:
            return content.replace(old, new, 1)

    if new in content:
        return content

    raise SystemExit(f'{file_name}: could not find {description}')


def insert_before_once(content, marker, addition, file_name, description):
    if addition.strip() in content:
        return content

    if marker not in content:
        raise SystemExit(f'{file_name}: could not find insertion point for {description}')

    return content.replace(marker, addition + marker, 1)


FONT_SIZE_STEPPER_HTML = '''\t\t\t\t\t\t\t<div class="setting-item">
\t\t\t\t\t\t\t\t<label id="fontSizeLabel">Font Size</label>
\t\t\t\t\t\t\t\t<div class="font-size-stepper" role="group" aria-labelledby="fontSizeLabel">
\t\t\t\t\t\t\t\t\t<button type="button" id="fontSizeDecrease" class="font-size-stepper__button font-size-stepper__button--decrease" aria-label="Decrease font size">
\t\t\t\t\t\t\t\t\t\t<span class="font-size-stepper__glyph" aria-hidden="true">Aa−</span>
\t\t\t\t\t\t\t\t\t</button>

\t\t\t\t\t\t\t\t\t<output id="fontSizeValue" class="font-size-stepper__value" for="fontSizeDecrease fontSizeIncrease" aria-live="polite" aria-label="20 pixels">20</output>

\t\t\t\t\t\t\t\t\t<button type="button" id="fontSizeIncrease" class="font-size-stepper__button font-size-stepper__button--increase" aria-label="Increase font size">
\t\t\t\t\t\t\t\t\t\t<span class="font-size-stepper__glyph" aria-hidden="true">Aa+</span>
\t\t\t\t\t\t\t\t\t</button>
\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t</div>'''


FONT_SIZE_STEPPER_CSS = '''.font-size-stepper {
    display: grid;
    grid-template-columns: 1fr 0.85fr 1fr;
    width: min(100%, 22rem);
    min-inline-size: 0;
    margin: 0;
    padding: 4px;
    border: 1px solid var(--border-neutral);
    border-radius: 999px;
    background-color: var(--bg-raised);
    transition:
        background-color var(--transition-fast),
        border-color var(--transition-fast);
}

.font-size-stepper__button,
.font-size-stepper__value {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    margin: 0;
    padding: 0 var(--spacing-md);
    border-radius: 999px;
    font-family: var(--font-sans);
    line-height: 1;
    text-align: center;
}

.font-size-stepper__button {
    border: 0;
    background: transparent;
    color: var(--text-muted);
    font-weight: 600;
    cursor: pointer;
    user-select: none;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    transition:
        color var(--transition-fast),
        background-color var(--transition-fast),
        opacity var(--transition-fast);
}

.font-size-stepper__button:hover:not(:disabled) {
    color: var(--primary-color);
}

.font-size-stepper__button:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
}

.font-size-stepper__button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
}

.font-size-stepper__button--decrease .font-size-stepper__glyph {
    font-size: 0.82rem;
}

.font-size-stepper__button--increase .font-size-stepper__glyph {
    font-size: 1.05rem;
}

.font-size-stepper__value {
    background-color: var(--bg-card);
    color: var(--text-heading);
    box-shadow: var(--shadow-sm);
    font-size: 0.95rem;
    font-weight: 700;
    transition:
        background-color var(--transition-fast),
        color var(--transition-fast),
        box-shadow var(--transition-fast);
}

@media (prefers-reduced-motion: reduce) {

    .font-size-stepper,
    .font-size-stepper__button,
    .font-size-stepper__value {
        transition: none;
    }
}

'''


FONT_SIZE_HELPERS = '''const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 32;

function clampFontSize(size) {
    const parsed = parseInt(size, 10);
    if (!Number.isFinite(parsed)) return DEFAULTS.fontSize;

    return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, parsed));
}

function syncFontSizeControls(app, fontSize) {
    const value = String(fontSize);

    if (app.fontSizeValue) {
        app.fontSizeValue.textContent = value;
        app.fontSizeValue.setAttribute('aria-label', `${value} pixels`);
    }

    if (app.fontSizeDecrease) {
        app.fontSizeDecrease.disabled = fontSize <= FONT_SIZE_MIN;
    }

    if (app.fontSizeIncrease) {
        app.fontSizeIncrease.disabled = fontSize >= FONT_SIZE_MAX;
    }
}

'''


def update_index():
    file_name = 'index.html'
    content = read(file_name)
    old = '''\t\t\t\t\t\t\t<div class="setting-item">
\t\t\t\t\t\t\t\t<label for="fontSizeSlider">Font Size</label>
\t\t\t\t\t\t\t\t<input type="range" id="fontSizeSlider" class="slider" min="12" max="32" value="18" />
\t\t\t\t\t\t\t\t<span id="fontSizeValue">18px</span>
\t\t\t\t\t\t\t</div>'''
    content = replace_once(content, old, FONT_SIZE_STEPPER_HTML, file_name, 'font size slider markup')
    write(file_name, content)


def update_components_css():
    file_name = 'css/components.css'
    content = read(file_name)
    content = insert_before_once(
        content,
        '/* Toast Notifications */',
        FONT_SIZE_STEPPER_CSS,
        file_name,
        'font size stepper CSS',
    )
    write(file_name, content)


def update_ui_js():
    file_name = 'ui.js'
    content = read(file_name)
    content = replace_once(
        content,
        "\t'fontSizeSlider', 'fontSizeValue',",
        "\t'fontSizeDecrease', 'fontSizeValue', 'fontSizeIncrease',",
        file_name,
        'font size required IDs',
    )
    content = replace_once(
        content,
        "\tapp.fontSizeSlider = document.getElementById('fontSizeSlider');\n\tapp.fontSizeValue = document.getElementById('fontSizeValue');",
        "\tapp.fontSizeDecrease = document.getElementById('fontSizeDecrease');\n\tapp.fontSizeValue = document.getElementById('fontSizeValue');\n\tapp.fontSizeIncrease = document.getElementById('fontSizeIncrease');",
        file_name,
        'font size cached elements',
    )
    write(file_name, content)


def update_settings_js():
    file_name = 'settings.js'
    content = read(file_name)
    content = insert_before_once(
        content,
        'const READING_FONT_FAMILIES = {',
        FONT_SIZE_HELPERS,
        file_name,
        'font size helpers',
    )
    content = replace_any_once(
        content,
        [
            "    const fontSize = app.state.fontSize || DEFAULTS.fontSize;\n    if (app.fontSizeSlider) app.fontSizeSlider.value = fontSize;\n    if (app.fontSizeValue) app.fontSizeValue.textContent = `${fontSize}px`;\n    if (app.passageText) app.passageText.style.fontSize = `${fontSize}px`;",
            "    const fontSize = app.state.fontSize || DEFAULTS.fontSize;\n    if (app.fontSizeSlider) app.fontSizeSlider.value = fontSize;\n    if (app.fontSizeValue)  app.fontSizeValue.textContent = `${fontSize}px`;\n    if (app.passageText)    app.passageText.style.fontSize = `${fontSize}px`;",
        ],
        "    const fontSize = clampFontSize(app.state.fontSize || DEFAULTS.fontSize);\n    app.state.fontSize = fontSize;\n    syncFontSizeControls(app, fontSize);\n    if (app.passageText) app.passageText.style.fontSize = `${fontSize}px`;",
        file_name,
        'applySettings font size sync',
    )
    content = replace_once(
        content,
        "export async function updateFontSize(app, size) {\n    app.state.fontSize = parseInt(size, 10);\n    app.fontSizeValue.textContent = `${size}px`;\n    app.passageText.style.fontSize = `${size}px`;\n\n    lsSet('fontSize', size);\n\n    if (app.canWriteRemoteState()) {\n        await app.database\n            .ref(`users/${app.currentUser.uid}/settings/fontSize`)\n            .set(parseInt(size, 10));\n    }\n}",
        "export async function updateFontSize(app, size) {\n    const fontSize = clampFontSize(size);\n\n    app.state.fontSize = fontSize;\n    syncFontSizeControls(app, fontSize);\n\n    if (app.passageText) {\n        app.passageText.style.fontSize = `${fontSize}px`;\n    }\n\n    lsSet('fontSize', fontSize);\n\n    if (app.canWriteRemoteState()) {\n        await app.database\n            .ref(`users/${app.currentUser.uid}/settings/fontSize`)\n            .set(fontSize);\n    }\n}",
        file_name,
        'updateFontSize implementation',
    )
    write(file_name, content)


def update_events_js():
    file_name = 'events.js'
    content = read(file_name)
    content = replace_once(
        content,
        "    app.fontSizeSlider?.addEventListener('input', (e) => app.updateFontSize(e.target.value));",
        "    app.fontSizeDecrease?.addEventListener('click', () => {\n        void app.updateFontSize((app.state.fontSize || 20) - 1);\n    });\n\n    app.fontSizeIncrease?.addEventListener('click', () => {\n        void app.updateFontSize((app.state.fontSize || 20) + 1);\n    });",
        file_name,
        'font size event listeners',
    )
    write(file_name, content)


def update_smoke_test():
    file_name = 'tests/smoke.spec.js'
    content = read(file_name)
    old = """test('settings: font size change updates passage font size', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);
        await openSettingsSection(page, 'appearance');

        await page.locator('#fontSizeSlider').fill('24');
        await expect(page.locator('#passageText')).toHaveCSS('font-size', '24px');
});"""
    new = """test('settings: font size buttons update passage font size', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);
        await openSettingsSection(page, 'appearance');

        await page.evaluate(() => {
                window._bibleApp.state.fontSize = 22;
                localStorage.setItem('fontSize', '22');
                window._bibleApp.applySettings();
        });

        await expect(page.locator('#fontSizeValue')).toHaveText('22');

        await page.locator('#fontSizeIncrease').click();

        await expect(page.locator('#fontSizeValue')).toHaveText('23');
        await expect(page.locator('#passageText')).toHaveCSS('font-size', '23px');
        await expect.poll(() => page.evaluate(() => localStorage.getItem('fontSize'))).toBe('23');

        await page.locator('#fontSizeDecrease').click();

        await expect(page.locator('#fontSizeValue')).toHaveText('22');
        await expect(page.locator('#passageText')).toHaveCSS('font-size', '22px');
        await expect.poll(() => page.evaluate(() => localStorage.getItem('fontSize'))).toBe('22');
});"""
    content = replace_once(content, old, new, file_name, 'font size smoke test')
    write(file_name, content)


def main():
    update_index()
    update_components_css()
    update_ui_js()
    update_settings_js()
    update_events_js()
    update_smoke_test()


if __name__ == '__main__':
    main()
