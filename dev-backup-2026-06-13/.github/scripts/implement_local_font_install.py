from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

FONT_FILES = [
    "Cinzel-Regular.woff2",
    "GentiumBookPlus-Regular.woff2",
    "GentiumBookPlus-Italic.woff2",
    "GentiumBookPlus-Bold.woff2",
    "GentiumBookPlus-BoldItalic.woff2",
    "Andika-Regular.woff2",
    "Andika-Italic.woff2",
    "Andika-Bold.woff2",
    "OpenDyslexic3-Regular.woff2",
    "Ubuntu-Regular.woff2",
    "Ubuntu-Italic.woff2",
    "Ubuntu-Bold.woff2",
    "Ubuntu-BoldItalic.woff2",
    "iAWriterQuattroS-Regular.woff2",
    "iAWriterQuattroS-Italic.woff2",
    "iAWriterQuattroS-Bold.woff2",
    "iAWriterQuattroS-BoldItalic.woff2",
    "iAWriterMonoS-Regular.woff",
    "AdwaitaSans-Regular.woff2",
    "AdwaitaSans-Italic.woff2",
    "Web437_IBM_VGA_9x16-2x.woff",
]

PRELOAD_MARKER_START = "\t<!-- Preload reading fonts so the browser fetches them early,\n"
PRELOAD_MARKER_END = "\t<link rel=\"preload\" href=\"./fonts/AdwaitaSans-Regular.woff2\" as=\"font\" type=\"font/woff2\" crossorigin />\n"

FONT_PRELOAD_BLOCK = """    var fontFiles = {
        gentium: ['./fonts/GentiumBookPlus-Regular.woff2', 'font/woff2'],
        andika: ['./fonts/Andika-Regular.woff2', 'font/woff2'],
        ubuntu: ['./fonts/Ubuntu-Regular.woff2', 'font/woff2'],
        opendyslexic3: ['./fonts/OpenDyslexic3-Regular.woff2', 'font/woff2'],
        'ia-quattro': ['./fonts/iAWriterQuattroS-Regular.woff2', 'font/woff2'],
        adwaitasans: ['./fonts/AdwaitaSans-Regular.woff2', 'font/woff2']
    };
    var activeFont = get('readingFont') || 'gentium';
    var activeFontFile = fontFiles[activeFont];
    if (activeFontFile) {
        var fontPreload = document.createElement('link');
        fontPreload.rel = 'preload';
        fontPreload.as = 'font';
        fontPreload.href = activeFontFile[0];
        fontPreload.type = activeFontFile[1];
        fontPreload.crossOrigin = 'anonymous';
        document.head.appendChild(fontPreload);
    }

"""

FONT_FAMILY_MAP = """const READING_FONT_FAMILIES = {
    gentium: 'Gentium Book Plus',
    andika: 'Andika',
    ubuntu: 'Ubuntu',
    opendyslexic3: 'OpenDyslexic3',
    'ia-quattro': 'iA Writer Quattro S',
    adwaitasans: 'Adwaita Sans',
};

"""


def replace_once(text: str, old: str, new: str, path: Path) -> str:
    if old not in text:
        raise RuntimeError(f"Expected text missing from {path}: {old[:80]!r}")
    return text.replace(old, new, 1)


def verify_font_files() -> None:
    missing = [name for name in FONT_FILES if not (ROOT / "fonts" / name).is_file()]
    if missing:
        raise RuntimeError("Missing font files: " + ", ".join(missing))


def update_service_worker() -> None:
    path = ROOT / "sw.js"
    text = path.read_text()
    anchor = "  './fonts/GentiumBookPlus-BoldItalic.woff2',\n"
    remaining = [name for name in FONT_FILES if name not in {
        "Cinzel-Regular.woff2",
        "GentiumBookPlus-Regular.woff2",
        "GentiumBookPlus-Italic.woff2",
        "GentiumBookPlus-Bold.woff2",
        "GentiumBookPlus-BoldItalic.woff2",
    }]
    insertion = anchor + "".join(f"  './fonts/{name}',\n" for name in remaining)
    text = replace_once(text, anchor, insertion, path)
    path.write_text(text)


