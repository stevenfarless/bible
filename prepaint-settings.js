(function () {
    var root = document.documentElement;
    var systemLightQuery = window.matchMedia('(prefers-color-scheme: light)');

    function get(key) {
        try { return localStorage.getItem(key); } catch (_) { return null; }
    }

    function set(key, value) {
        try { localStorage.setItem(key, String(value)); } catch (_) {}
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

    document.addEventListener('DOMContentLoaded', function () {
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