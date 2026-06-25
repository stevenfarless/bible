from pathlib import Path


def replace_once(path, old, new, description):
    text = path.read_text()
    if old not in text:
        return text, False
    return text.replace(old, new, 1), True


def require(condition, message):
    if not condition:
        raise SystemExit(message)


def update_index():
    path = Path('index.html')
    text = path.read_text()
    old = """\t<link rel=\"preload\" href=\"css/geek95.css\" as=\"style\" onload=\"this.onload=null;this.rel='stylesheet'\">\n\t<noscript><link rel=\"stylesheet\" href=\"css/geek95.css\"></noscript>\n"""

    if old in text:
        text = text.replace(old, '', 1)
        path.write_text(text)
    elif 'rel="preload" href="css/geek95.css"' in text or '<noscript><link rel="stylesheet" href="css/geek95.css"' in text:
        raise SystemExit('Unexpected Geek95 stylesheet markup in index.html.')
    else:
        print('Geek95 stylesheet is already absent from startup markup.')


def update_prepaint_settings():
    path = Path('prepaint-settings.js')
    text = path.read_text()

    if "var GEEK_THEME_CSS_ID = 'geek-theme-css';" not in text:
        old = "    var OPTIONAL_FONT_CSS_ID = 'optional-font-faces';\n"
        new = old + "    var GEEK_THEME_CSS_ID = 'geek-theme-css';\n"
        require(old in text, 'Could not find OPTIONAL_FONT_CSS_ID in prepaint-settings.js.')
        text = text.replace(old, new, 1)

    if 'function ensureGeekThemeCss()' not in text:
        old = """    function ensureOptionalFontFaces() {\n        if (document.getElementById(OPTIONAL_FONT_CSS_ID)) return;\n\n        var link = document.createElement('link');\n        link.id = OPTIONAL_FONT_CSS_ID;\n        link.rel = 'stylesheet';\n        link.href = './css/optional-fonts.css';\n        document.head.appendChild(link);\n    }\n"""
        new = old + """\n    function ensureGeekThemeCss() {\n        if (document.getElementById(GEEK_THEME_CSS_ID)) return;\n\n        var link = document.createElement('link');\n        link.id = GEEK_THEME_CSS_ID;\n        link.rel = 'stylesheet';\n        link.href = './css/geek95.css';\n        document.head.appendChild(link);\n    }\n"""
        require(old in text, 'Could not find ensureOptionalFontFaces block in prepaint-settings.js.')
        text = text.replace(old, new, 1)

    if "if (theme === 'geek') ensureGeekThemeCss();" not in text:
        old = """        if (!VALID_THEMES[theme]) theme = DEFAULT_COLOR_THEME;\n\n        root.classList.remove.apply(root.classList, THEME_CLASSES);\n"""
        new = """        if (!VALID_THEMES[theme]) theme = DEFAULT_COLOR_THEME;\n        if (theme === 'geek') ensureGeekThemeCss();\n\n        root.classList.remove.apply(root.classList, THEME_CLASSES);\n"""
        require(old in text, 'Could not find startup theme resolution in prepaint-settings.js.')
        text = text.replace(old, new, 1)

    path.write_text(text)


def update_ui():
    path = Path('ui.js')
    text = path.read_text()

    if "const GEEK_THEME_CSS_ID = 'geek-theme-css';" not in text:
        old = """document.addEventListener('DOMContentLoaded', () => {\n\tconst htmlClasses = [...document.documentElement.classList];\n\tif (htmlClasses.length) document.body.classList.add(...htmlClasses);\n\n\trequestAnimationFrame(() => {\n\t\tdocument.documentElement.classList.remove('no-color-transition');\n\t\tdocument.body.classList.remove('no-color-transition');\n\t});\n}, { once: true });\n"""
        new = old + """\nconst GEEK_THEME_CSS_ID = 'geek-theme-css';\n\nfunction ensureGeekThemeCss() {\n\tif (document.getElementById(GEEK_THEME_CSS_ID)) return;\n\n\tconst link = document.createElement('link');\n\tlink.id = GEEK_THEME_CSS_ID;\n\tlink.rel = 'stylesheet';\n\tlink.href = './css/geek95.css';\n\tdocument.head.appendChild(link);\n}\n"""
        require(old in text, 'Could not find DOMContentLoaded theme mirror block in ui.js.')
        text = text.replace(old, new, 1)

    if "if (resolved === 'geek') ensureGeekThemeCss();" not in text:
        old = """\tconst valid = ALL_THEME_CLASSES.includes(theme + '-theme');\n\tconst resolved = valid ? theme : 'basic';\n\tconst cls = resolved + '-theme';\n\n\tdocument.documentElement.classList.add(cls);\n"""
        new = """\tconst valid = ALL_THEME_CLASSES.includes(theme + '-theme');\n\tconst resolved = valid ? theme : 'basic';\n\tconst cls = resolved + '-theme';\n\tif (resolved === 'geek') ensureGeekThemeCss();\n\n\tdocument.documentElement.classList.add(cls);\n"""
        require(old in text, 'Could not find resolved theme block in ui.js.')
        text = text.replace(old, new, 1)

    path.write_text(text)


