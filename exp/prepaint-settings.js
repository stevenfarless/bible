(function () {
    var root = document.documentElement;

    function get(key) {
        try { return localStorage.getItem(key); } catch (_) { return null; }
    }

    function readBool(key, fallback) {
        var value = get(key);
        if (value === 'true') return true;
        if (value === 'false') return false;
        return fallback;
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
}());