def update_index() -> None:
    path = ROOT / "index.html"
    text = path.read_text()
    start = text.find(PRELOAD_MARKER_START)
    end = text.find(PRELOAD_MARKER_END)
    if start == -1 or end == -1 or end < start:
        raise RuntimeError("Reading-font preload block not found in index.html")
    end += len(PRELOAD_MARKER_END)
    path.write_text(text[:start] + text[end:])


def update_prepaint() -> None:
    path = ROOT / "prepaint-settings.js"
    text = path.read_text()
    anchor = "    function readBool(key, fallback) {\n"
    text = replace_once(text, anchor, FONT_PRELOAD_BLOCK + anchor, path)
    path.write_text(text)


def update_settings() -> None:
    path = ROOT / "settings.js"
    text = path.read_text()
    anchor = "const RECAPTCHA_STYLE_ID = 'recaptcha-badge-style';\n"
    text = replace_once(text, anchor, FONT_FAMILY_MAP + anchor, path)
    old = """export function applyReadingFont(app, font) {
    document.body.classList.remove('font-andika', 'font-ubuntu', 'font-opendyslexic3', 'font-retrocide', 'font-ia-quattro', 'font-adwaitasans');

    if (font === 'andika')        document.body.classList.add('font-andika');
    if (font === 'ubuntu')        document.body.classList.add('font-ubuntu');
    if (font === 'opendyslexic3') document.body.classList.add('font-opendyslexic3');
    if (font === 'retrocide')     document.body.classList.add('font-retrocide');
    if (font === 'ia-quattro')    document.body.classList.add('font-ia-quattro');
    if (font === 'adwaitasans')   document.body.classList.add('font-adwaitasans');

    const selector = document.getElementById('readingFontSelector');
    const helpText = document.getElementById('readingFontHelpText');
    if (selector) {
        selector.value = font;
        selector.disabled = false;
    }
    if (helpText) {
        helpText.textContent = 'Choose the typeface used for passage text.';
    }
}
"""
    new = """export async function applyReadingFont(app, font) {
    const family = READING_FONT_FAMILIES[font];
    if (!family) throw new Error(`Unknown reading font: ${font}`);

    const loaded = await document.fonts.load(`1em \"${family}\"`);
    if (loaded.length === 0) throw new Error(`Reading font failed to load: ${family}`);

    document.body.classList.remove('font-andika', 'font-ubuntu', 'font-opendyslexic3', 'font-retrocide', 'font-ia-quattro', 'font-adwaitasans');

    if (font === 'andika')        document.body.classList.add('font-andika');
    if (font === 'ubuntu')        document.body.classList.add('font-ubuntu');
    if (font === 'opendyslexic3') document.body.classList.add('font-opendyslexic3');
    if (font === 'retrocide')     document.body.classList.add('font-retrocide');
    if (font === 'ia-quattro')    document.body.classList.add('font-ia-quattro');
    if (font === 'adwaitasans')   document.body.classList.add('font-adwaitasans');

    const selector = document.getElementById('readingFontSelector');
    const helpText = document.getElementById('readingFontHelpText');
    if (selector) {
        selector.value = font;
        selector.disabled = false;
    }
    if (helpText) {
        helpText.textContent = 'Choose the typeface used for passage text.';
    }
}
"""
    text = replace_once(text, old, new, path)
    path.write_text(text)


def update_events() -> None:
    path = ROOT / "events.js"
    text = path.read_text()
    old = """            app.state.readingFont = font;
            localStorage.setItem('readingFont', font);
            applyReadingFont(app, font);

            if (app.currentUser) {
"""
    new = """            await applyReadingFont(app, font);
            app.state.readingFont = font;
            localStorage.setItem('readingFont', font);

            if (app.currentUser) {
"""
    text = replace_once(text, old, new, path)
    path.write_text(text)


verify_font_files()
update_service_worker()
update_index()
update_prepaint()
update_settings()
update_events()
