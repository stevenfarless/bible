from pathlib import Path


def replace_required(text, old, new, label):
    if old not in text:
        raise SystemExit(f'Missing expected text while patching {label}: {old!r}')
    return text.replace(old, new)


module_path = Path('install-prompt.js')
module = module_path.read_text()
module = replace_required(
    module,
    "const IOS_SHOW_DELAY_MS = 2500;",
    "const SHOW_DELAY_MS = 2500;",
    'install-prompt.js constant',
)
module = replace_required(
    module,
    "function schedulePrompt(delay = 0) {",
    "function schedulePrompt(delay = SHOW_DELAY_MS) {",
    'install-prompt.js schedule default',
)
module = replace_required(
    module,
    "if (isIosSafari()) schedulePrompt(IOS_SHOW_DELAY_MS);",
    "if (isIosSafari()) schedulePrompt();",
    'install-prompt.js iOS scheduling',
)
module_path.write_text(module)


test_path = Path('tests/install-prompt.spec.js')
test = test_path.read_text()
test = test.replace(
    "install prompt shows benefits when the browser install event fires",
    "install prompt shows benefits after the browser install event delay",
)
test = test.replace(
    "toBeVisible({ timeout: 1000 })",
    "toBeVisible({ timeout: 5000 })",
)
test_path.write_text(test)
