from pathlib import Path

APP_JS = Path('app.js')
INSTALL_PROMPT_JS = Path('install-prompt.js')


def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'Could not find expected block for {label}.')
    return text.replace(old, new, 1)


def patch_app_js():
    text = APP_JS.read_text()

    module_promise = """const installPromptModulePromise = import('./install-prompt.js')
    .then((module) => ({ module, error: null }))
    .catch((error) => ({ module: null, error }));"""

    text = replace_once(
        text,
        "const PASSAGE_CACHE_KEY = 'passageCache';\n",
        "const PASSAGE_CACHE_KEY = 'passageCache';\n\n" + module_promise + "\n",
        'early install prompt module import',
    )

    old_late_import = """void import('./install-prompt.js')
                .then(({ initInstallPrompt }) => initInstallPrompt(this))
                .catch((error) => {
                    console.warn('Install prompt unavailable:', error);
                    this._dbgEvent(`install prompt unavailable: ${error.message}`);
                });"""

    new_late_init = """void installPromptModulePromise
                .then(({ module, error }) => {
                    if (error) {
                        console.warn('Install prompt unavailable:', error);
                        this._dbgEvent(`install prompt unavailable: ${error.message}`);
                        return;
                    }

                    module.initInstallPrompt(this);
                });"""

    text = replace_once(
        text,
        old_late_import,
        new_late_init,
        'install prompt startup initialization',
    )

    APP_JS.write_text(text)


def patch_install_prompt_js():
    text = INSTALL_PROMPT_JS.read_text()

    old_schedule = """function schedulePrompt(delay = SHOW_DELAY_MS) {
    if (showTimer) return;
    showTimer = window.setTimeout(showPrompt, delay);
}"""

    event_listener = """function handleBeforeInstallPrompt(event) {
    document.body.setAttribute('data-beforeinstallprompt-fired', 'true');
    document.body.setAttribute('data-install-prompt-native-available', 'true');
    event.preventDefault();
    deferredInstallPrompt = event;

    if (initialized) schedulePrompt();
}

window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);"""

    if event_listener not in text:
        if old_schedule not in text:
            raise SystemExit('Could not find schedulePrompt block for install prompt event listener.')
        text = text.replace(old_schedule, old_schedule + "\n\n" + event_listener, 1)

    old_inline_listener = """    window.addEventListener('beforeinstallprompt', (event) => {
        document.body.setAttribute('data-beforeinstallprompt-fired', 'true');
        document.body.setAttribute('data-install-prompt-native-available', 'true');
        event.preventDefault();
        deferredInstallPrompt = event;
        schedulePrompt();
    });

"""

    if old_inline_listener in text:
        text = text.replace(old_inline_listener, '', 1)

    text = replace_once(
        text,
        """wireDomEvents();
    markReady();

    if (isIosSafari()) schedulePrompt();""",
        """wireDomEvents();
    markReady();

    if (hasInstallPath() || isIosSafari()) schedulePrompt();""",
        'post-startup install prompt scheduling',
    )

    INSTALL_PROMPT_JS.write_text(text)


def validate():
    app = APP_JS.read_text()
    prompt = INSTALL_PROMPT_JS.read_text()

    for marker in [
        "const installPromptModulePromise = import('./install-prompt.js')",
        'void installPromptModulePromise',
        'module.initInstallPrompt(this);',
    ]:
        if marker not in app:
            raise SystemExit(f'Missing app.js marker: {marker}')

    if "void import('./install-prompt.js')" in app:
        raise SystemExit('Old late install-prompt dynamic import remains in app.js.')

    for marker in [
        'function handleBeforeInstallPrompt(event)',
        "window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);",
        'if (initialized) schedulePrompt();',
        'if (hasInstallPath() || isIosSafari()) schedulePrompt();',
    ]:
        if marker not in prompt:
            raise SystemExit(f'Missing install-prompt.js marker: {marker}')

    if prompt.count("window.addEventListener('beforeinstallprompt'") != 1:
        raise SystemExit('Expected exactly one beforeinstallprompt listener registration.')


if __name__ == '__main__':
    patch_app_js()
    patch_install_prompt_js()
    validate()
    print('Install prompt event patch applied.')