def update_service_worker():
    path = Path('sw.js')
    text = path.read_text()

    if "'./css/geek95.css'," not in text:
        old = "  './css/pericope.css',\n  './app.js',\n"
        new = "  './css/pericope.css',\n  './css/geek95.css',\n  './app.js',\n"
        require(old in text, 'Could not find CSS app shell boundary in sw.js.')
        text = text.replace(old, new, 1)
        path.write_text(text)
    else:
        print('Geek95 stylesheet is already in the service-worker app shell.')


def update_playwright_config():
    path = Path('playwright.config.js')
    text = path.read_text()

    if "'**/tests/geek95-lazy-load.spec.js'" not in text:
        old = """\t\t'**/tests/smoke.spec.js',\n\t\t'**/tests/about-release.spec.js',\n"""
        new = """\t\t'**/tests/smoke.spec.js',\n\t\t'**/tests/about-release.spec.js',\n\t\t'**/tests/geek95-lazy-load.spec.js',\n"""
        require(old in text, 'Could not find Playwright testMatch entries.')
        text = text.replace(old, new, 1)
        path.write_text(text)


def write_tests():
    path = Path('tests/geek95-lazy-load.spec.js')
    content = """// @ts-check\nimport { test, expect } from '@playwright/test';\n\ntest.beforeEach(async ({ page }) => {\n\tawait page.addInitScript(() => {\n\t\tself.FIREBASE_APPCHECK_DEBUG_TOKEN = true;\n\n\t\ttry {\n\t\t\tlocalStorage.setItem('syncPromptDismissedV1', '1');\n\t\t} catch (_) {}\n\t});\n});\n\nasync function waitForApp(page) {\n\tawait page.waitForSelector('body[data-app-ready]', { timeout: 10000 });\n}\n\nasync function waitForPassage(page) {\n\tawait waitForApp(page);\n\tawait page.waitForFunction(\n\t\t() => {\n\t\t\tconst title = document.getElementById('passageTitle');\n\t\t\tconst loading = document.querySelector('#passageText .loading');\n\t\t\treturn title?.textContent?.trim().length > 0 && !loading;\n\t\t},\n\t\t{ timeout: 10000 }\n\t);\n}\n\ntest('startup: Vespers does not load Geek95 CSS', async ({ page }) => {\n\tconst geekRequests = [];\n\n\tawait page.addInitScript(() => {\n\t\ttry { localStorage.setItem('colorTheme', 'vespers'); } catch (_) {}\n\t});\n\n\tawait page.route('**/css/geek95.css*', route => {\n\t\tgeekRequests.push(route.request().url());\n\t\treturn route.continue();\n\t});\n\n\tawait page.goto('/');\n\tawait waitForPassage(page);\n\tawait page.waitForTimeout(100);\n\n\texpect(geekRequests).toHaveLength(0);\n});\n\ntest('startup: restored Geek theme loads Geek95 CSS', async ({ page }) => {\n\tconst geekRequests = [];\n\n\tawait page.addInitScript(() => {\n\t\ttry { localStorage.setItem('colorTheme', 'geek'); } catch (_) {}\n\t});\n\n\tawait page.route('**/css/geek95.css*', route => {\n\t\tgeekRequests.push(route.request().url());\n\t\treturn route.continue();\n\t});\n\n\tawait page.goto('/');\n\tawait waitForPassage(page);\n\n\tawait expect.poll(() => geekRequests.length).toBe(1);\n});\n"""
    path.write_text(content)


update_index()
update_prepaint_settings()
update_ui()
update_service_worker()
update_playwright_config()
write_tests()
