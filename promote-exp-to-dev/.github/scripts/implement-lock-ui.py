#!/usr/bin/env python3
"""Apply issue 401 interface visibility setting changes."""
import re
from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


def replace_once(path, old, new):
    text = read(path)
    if new in text:
        return False
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one anchor, found {count}: {old!r}")
    write(path, text.replace(old, new, 1))
    return True


def main():
    replace_once(
        "reading-state.js",
        "        verseByVerse: false,\n        colorTheme: 'vespers',",
        "        verseByVerse: false,\n        hideInterfaceOnScroll: true,\n        colorTheme: 'vespers',",
    )

    index = read("index.html")
    if 'id="hideInterfaceOnScrollToggle"' not in index:
        insert = """
							<div class="setting-item">
								<label class="checkbox-label">
									<input type="checkbox" id="hideInterfaceOnScrollToggle" checked />
									<span>Hide interface while scrolling</span>
								</label>
								<small class="help-text">Turn off to keep the top controls visible while reading.</small>
							</div>"""
        pattern = re.compile(
            r'(\n[ \t]*<div class="setting-item">\n'
            r'[ \t]*<label class="checkbox-label">\n'
            r'[ \t]*<input type="checkbox" id="chapterArrowsToggle" />\n'
            r'[ \t]*<span>Show chapter arrows</span>\n'
            r'[ \t]*</label>\n'
            r'[ \t]*</div>)'
        )
        index, count = pattern.subn(lambda match: match.group(1) + insert, index, count=1)
        if count != 1:
            raise SystemExit("index.html: could not locate chapter arrows setting")
        write("index.html", index)

    replace_once(
        "ui.js",
        "'crossReferencesToggle', 'verseByVerseToggle', 'chapterArrowsToggle', 'hapticsToggle',",
        "'crossReferencesToggle', 'verseByVerseToggle', 'chapterArrowsToggle', 'hideInterfaceOnScrollToggle', 'hapticsToggle',",
    )
    replace_once(
        "ui.js",
        "\tapp.chapterArrowsToggle = document.getElementById('chapterArrowsToggle');\n\tapp.hapticsToggle = document.getElementById('hapticsToggle');",
        "\tapp.chapterArrowsToggle = document.getElementById('chapterArrowsToggle');\n\tapp.hideInterfaceOnScrollToggle = document.getElementById('hideInterfaceOnScrollToggle');\n\tapp.hapticsToggle = document.getElementById('hapticsToggle');",
    )

    replace_once(
        "settings.js",
        "    showChapterArrows:   false,\n    hapticsEnabled:      true,",
        "    showChapterArrows:   false,\n    hideInterfaceOnScroll: true,\n    hapticsEnabled:      true,",
    )
    replace_once(
        "settings.js",
        "    app.state.showChapterArrows   = readBool('showChapterArrows',   DEFAULTS.showChapterArrows);\n    app.state.hapticsEnabled      = readBool('hapticsEnabled',      DEFAULTS.hapticsEnabled);",
        "    app.state.showChapterArrows      = readBool('showChapterArrows',      DEFAULTS.showChapterArrows);\n    app.state.hideInterfaceOnScroll  = readBool('hideInterfaceOnScroll',  DEFAULTS.hideInterfaceOnScroll);\n    app.state.hapticsEnabled         = readBool('hapticsEnabled',         DEFAULTS.hapticsEnabled);",
    )
    replace_once(
        "settings.js",
        "    if (app.chapterArrowsToggle)   app.chapterArrowsToggle.checked   = !!app.state.showChapterArrows;\n    if (app.hapticsToggle)        app.hapticsToggle.checked        = !!app.state.hapticsEnabled;",
        "    if (app.chapterArrowsToggle) app.chapterArrowsToggle.checked = !!app.state.showChapterArrows;\n    if (app.hideInterfaceOnScrollToggle) app.hideInterfaceOnScrollToggle.checked = !!app.state.hideInterfaceOnScroll;\n    if (app.hapticsToggle) app.hapticsToggle.checked = !!app.state.hapticsEnabled;",
    )
    replace_once(
        "settings.js",
        "    showChapterArrows: 'chapterArrowsToggle',\n    hapticsEnabled:    'hapticsToggle',",
        "    showChapterArrows: 'chapterArrowsToggle',\n    hideInterfaceOnScroll: 'hideInterfaceOnScrollToggle',\n    hapticsEnabled:    'hapticsToggle',",
    )
    replace_once(
        "settings.js",
        "    if (setting === 'showChapterArrows') {\n        document.body.classList.toggle('hide-chapter-arrows', !app.state.showChapterArrows);\n        return;\n    }\n}",
        "    if (setting === 'showChapterArrows') {\n        document.body.classList.toggle('hide-chapter-arrows', !app.state.showChapterArrows);\n        return;\n    }\n\n    if (setting === 'hideInterfaceOnScroll') {\n        if (!app.state.hideInterfaceOnScroll) {\n            app.showChrome?.();\n            app.chromeScrollAnchorY = window.scrollY || window.pageYOffset || 0;\n            app.chromeLastY = app.chromeScrollAnchorY;\n            app.chromeLastDirection = null;\n        }\n        return;\n    }\n}",
    )

    replace_once(
        "events.js",
        "    app.chapterArrowsToggle?.addEventListener('change', () => app.toggleSetting('showChapterArrows'));\n    app.hapticsToggle?.addEventListener('change', () => app.toggleSetting('hapticsEnabled'));",
        "    app.chapterArrowsToggle?.addEventListener('change', () => app.toggleSetting('showChapterArrows'));\n    app.hideInterfaceOnScrollToggle?.addEventListener('change', () => app.toggleSetting('hideInterfaceOnScroll'));\n    app.hapticsToggle?.addEventListener('change', () => app.toggleSetting('hapticsEnabled'));",
    )

    replace_once(
        "app.js",
        "        'showFootnotes', 'showCrossReferences', 'verseByVerse',\n        'showChapterArrows', 'hapticsEnabled',",
        "        'showFootnotes', 'showCrossReferences', 'verseByVerse',\n        'showChapterArrows', 'hideInterfaceOnScroll', 'hapticsEnabled',",
    )
    replace_once(
        "app.js",
        "        showChapterArrows:   app?.state?.showChapterArrows,\n        scrollY:             window.scrollY,",
        "        showChapterArrows:   app?.state?.showChapterArrows,\n        hideInterfaceOnScroll: app?.state?.hideInterfaceOnScroll,\n        scrollY:             window.scrollY,",
    )
    replace_once(
        "app.js",
        "        showChapterArrows: {\n            state: app?.state?.showChapterArrows,\n            checked: app?.chapterArrowsToggle?.checked,\n            stored: ls.showChapterArrows,\n        },",
        "        showChapterArrows: {\n            state: app?.state?.showChapterArrows,\n            checked: app?.chapterArrowsToggle?.checked,\n            stored: ls.showChapterArrows,\n        },\n        hideInterfaceOnScroll: {\n            state: app?.state?.hideInterfaceOnScroll,\n            checked: app?.hideInterfaceOnScrollToggle?.checked,\n            stored: ls.hideInterfaceOnScroll,\n        },",
    )
    replace_once(
        "app.js",
        "        `  showChapterArrows: ${app?.state?.showChapterArrows}`,\n        `  hapticsEnabled: ${app?.state?.hapticsEnabled}`,",
        "        `  showChapterArrows: ${app?.state?.showChapterArrows}`,\n        `  hideInterfaceOnScroll: ${app?.state?.hideInterfaceOnScroll}`,\n        `  hapticsEnabled: ${app?.state?.hapticsEnabled}`,",
    )
    replace_once(
        "app.js",
        "        `  showChapterArrows: state=${readingToggleState.showChapterArrows.state} checked=${readingToggleState.showChapterArrows.checked} stored=${readingToggleState.showChapterArrows.stored}`,\n        `  selectedVerse: ${app?.state?.selectedVerse ?? '(none)'}`,",
        "        `  showChapterArrows: state=${readingToggleState.showChapterArrows.state} checked=${readingToggleState.showChapterArrows.checked} stored=${readingToggleState.showChapterArrows.stored}`,\n        `  hideInterfaceOnScroll: state=${readingToggleState.hideInterfaceOnScroll.state} checked=${readingToggleState.hideInterfaceOnScroll.checked} stored=${readingToggleState.hideInterfaceOnScroll.stored}`,\n        `  selectedVerse: ${app?.state?.selectedVerse ?? '(none)'}`,",
    )
    replace_once(
        "app.js",
        "        this.handleChromeScroll = () => {\n            if (this.chromeScrollTicking) return;\n            this.chromeScrollTicking = true;",
        "        this.handleChromeScroll = () => {\n            if (!this.state.hideInterfaceOnScroll) {\n                this.showChrome();\n                this.chromeScrollAnchorY = window.scrollY || window.pageYOffset || 0;\n                this.chromeLastY = this.chromeScrollAnchorY;\n                this.chromeLastDirection = null;\n                this.chromeScrollTicking = false;\n                return;\n            }\n\n            if (this.chromeScrollTicking) return;\n            this.chromeScrollTicking = true;",
    )
    replace_once(
        "app.js",
        "            window.requestAnimationFrame(() => {\n                const y           = window.scrollY || window.pageYOffset || 0;",
        "            window.requestAnimationFrame(() => {\n                if (!this.state.hideInterfaceOnScroll) {\n                    this.showChrome();\n                    this.chromeScrollAnchorY = window.scrollY || window.pageYOffset || 0;\n                    this.chromeLastY = this.chromeScrollAnchorY;\n                    this.chromeLastDirection = null;\n                    this.chromeScrollTicking = false;\n                    return;\n                }\n\n                const y           = window.scrollY || window.pageYOffset || 0;",
    )
    replace_once(
        "app.js",
        "            cacheElements(this);\n            loadTheme(this);\n\n            const themeSelector = document.getElementById('themeSelector');",
        "            cacheElements(this);\n            loadTheme(this);\n            this.loadLocalSettings();\n\n            const themeSelector = document.getElementById('themeSelector');",
    )

    app = read("app.js")
    app = app.replace(
        "\n            this.loadLocalSettings();\n            await this.prepareLocalTranslation();",
        "\n            await this.prepareLocalTranslation();",
        1,
    )
    write("app.js", app)

    replace_once(
        "app.js",
        "                showChapterArrows:   this.state.showChapterArrows,\n                scrollY:             window.scrollY,",
        "                showChapterArrows:   this.state.showChapterArrows,\n                hideInterfaceOnScroll: this.state.hideInterfaceOnScroll,\n                scrollY:             window.scrollY,",
    )

    replace_once(
        "auth.js",
        "            showChapterArrows: app.state.showChapterArrows,\n            hapticsEnabled: app.state.hapticsEnabled,",
        "            showChapterArrows: app.state.showChapterArrows,\n            hideInterfaceOnScroll: app.state.hideInterfaceOnScroll,\n            hapticsEnabled: app.state.hapticsEnabled,",
    )
    replace_once(
        "auth.js",
        "    applySetting('showChapterArrows', s.showChapterArrows);\n    applySetting('hapticsEnabled', s.hapticsEnabled);",
        "    applySetting('showChapterArrows', s.showChapterArrows);\n    applySetting('hideInterfaceOnScroll', s.hideInterfaceOnScroll);\n    applySetting('hapticsEnabled', s.hapticsEnabled);",
    )


if __name__ == "__main__":
    main()
