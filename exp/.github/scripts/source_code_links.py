from pathlib import Path


INDEX_PATH = Path('index.html')
COMPONENTS_PATH = Path('css/components.css')

SOURCE_CODE_HTML = '''\n\t\t\t\t\t\t\t<div class="source-code-section" aria-labelledby="sourceCodeTitle">\n\t\t\t\t\t\t\t\t<h3 id="sourceCodeTitle">Source Code</h3>\n\t\t\t\t\t\t\t\t<div class="source-code-links">\n\t\t\t\t\t\t\t\t\t<a class="source-code-link" href="https://github.com/stevenfarless/lege-lux" target="_blank" rel="noopener noreferrer" aria-label="View Lege Lux on GitHub">\n\t\t\t\t\t\t\t\t\t\t<svg class="source-code-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">\n\t\t\t\t\t\t\t\t\t\t\t<path d="M12 .297C5.373.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.207 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.725-4.042-1.61-4.042-1.61-.547-1.387-1.335-1.757-1.335-1.757-1.09-.745.083-.73.083-.73 1.205.085 1.84 1.238 1.84 1.238 1.073 1.835 2.815 1.305 3.5.997.108-.777.42-1.305.763-1.605-2.665-.303-5.467-1.332-5.467-5.93 0-1.31.467-2.382 1.235-3.222-.123-.303-.535-1.523.118-3.177 0 0 1.008-.322 3.3 1.23a11.49 11.49 0 0 1 3.003-.403c1.018.005 2.045.138 3.003.403 2.29-1.552 3.295-1.23 3.295-1.23.655 1.654.243 2.874.12 3.177.77.84 1.233 1.912 1.233 3.222 0 4.61-2.807 5.623-5.48 5.92.432.372.817 1.103.817 2.222 0 1.605-.015 2.898-.015 3.292 0 .32.217.695.825.577C20.565 22.092 24 17.597 24 12.297c0-6.627-5.373-12-12-12z"></path>\n\t\t\t\t\t\t\t\t\t\t</svg>\n\t\t\t\t\t\t\t\t\t\t<span>GitHub</span>\n\t\t\t\t\t\t\t\t\t</a>\n\n\t\t\t\t\t\t\t\t\t<a class="source-code-link" href="https://gitlab.com/stevenfarless/lege-lux" target="_blank" rel="noopener noreferrer" aria-label="View Lege Lux on GitLab">\n\t\t\t\t\t\t\t\t\t\t<svg class="source-code-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">\n\t\t\t\t\t\t\t\t\t\t\t<path d="M23.955 13.587 20.703 3.58a.85.85 0 0 0-1.612-.087l-2.2 6.757H7.109l-2.2-6.757a.85.85 0 0 0-1.612.087L.045 13.587a1.7 1.7 0 0 0 .617 1.903L12 23.734 23.338 15.49a1.7 1.7 0 0 0 .617-1.903z"></path>\n\t\t\t\t\t\t\t\t\t\t</svg>\n\t\t\t\t\t\t\t\t\t\t<span>GitLab</span>\n\t\t\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t</div>'''

SOURCE_CODE_CSS = '''\n/* Source code links */\n.source-code-section {\n    margin-top: var(--spacing-lg);\n    padding-top: var(--spacing-lg);\n    border-top: 1px solid var(--border-neutral);\n}\n\n.source-code-section h3 {\n    margin: 0 0 var(--spacing-sm);\n    font-size: 0.9rem;\n    font-weight: 600;\n    color: var(--text-heading);\n}\n\n.source-code-links {\n    display: flex;\n    flex-direction: column;\n    gap: var(--spacing-sm);\n}\n\n.source-code-link {\n    display: flex;\n    align-items: center;\n    gap: var(--spacing-sm);\n    min-height: 48px;\n    padding: var(--spacing-sm) var(--spacing-md);\n    border: 1px solid var(--border-neutral);\n    border-radius: 6px;\n    background-color: var(--bg-raised);\n    color: var(--text-body);\n    font-size: 0.9rem;\n    font-weight: 500;\n    text-decoration: none;\n    touch-action: manipulation;\n    -webkit-tap-highlight-color: transparent;\n    transition:\n        background-color var(--transition-fast),\n        border-color var(--transition-fast),\n        color var(--transition-fast);\n}\n\n.source-code-link:hover {\n    border-color: var(--primary-color);\n    color: var(--primary-color);\n}\n\n.source-code-link:focus-visible {\n    outline: 2px solid var(--primary-color);\n    outline-offset: 2px;\n}\n\n.source-code-icon {\n    width: 20px;\n    height: 20px;\n    flex: 0 0 auto;\n    fill: currentColor;\n}\n'''

ABOUT_APP_INFO = '''\t\t\t\t\t\t\t<div class="about-app-info">\n\t\t\t\t\t\t\t\t<span class="about-app-name">Lege Lux</span>\n\t\t\t\t\t\t\t\t<span class="about-version" id="aboutVersion"></span>\n\t\t\t\t\t\t\t\t<span class="about-tagline">A clean, fast Bible reader.</span>\n\t\t\t\t\t\t\t</div>'''

HELP_SHORTCUTS_MARKER = '/* Help & Shortcuts */'


def update_index():
    html = INDEX_PATH.read_text()
    if 'class="source-code-section"' in html:
        return False

    if ABOUT_APP_INFO not in html:
        raise SystemExit('Could not find About app info block in index.html.')

    INDEX_PATH.write_text(html.replace(ABOUT_APP_INFO, ABOUT_APP_INFO + SOURCE_CODE_HTML, 1))
    return True


def update_components_css():
    css = COMPONENTS_PATH.read_text()
    if '.source-code-section' in css:
        return False

    if HELP_SHORTCUTS_MARKER not in css:
        raise SystemExit('Could not find Help & Shortcuts marker in css/components.css.')

    COMPONENTS_PATH.write_text(css.replace(HELP_SHORTCUTS_MARKER, SOURCE_CODE_CSS + '\n' + HELP_SHORTCUTS_MARKER, 1))
    return True


def main():
    changed = update_index()
    changed = update_components_css() or changed
    print('Source code links applied.' if changed else 'Source code links already present.')


if __name__ == '__main__':
    main()
