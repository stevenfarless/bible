(function () {
    var root = document.documentElement;
    var systemLightQuery = window.matchMedia('(prefers-color-scheme: light)');
    var DEFAULT_COLOR_THEME = 'vespers';
    var THEME_CLASSES = [
        'lux-theme', 'vespers-theme', 'vigil-theme',
        'dracula-theme', 'dracula2test-theme', 'onyx-theme',
        'sage-theme', 'ember-theme', 'perplexity-theme',
        'basic-theme', 'geek-theme', 'gnome-theme', 'uxorem-amo-theme',
        'glass-theme'
    ];
    var VALID_THEMES = {
        dracula: 1,
        dracula2test: 1,
        onyx: 1,
        sage: 1,
        ember: 1,
        perplexity: 1,
        basic: 1,
        geek: 1,
        gnome: 1,
        lux: 1,
        vespers: 1,
        vigil: 1,
        'uxorem-amo': 1,
        glass: 1
    };

    function get(key) {
        try { return localStorage.getItem(key); } catch (_) { return null; }
    }

    function set(key, value) {
        try { localStorage.setItem(key, String(value)); } catch (_) {}
    }

    function applyStartupTheme() {
        var theme = get('colorTheme') || DEFAULT_COLOR_THEME;
        if (!VALID_THEMES[theme]) theme = DEFAULT_COLOR_THEME;

        root.classList.remove.apply(root.classList, THEME_CLASSES);
        root.classList.add(theme + '-theme', 'no-color-transition');

        if (document.body) {
            document.body.classList.remove.apply(document.body.classList, THEME_CLASSES);
            document.body.classList.add(theme + '-theme', 'no-color-transition');
        }
    }

    function mirrorStartupClassesToBody() {
        if (!document.body) return;
        THEME_CLASSES.forEach(function (className) {
            document.body.classList.toggle(className, root.classList.contains(className));
        });
        document.body.classList.toggle('light-mode', root.classList.contains('light-mode'));
        document.body.classList.add('no-color-transition');
    }

    applyStartupTheme();

    var fontFiles = {
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

    function readBool(key, fallback) {
        var value = get(key);
        if (value === 'true') return true;
        if (value === 'false') return false;
        return fallback;
    }

    function readLightMode() {
        var value = get('lightMode');
        return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
    }

    function applyLightMode(mode) {
        var light = mode === 'light' || (mode === 'system' && systemLightQuery.matches);
        root.classList.toggle('light-mode', light);
        if (document.body) document.body.classList.toggle('light-mode', light);
    }

    function installVerseSelectionSuppression() {
        var style = document.createElement('style');
        style.textContent = '.passage-text .verse,.passage-text .verse *{-webkit-touch-callout:none!important;-webkit-user-select:none!important;user-select:none!important;-webkit-tap-highlight-color:transparent!important;}';
        document.head.appendChild(style);
    }

    function redactDebugReportText(text) {
        if (typeof text !== 'string') return text;
        return text.replace(
            /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
            '[redacted-email]'
        );
    }

    function installDebugReportEmailRedaction() {
        var assignedReportBuilder;

        try {
            Object.defineProperty(window, '_buildDebugReport', {
                configurable: true,
                get: function () { return assignedReportBuilder; },
                set: function (fn) {
                    assignedReportBuilder = typeof fn === 'function'
                        ? function () { return redactDebugReportText(fn.apply(this, arguments)); }
                        : fn;
                }
            });
        } catch (_) {}

        function redactDebugPanel() {
            var panel = document.getElementById('debugPanel');
            var box = panel && panel.firstElementChild && panel.firstElementChild.firstElementChild;
            if (!box) return;

            var redacted = redactDebugReportText(box.textContent || '');
            if (redacted !== box.textContent) box.textContent = redacted;
        }

        document.addEventListener('DOMContentLoaded', function () {
            if (!document.body || !('MutationObserver' in window)) return;

            var observer = new MutationObserver(redactDebugPanel);
            observer.observe(document.body, {
                childList: true,
                characterData: true,
                subtree: true
            });
        });
    }

    if (!readBool('showVerseNumbers', true)) root.classList.add('hide-verse-numbers');
    if (!readBool('coloredVerseNumbers', true)) root.classList.add('muted-verse-numbers');
    if (!readBool('showChapterArrows', false)) root.classList.add('hide-chapter-arrows');
    if (readBool('verseByVerse', false)) root.classList.add('verse-by-verse-enabled');

    var fontClasses = {
        andika: 'font-andika',
        ubuntu: 'font-ubuntu',
        opendyslexic3: 'font-opendyslexic3',
        retrocide: 'font-retrocide',
        'ia-quattro': 'font-ia-quattro',
        adwaitasans: 'font-adwaitasans'
    };
    var fontClass = fontClasses[get('readingFont') || 'gentium'];
    if (fontClass) root.classList.add(fontClass);

    var size = parseInt(get('fontSize') || '20', 10);
    root.style.setProperty('--startup-passage-font-size', Number.isFinite(size) ? size + 'px' : '20px');

    applyLightMode(readLightMode());
    installVerseSelectionSuppression();
    installDebugReportEmailRedaction();

    document.addEventListener('DOMContentLoaded', function () {
        applyStartupTheme();
        mirrorStartupClassesToBody();
        applyLightMode(readLightMode());

        var selector = document.getElementById('lightModeSelect');
        if (!selector) return;

        selector.value = readLightMode();

        function updateFromSelector() {
            var mode = selector.value === 'light' || selector.value === 'dark' || selector.value === 'system'
                ? selector.value
                : 'system';
            set('lightMode', mode);
            applyLightMode(mode);
        }

        selector.addEventListener('input', updateFromSelector);
        selector.addEventListener('change', updateFromSelector);
    });

    systemLightQuery.addEventListener('change', function () {
        if (readLightMode() === 'system') applyLightMode('system');
    });
}());