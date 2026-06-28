from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def apply(text, marker, old, new, label):
    if marker in text:
        return text
    if old not in text:
        raise SystemExit(label + ' anchor not found')
    return text.replace(old, new, 1)


def apply_re(text, marker, pattern, new, label):
    if marker in text:
        return text
    text, count = re.subn(pattern, new, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(label + ' anchor not found')
    return text


modals = read('modals.js')
modals = apply(
    modals,
    'picker opened: book',
    "export function openBookModal(app) {\n    const content = app.bookModal?.querySelector('.modal-content');",
    "export function openBookModal(app) {\n    app._dbgUserAction?.('picker opened: book');\n    app._dbgEvent?.('picker opened: book');\n\n    const content = app.bookModal?.querySelector('.modal-content');",
    'book picker open',
)
modals = apply(
    modals,
    'picker selected book:',
    "        button.addEventListener('click', () => {\n            app.referencePickerDraft = { book, chapter: 1 };",
    "        button.addEventListener('click', () => {\n            app._dbgUserAction?.('picker selected book: ' + book);\n            app._dbgEvent?.('picker selected book: ' + book + ' -> chapter picker');\n            app.referencePickerDraft = { book, chapter: 1 };",
    'book picker selection',
)
modals = apply(
    modals,
    'picker opened: chapter for',
    "export function openChapterModal(app) {\n    populateChapterModal(app);",
    "export function openChapterModal(app) {\n    const book = app.referencePickerDraft?.book || app.state.currentBook;\n    app._dbgUserAction?.('picker opened: chapter for ' + book);\n    app._dbgEvent?.('picker opened: chapter for ' + book);\n\n    populateChapterModal(app);",
    'chapter picker open',
)
modals = apply(
    modals,
    'picker selected chapter:',
    "        btn.addEventListener('click', async () => {\n            const book = app.referencePickerDraft?.book || app.state.currentBook;\n\n            app.referencePickerDraft = { book, chapter: i };",
    "        btn.addEventListener('click', async () => {\n            const book = app.referencePickerDraft?.book || app.state.currentBook;\n            app._dbgUserAction?.('picker selected chapter: ' + book + ' ' + i);\n            app._dbgEvent?.('picker navigation: loading ' + book + ' ' + i + ' from chapter picker');\n\n            app.referencePickerDraft = { book, chapter: i };",
    'chapter picker selection',
)
modals = apply(
    modals,
    'picker opened: verse for',
    "export function openVerseModal(app) {\n    populateVerseModal(app);",
    "export function openVerseModal(app) {\n    app._dbgUserAction?.('picker opened: verse for ' + app.state.currentBook + ' ' + app.state.currentChapter);\n    app._dbgEvent?.('picker opened: verse for ' + app.state.currentBook + ' ' + app.state.currentChapter);\n\n    populateVerseModal(app);",
    'verse picker open',
)
modals = apply(
    modals,
    'picker selected verse:',
    "        btn.addEventListener('click', () => {\n            app.referencePickerDraft = null;",
    "        btn.addEventListener('click', () => {\n            app._dbgUserAction?.('picker selected verse: ' + app.state.currentBook + ' ' + app.state.currentChapter + ':' + i);\n            app._dbgEvent?.('picker selected verse: ' + app.state.currentBook + ' ' + app.state.currentChapter + ':' + i);\n            app.referencePickerDraft = null;",
    'verse picker selection',
)
write('modals.js', modals)


app = read('app.js')
app = apply(
    app,
    'source=unspecified restoreScroll',
    "    async loadPassage(book, chapter, restoreScroll = false) {\n        // Guard:",
    "    async loadPassage(book, chapter, restoreScroll = false, source = 'unspecified') {\n        const requestId = (this._loadPassageRequestSeq = (this._loadPassageRequestSeq || 0) + 1);\n        this._activeLoadPassageRequest = requestId;\n        this._dbgEvent(`loadPassage request #${requestId}: ${book} ${chapter} source=${source} restoreScroll=${!!restoreScroll} from=${this.state.currentBook} ${this.state.currentChapter}`);\n\n        // Guard:",
    'loadPassage source signature',
)
app = apply(
    app,
    "loadPassage-start:' + source",
    "        if (!restoreScroll) this.saveReadingPosition?.();",
    "        if (!restoreScroll) this.saveReadingPosition?.('loadPassage-start:' + source);",
    'loadPassage start storage source',
)
app = apply(
    app,
    'loadPassage rendered #',
    "        this._dbgEvent(`loadPassage: rendered ${book} ${chapter} (${this.state.translation})`);\n        this.saveReadingPosition?.();\n        this._savePassageCache(book, chapter, this.state.translation || 'KJV', title, this.passageText.innerHTML);",
    "        const superseded = this._activeLoadPassageRequest === requestId ? '' : ` supersededBy=#${this._activeLoadPassageRequest}`;\n        this._dbgEvent(`loadPassage rendered #${requestId}: ${book} ${chapter} (${this.state.translation}) source=${source}${superseded}`);\n        this.saveReadingPosition?.('loadPassage-rendered:' + source);\n        this._savePassageCache(book, chapter, this.state.translation || 'KJV', title, this.passageText.innerHTML, source);",
    'loadPassage rendered source',
)
app = apply(
    app,
    'storage write: passageCache',
    "    _savePassageCache(book, chapter, translation, title, html) {\n        try {\n            localStorage.setItem(PASSAGE_CACHE_KEY, JSON.stringify({\n                book,\n                chapter: parseInt(chapter, 10),\n                translation: translation || 'KJV',\n                title,\n                html,\n            }));\n        } catch (_) { }\n    }",
    "    _savePassageCache(book, chapter, translation, title, html, source = 'unspecified') {\n        try {\n            localStorage.setItem(PASSAGE_CACHE_KEY, JSON.stringify({\n                book,\n                chapter: parseInt(chapter, 10),\n                translation: translation || 'KJV',\n                title,\n                html,\n            }));\n            this._dbgEvent?.('storage write: passageCache ' + book + ' ' + parseInt(chapter, 10) + ' ' + (translation || 'KJV') + ' source=' + source);\n        } catch (_) { }\n    }",
    'passage cache storage log',
)
app = apply(app, 'source) { saveReadingPosition(this, source);', "    saveReadingPosition() { saveReadingPosition(this); }", "    saveReadingPosition(source) { saveReadingPosition(this, source); }", 'saveReadingPosition wrapper source')
app = apply(app, 'openModal: ${modal?.id ?? \'unknown\'} source=', "    openModal(modal) {\n        _logUserAction(`openModal: ${modal?.id ?? 'unknown'}`);\n        openModal(this, modal);\n    }", "    openModal(modal, source = 'unspecified') {\n        _logUserAction(`openModal: ${modal?.id ?? 'unknown'} source=${source}`);\n        openModal(this, modal);\n    }", 'openModal source')
app = apply(app, 'loadPassageFromReference(this, ref, source);', "    async loadPassageFromReference(ref) { await loadPassageFromReference(this, ref); }", "    async loadPassageFromReference(ref, source) { await loadPassageFromReference(this, ref, source); }", 'loadPassageFromReference wrapper source')
app = apply(app, "saveReadingPosition(this, 'auth-restoration-newer-local-position');", "                saveReadingPosition(this);\n                this._dbgEvent('auth restoration: saved newer local position');", "                saveReadingPosition(this, 'auth-restoration-newer-local-position');\n                this._dbgEvent('auth restoration: saved newer local position');", 'auth save source')
app = apply(app, "'startup-position-mismatch'", "                    this.loadPassage(savedPos.book, savedPos.chapter),", "                    this.loadPassage(savedPos.book, savedPos.chapter, false, 'startup-position-mismatch'),", 'startup mismatch source')
app = apply(app, "'startup-cache-miss'", "                    this.loadPassage(this.state.currentBook, this.state.currentChapter),", "                    this.loadPassage(this.state.currentBook, this.state.currentChapter, false, 'startup-cache-miss'),", 'startup cache miss source')
app = apply(app, "'auth-restoration-translation-sync'", "                await this.loadPassage(\n                    this.state.currentBook,\n                    this.state.currentChapter,\n                    Boolean(this.lastScrollPosition)\n                );", "                await this.loadPassage(\n                    this.state.currentBook,\n                    this.state.currentChapter,\n                    Boolean(this.lastScrollPosition),\n                    'auth-restoration-translation-sync'\n                );", 'auth translation sync source')
app = apply(app, 'service worker registered:', "        const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });\n        const pageBuildId", "        const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });\n        appInstance?._dbgEvent?.('service worker registered: ' + reg.scope);\n        const pageBuildId", 'service worker registered log')
app = apply(app, 'service worker message: NEW_VERSION', "            if (event.data?.type === 'NEW_VERSION') {\n                maybeShowUpdateToast();\n            }", "            if (event.data?.type === 'NEW_VERSION') {\n                appInstance?._dbgEvent?.('service worker message: NEW_VERSION');\n                maybeShowUpdateToast();\n            }", 'sw new version log')
app = apply(app, 'service worker build mismatch:', "                if (pageBuildId && swBuildId && pageBuildId !== swBuildId) {\n                    maybeShowUpdateToast();\n                }", "                if (pageBuildId && swBuildId && pageBuildId !== swBuildId) {\n                    appInstance?._dbgEvent?.('service worker build mismatch: page=' + pageBuildId + ' sw=' + swBuildId);\n                    maybeShowUpdateToast();\n                }", 'sw build mismatch log')
app = apply(app, 'service worker update check: reload requested', "                if (reloadOnUpdate) {\n                    window.location.reload();", "                if (reloadOnUpdate) {\n                    appInstance?._dbgEvent?.('service worker update check: reload requested remote=' + remoteSha + ' page=' + pageBuildId);\n                    window.location.reload();", 'sw reload log')
app = apply(app, 'service worker update toast shown', "function showUpdateToast(appInstance) {\n    const toast = document.getElementById('toast');", "function showUpdateToast(appInstance) {\n    appInstance?._dbgEvent?.('service worker update toast shown');\n    const toast = document.getElementById('toast');", 'sw toast log')
write('app.js', app)


search = read('search.js')
search = apply(search, "source = 'search-reference'", "export async function loadPassageFromReference(app, reference) {", "export async function loadPassageFromReference(app, reference, source = 'search-reference') {", 'reference load source signature')
search = apply(search, 'search reference selected:', "    const { book, chapter, verse } = parsed;\n\n    app.state.selectedVerse", "    const { book, chapter, verse } = parsed;\n    app._dbgEvent?.('search reference selected: ' + book + ' ' + chapter + (verse ? ':' + verse : '') + ' source=' + source);\n\n    app.state.selectedVerse", 'reference selected log')
search = apply(search, 'source)', "    await app.loadPassage(book, chapter);", "    await app.loadPassage(book, chapter, false, source);", 'reference load source call')
search = apply(search, 'search result selected:', "            const activeTrans = resultItem.dataset.activeTranslation || null;\n            const ref = resultItem.dataset.reference;\n            closeSearch(app);", "            const activeTrans = resultItem.dataset.activeTranslation || null;\n            const ref = resultItem.dataset.reference;\n            const activationSource = app._searchActivationSource || e.type;\n            app._dbgUserAction?.('search result selected: ' + ref + ' source=' + activationSource + (activeTrans ? ' translation=' + activeTrans : ''));\n            app._dbgEvent?.('search result navigation: ' + ref + ' source=' + activationSource + (activeTrans ? ' translation=' + activeTrans : ''));\n            closeSearch(app);", 'search result activation log')
search = apply(search, "'search-result-' + activationSource", "                await loadPassageFromReference(app, ref);", "                await loadPassageFromReference(app, ref, 'search-result-' + activationSource);", 'search result source call')
search = apply(search, 'search result keyboard activation:', "export function activateSelectedSearchResult(app) {\n    if (!app.searchResultItems || app.searchSelectedIndex < 0 || app.searchSelectedIndex >= app.searchResultItems.length) return;\n    app.searchResultItems[app.searchSelectedIndex]?.click();\n}", "export function activateSelectedSearchResult(app) {\n    if (!app.searchResultItems || app.searchSelectedIndex < 0 || app.searchSelectedIndex >= app.searchResultItems.length) return;\n    const item = app.searchResultItems[app.searchSelectedIndex];\n    app._dbgUserAction?.('search result keyboard activation: ' + (item?.dataset.reference || 'unknown'));\n    app._searchActivationSource = 'keyboard';\n    item?.click();\n    app._searchActivationSource = null;\n}", 'keyboard search activation log')
search = apply(search, 'search mode: reference lookup', "    const q = reference.trim();\n    // Wildcard", "    const q = reference.trim();\n    app._dbgEvent?.('search mode: reference lookup for "' + q + '"');\n    // Wildcard", 'reference search mode log')
search = apply(search, 'search mode: keyword for', "export async function performKeywordSearch(app, query) {\n    app.searchResults.innerHTML", "export async function performKeywordSearch(app, query) {\n    app._dbgEvent?.('search mode: keyword for "' + query + '" translation=' + app.bibleApi.translation);\n    app.searchResults.innerHTML", 'keyword search mode log')
search = apply(search, 'search translation badge selected:', "            const translationId = badge.dataset.translationId;\n            const translationContent", "            const translationId = badge.dataset.translationId;\n            app._dbgUserAction?.('search translation badge selected: ' + translationId + ' for ' + (card.dataset.reference || 'unknown'));\n            const translationContent", 'translation badge log')
write('search.js', search)


settings = read('settings.js')
settings = apply(settings, "'settings-showHeadings'", "        await app.loadPassage(app.state.currentBook, app.state.currentChapter);", "        await app.loadPassage(app.state.currentBook, app.state.currentChapter, false, 'settings-showHeadings');", 'show headings load source')
settings = apply(settings, 'changeTranslation request:', "export async function changeTranslation(\n    app,\n    translation,\n    { syncPreference = true } = {}\n) {\n    const chromeBottom", "export async function changeTranslation(\n    app,\n    translation,\n    { syncPreference = true } = {}\n) {\n    const previousTranslation = app.state.translation;\n    const previousBook = app.state.currentBook;\n    const previousChapter = app.state.currentChapter;\n    app._dbgEvent?.('changeTranslation request: ' + previousTranslation + ' -> ' + translation + ' while at ' + previousBook + ' ' + previousChapter + ' syncPreference=' + syncPreference);\n\n    const chromeBottom", 'translation request log')
settings = apply(settings, 'storage write: translation ', "    lsSet('translation', translation);", "    lsSet('translation', translation);\n    app._dbgEvent?.('storage write: translation ' + translation + ' source=changeTranslation');", 'translation storage log')
settings = apply(settings, 'storage write: preferredTranslation', "        lsSet('preferredTranslation', translation);", "        lsSet('preferredTranslation', translation);\n        app._dbgEvent?.('storage write: preferredTranslation ' + translation + ' source=changeTranslation');", 'preferred translation storage log')
settings = apply(settings, 'changeTranslation meta fetch failed:', "    } catch (_) { }\n\n    app._rebuildBibleBooks(meta);", "    } catch (error) {\n        app._dbgEvent?.('changeTranslation meta fetch failed: ' + translation + ' — ' + (error?.message || error));\n    }\n\n    app._rebuildBibleBooks(meta);", 'translation meta failure log')
settings = apply(settings, 'changeTranslation preserving passage:', "    updateCopyright(app);\n\n    await app.loadPassage(\n        app.state.currentBook,\n        app.state.currentChapter\n    );", "    updateCopyright(app);\n    app._dbgEvent?.('changeTranslation preserving passage: ' + app.state.currentBook + ' ' + app.state.currentChapter + ' translation=' + translation);\n\n    await app.loadPassage(\n        app.state.currentBook,\n        app.state.currentChapter,\n        false,\n        'translation-change'\n    );", 'translation preserving source')
write('settings.js', settings)


auth = read('auth.js')
auth = apply(auth, "source = 'unspecified'", "export function saveReadingPosition(app) {", "export function saveReadingPosition(app, source = 'unspecified') {", 'save reading position source signature')
auth = apply(auth, 'storage write: readingPosition', "    lsSetJSON('readingPosition', pos);", "    lsSetJSON('readingPosition', pos);\n    app._dbgEvent?.('storage write: readingPosition ' + pos.book + ' ' + pos.chapter + ' scrollY=' + pos.scrollY + ' source=' + source);", 'reading position storage log')
auth = apply(auth, 'auth restoration: local position at read start', "    let targetBook = app.state.currentBook;\n    let targetChapter = app.state.currentChapter;\n    let targetScrollY = 0;", "    let targetBook = app.state.currentBook;\n    let targetChapter = app.state.currentChapter;\n    let targetScrollY = 0;\n    app._dbgEvent?.('auth restoration: local position at read start ' + targetBook + ' ' + targetChapter + ' scrollY=' + (window.scrollY || 0));", 'auth local position log')
auth = apply(auth, 'auth restoration: remote position:', "                targetScrollY = pos.scrollY || 0;\n            }", "                targetScrollY = pos.scrollY || 0;\n                app._dbgEvent?.('auth restoration: remote position: ' + targetBook + ' ' + targetChapter + ' scrollY=' + targetScrollY);\n            }", 'auth remote position log')
auth = apply(auth, 'auth restoration: chose remote position', "        lsSetJSON('readingPosition', { book: targetBook, chapter: targetChapter, scrollY: targetScrollY });\n        await app.loadPassage(targetBook, targetChapter, !!targetScrollY);", "        lsSetJSON('readingPosition', { book: targetBook, chapter: targetChapter, scrollY: targetScrollY });\n        app._dbgEvent?.('auth restoration: chose remote position ' + targetBook + ' ' + targetChapter + ' scrollY=' + targetScrollY);\n        await app.loadPassage(targetBook, targetChapter, !!targetScrollY, 'auth-remote-position');", 'auth remote load source')
auth = apply(auth, 'auth restoration: chose remote scroll', "    } else if (targetScrollY) {\n        window.scrollTo(0, targetScrollY);\n    }", "    } else if (targetScrollY) {\n        app._dbgEvent?.('auth restoration: chose remote scrollY=' + targetScrollY + ' for current passage');\n        window.scrollTo(0, targetScrollY);\n    }", 'auth remote scroll log')
auth = apply(auth, "'legacy-saved-position'", "        await app.loadPassage(app.state.currentBook, app.state.currentChapter);", "        await app.loadPassage(app.state.currentBook, app.state.currentChapter, false, 'legacy-saved-position-no-user');", 'legacy no user source')
auth = apply(auth, "'legacy-saved-position'", "    await app.loadPassage(app.state.currentBook, app.state.currentChapter, !!app.lastScrollPosition);", "    await app.loadPassage(app.state.currentBook, app.state.currentChapter, !!app.lastScrollPosition, 'legacy-saved-position');", 'legacy saved position source')
write('auth.js', auth)


swipe = read('swipe.js')
swipe = apply(swipe, 'swipe ignored: animation in progress', "        if (_animating) {\n            _vetoed = true;\n            return;\n        }", "        if (_animating) {\n            app._dbgUserAction?.('swipe ignored: animation in progress');\n            _vetoed = true;\n            return;\n        }", 'swipe animation ignored log')
swipe = apply(swipe, 'swipe ignored: modal open', "        if (_vetoed) return;\n        if (_isModalOpen() || _isSearchOpen(app)) return;", "        if (_vetoed) return;\n        if (_isModalOpen()) { app._dbgUserAction?.('swipe ignored: modal open'); return; }\n        if (_isSearchOpen(app)) { app._dbgUserAction?.('swipe ignored: search open'); return; }", 'swipe modal search ignored log')
swipe = apply(swipe, 'swipe cancelled:', "        if (!commit) {\n            if (_atBoundary(dx) && absDx > 20) hapticFirm(app);\n            cancelSwipe();\n            return;\n        }", "        if (!commit) {\n            app._dbgUserAction?.('swipe cancelled: below threshold dx=' + Math.round(dx) + ' velocity=' + _velocity.toFixed(2));\n            if (_atBoundary(dx) && absDx > 20) hapticFirm(app);\n            cancelSwipe();\n            return;\n        }", 'swipe cancel log')
swipe = apply(swipe, 'swipe commit blocked: boundary', "        if (!incomingPos.book) {\n            hapticFirm(app);\n            cancelSwipe();\n            return;\n        }", "        if (!incomingPos.book) {\n            app._dbgUserAction?.('swipe commit blocked: boundary direction=' + direction);\n            hapticFirm(app);\n            cancelSwipe();\n            return;\n        }", 'swipe boundary log')
swipe = apply(swipe, "app.saveReadingPosition?.('swipe');", "            app.saveReadingPosition?.();", "            app.saveReadingPosition?.('swipe');", 'swipe storage source')
write('swipe.js', swipe)

print('debug log instrumentation script complete')
