(function () {
    var root = document.documentElement;
    var systemLightQuery = window.matchMedia('(prefers-color-scheme: light)');
    var DEFAULT_COLOR_THEME = 'vespers';
    var BUG_REPORT_EMAIL = 'legelux@proton.me';
    var THEME_CLASSES = [
        'lux-theme', 'vespers-theme', 'vigil-theme',
        'dracula-theme', 'dracula2test-theme', 'onyx-theme',
        'sage-theme', 'ember-theme', 'perplexity-theme',
        'basic-theme', 'geek-theme', 'gnome-theme', 'uxorem-amo-theme'
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
        'uxorem-amo': 1
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

    function buildBugReportMailto() {
        var body = [
            'Describe the issue here:',
            '',
            'What happened?',
            '',
            'What did you expect to happen?',
            '',
            'Steps to reproduce:',
            '1.',
            '2.',
            '3.',
            '',
            '',
            '______________________________',
            '',
            'Paste the copied debug log below this line:',
            ''
        ].join('\n');

        return 'mailto:' + encodeURIComponent(BUG_REPORT_EMAIL) +
            '?subject=' + encodeURIComponent('Bug Report') +
            '&body=' + encodeURIComponent(body);
    }

    function setBugReportModalOpen(modal, open) {
        modal.classList.toggle('active', open);
        modal.setAttribute('aria-hidden', String(!open));
        modal.inert = !open;

        if (open) {
            var closeButton = modal.querySelector('#closeBugReportModal');
            setTimeout(function () { closeButton && closeButton.focus(); }, 0);
        }
    }

    function installBugReportUi() {
        var controls = document.querySelector('.header-controls');
        var settingsButton = document.getElementById('settingsBtn');

        if (!controls || !settingsButton || document.getElementById('bugReportBtn')) return;

        var button = document.createElement('button');
        button.className = 'icon-btn';
        button.id = 'bugReportBtn';
        button.type = 'button';
        button.title = 'Report a bug';
        button.setAttribute('aria-label', 'Report a bug');
        button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M0 0h24v24H0z" stroke="none"></path><path d="M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5c-.49 0-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z"></path></svg>';
        controls.insertBefore(button, settingsButton);

        var modal = document.createElement('div');
        modal.id = 'bugReportModal';
        modal.className = 'modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'bugReportModalTitle');
        modal.setAttribute('aria-hidden', 'true');
        modal.inert = true;
        modal.innerHTML = [
            '<div class="modal-content modal-content--sm">',
            '  <div class="modal-header">',
            '    <h2 id="bugReportModalTitle" tabindex="-1">Report a Bug</h2>',
            '    <button class="close-btn close-control" id="closeBugReportModal" aria-label="Close" type="button">',
            '      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 7L17 17M17 7L7 17"></path></svg>',
            '    </button>',
            '  </div>',
            '  <div class="modal-body">',
            '    <p>First copy the debug log. Then open an email and paste the log under the marked line.</p>',
            '    <div class="btn-row">',
            '      <button id="copyBugReportLog" class="primary-btn" type="button">Copy Debug Log</button>',
            '      <button id="openBugReportEmail" class="secondary-btn" type="button" disabled>Open Email</button>',
            '    </div>',
            '    <p id="bugReportStatus" aria-live="polite"></p>',
            '    <textarea id="bugReportManualLog" class="input-field" rows="8" hidden readonly></textarea>',
            '  </div>',
            '</div>'
        ].join('');
        document.body.appendChild(modal);

        var closeButton = modal.querySelector('#closeBugReportModal');
        var copyButton = modal.querySelector('#copyBugReportLog');
        var emailButton = modal.querySelector('#openBugReportEmail');
        var status = modal.querySelector('#bugReportStatus');
        var manualLog = modal.querySelector('#bugReportManualLog');

        function closeModal() { setBugReportModalOpen(modal, false); }

        button.addEventListener('click', function () {
            setBugReportModalOpen(modal, true);
        });

        closeButton.addEventListener('click', closeModal);
        modal.addEventListener('click', function (event) {
            if (event.target === modal) closeModal();
        });

        copyButton.addEventListener('click', async function () {
            var report = typeof window._buildDebugReport === 'function'
                ? window._buildDebugReport()
                : 'Debug log unavailable. Please describe what happened.';
            report = redactDebugReportText(report);

            try {
                await navigator.clipboard.writeText(report);
                status.textContent = 'Debug log copied. Tap Open Email, then paste the log under the marked line.';
                emailButton.disabled = false;
                manualLog.hidden = true;
            } catch (_) {
                manualLog.value = report;
                manualLog.hidden = false;
                manualLog.focus();
                manualLog.select();
                status.textContent = 'Copy failed. Manually copy the log below, then tap Open Email.';
                emailButton.disabled = false;
            }
        });

        emailButton.addEventListener('click', function () {
            window.location.href = buildBugReportMailto();
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
        installBugReportUi();

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