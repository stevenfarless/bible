const LIGHT_CLICK_MS = 12;
const FIRM_PATTERN = [30, 20, 30];

function canVibrate(app) {
    return app?.state?.hapticsEnabled !== false
        && typeof navigator.vibrate === 'function';
}

export function hapticLight(app) {
    if (!canVibrate(app)) return false;
    return navigator.vibrate(LIGHT_CLICK_MS);
}

export function hapticFirm(app) {
    if (!canVibrate(app)) return false;
    return navigator.vibrate(FIRM_PATTERN);
}

export function supportsHaptics() {
    return typeof navigator.vibrate === 'function';
}
