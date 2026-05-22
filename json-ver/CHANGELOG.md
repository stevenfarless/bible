# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning uses semantic-style tags. Releases marked `(prerelease)` were tagged as pre-releases on GitHub.

---

## [Unreleased]

### Added
- `CHANGELOG.md` (this file)
- `.github/CODEOWNERS`
- Branch strategy and deployment documentation in README

---

## JSON Era — local translation files, no API key required

---

## [v0.0.10-json-alpha] - 2026-05-21 (prerelease)

### Added
- Service worker (`sw.js`) that caches all assets under an `esv-bible-{BUILD_ID}` cache key, where `BUILD_ID` is the commit SHA injected at deploy time via `sed` in `deploy-gh-pages.yml`
- On activation, service worker deletes all caches from previous deploys, claims open tabs, and posts a `NEW_VERSION` message to each
- Non-blocking **A new version is available — Refresh** toast at bottom of screen; auto-dismisses after 30 seconds with a manual dismiss button
- `visibilitychange` listener calls `reg.update()` when a backgrounded tab regains focus, so long-lived tabs check for new deploys without a full reload

### Changed
- `deploy-gh-pages.yml` now injects `$GITHUB_SHA` as `BUILD_ID` into `sw.js` and `index.html` via `sed` before publishing to GitHub Pages
- `convert-bsb.yml` weekly cron schedule removed — now manual (`workflow_dispatch`) only

---

## [v0.0.9-json-alpha] - 2026-05-21 (prerelease)

### Added
- NLT (New Living Translation) and MEV (Modern English Version) registered in `translations/index.json` with full copyright strings and translation selector entries

### Removed
- One-time milestone setup workflow (served its purpose)
- Placeholder scaffold files used to initialize NLT and MEV translation directories

---

## [v0.0.8-json-alpha] - 2026-05-19 (prerelease)

### Added
- Multi-translation support driven by `translations/index.json`; adding a new translation requires only dropping files into the registry with no code changes
- NRSVue and BSB translations added alongside ESV and CSB
- BSB section headings (`\s1`) and paragraph breaks (`\b`) parsed from USFM source files into per-book scaffold JSONs at `translations/BSB/BSB_structure/`; scaffold is versification-based and applies to all active translations
- GitHub Actions workflow to regenerate BSB scaffold automatically when source files change

### Fixed
- `Song of Solomon` not found in CSB due to key casing mismatch (`"Song Of Solomon"`) — normalized to match expected lookup key
- `translations/BSB/BSB_structure/` files were generated as empty arrays; all 66 files populated with correct scaffold data
- Legacy `NRSVue` → `NRSVUE` storage key normalization on load prevents broken translation state for returning users
- `styles.css` restored after being truncated; pericope heading and passage paragraph CSS rules re-appended

---

## [v0.0.7-json-alpha] - 2026-05-19 (prerelease)

### Added
- BSB (Berean Standard Bible) translation

---

## [v0.0.6-json-alpha] - 2026-05-19 (prerelease)

_No release notes recorded._

---

## [v0.0.5-json-alpha] - 2026-05-19 (prerelease)

### Added
- CSB, NKJV, LEB, NIV, and ISV translations available in the selector alongside ESV and KJV
- `V` keyboard shortcut toggles verse-by-verse mode without opening settings (closes #44)

### Fixed
- Psalms internal lookup key corrected to `"Psalm"` to match JSON structure; chapters display as "Psalm N" (singular); book list and search results show "Psalms" via display name map
- Verse glow layout shift: replaced inline `.selected-verse-glow` span toggle with a block `<div>` wrapper, eliminating inline→block reflow jump in prose mode
- `scrollIntoView` unreliable on inline `<span>` elements: inserts a zero-height block anchor before the target verse, calls `scrollIntoView`, then removes it (closes #41)
- `loadSavedReadingPosition` crash: method was called in `onAuthStateChanged` but never defined, crashing load for signed-in users (closes #37)
- `setTranslation()` now calls `cache.clear()` so switching translations does not serve stale verses from the prior translation (closes #38)
- `applySettings()` now correctly syncs all checkboxes, body classes, font size, and verse count on load
- `toggleSetting` re-render path fixed; dead footnote handlers removed (closes #34)
- `readBool` helper introduced for consistent `localStorage` boolean parsing; only `"true"`/`"false"` return boolean values, all other stored values fall back to default (closes #21)
- `_loadBible` now logs raw response text when `JSON.parse` fails

### Changed
- `bible-api.js` rewritten: `_loadBook()` replaced by `_loadBible()` which fetches and caches the full monolithic translation file; `searchPassages()` iterates the cached object directly
- `app.js` class body fully restored after json-ver refactor had dropped ~40 methods

---

## [v0.0.4-json-alpha] - 2026-05-19 (prerelease)

### Added
- Local JSON Bible engine: `BibleApi` fetches `translations/{T}/{T}_bible.json` once per translation, caches the full object, and serves all passage and search requests from memory
- CSB and NKJV translation files bundled alongside ESV and KJV
- Translation selection persists to Firebase (signed-in) or localStorage (signed-out)
- `V` keyboard shortcut to toggle verse-by-verse mode

### Fixed
- Psalms chapter loading; internal key `"Psalm"` matches JSON top-level key; display is "Psalm 23" (singular) throughout
- `loadSavedReadingPosition` was called but never defined, crashing `onAuthStateChanged` for signed-in users
- `setTranslation()` left stale cache entries from prior translation
- `applySettings()` now syncs all checkboxes, body classes, font size, and verse count
- `localStorage` boolean parsing hardened via `readBool()` helper
- Verse glow: replaced class-toggling on inline span with block-level `div` wrapper; eliminates layout reflow
- Scroll-to-verse: zero-height block anchor inserted before target verse, scrolled into view, removed after animation

---

## [v0.0.3-json-alpha] - 2026-05-19 (prerelease)

### Added
- Local JSON translation source: Bible text served from `translations/{T}/{T}_bible.json`; no API key required; passage fetching and search run fully offline
- CSB and NKJV translations
- `V` keyboard shortcut for verse-by-verse toggle; documented in help modal

### Fixed
- Verse glow position jump: block `<div>` wrapper replaces inline span class-toggle; eliminates layout shift and short-verse line-bleeding
- Verse glow flash/snap: block box properties (`border-left`, `padding`, `transform`, `box-shadow`) had no effect on `display:inline` spans
- `applyVerseGlow` always returned early: `closest('p')` never matched new `<span class="verse">` structure; replaced with `[data-verse]` targeting
- `scrollIntoView` unreliable on inline spans: zero-height block anchor approach
- Translation switch left stale cache
- `loadSavedReadingPosition` undefined crash for signed-in users
- `localStorage` boolean inconsistency via `readBool()` helper
- `applySettings()` checkbox/class/font sync on startup
- Verse-by-verse `display: block` for `<span>`-based JSON structure
- ~40 missing class methods restored after json-ver refactor

### Changed
- README updated to reflect local JSON translation source
- Project renamed from *ESV Bible Web App* to *Bible Web App*

---

## [v0.0.2-json-alpha] - 2026-05-19 (prerelease)

### Fixed
- `BibleApi` loaded from `_books/*.json` per-book paths that did not exist on this branch; rewritten to load monolithic `{T}_bible.json` once per translation
- `scrollIntoView` unreliable on inline `<span>` elements (closes #41)
- `applyVerseGlow` rewritten for `<span class="verse" data-verse="N">` HTML structure produced by JSON renderer
- `display:inline` verse spans ignored block box properties, causing glow to flash and snap
- Verse-by-verse block display for JSON spans

### Added
- `V` keyboard shortcut to toggle verse-by-verse mode (closes #44)

### Changed
- `bible-api.js` initial local JSON rewrite (closes #43)
- README: project title updated to *Bible Web App*

---

## [v0.0.1-json-alpha] - 2026-05-19 (prerelease)

### Changed
- `BibleApi` rewritten to fetch from `translations/{T}/{T}_books/*.json`; passage loading and search run client-side
- All 66 book files preloaded in parallel on first search; per-book in-memory cache prevents redundant fetches
- Translation switching (ESV / KJV / CSB / NKJV) clears cache and reloads correctly
- API key field removed from sign-up and settings
- Deploy workflow updated to trigger on `json-ver` branch

### Fixed
- `localStorage` boolean parsing hardened with `readBool` helper
- Settings checkboxes, body classes, font size, and verse count sync correctly on `applySettings`
- Reading position saves to and restores from Firebase for signed-in users

### Known Limitations
- Headings and footnotes toggles wired but have no effect — data not yet in JSON files
- Cross-references panel present but empty

---

## ESV API Era — Bible text served from api.esv.org

---

## [v1.0.0-esv-api] - 2026-05-19

Final release of the ESV API-based version. Superseded by `v0.0.1-json-alpha`.

---

## [v0.0.17] - 2025-12-16 (prerelease)

### Changed
- Styling refactor

### Fixed
- Verse selection modal shows correct verse count

---

## [v0.0.16] - 2025-12-14 (prerelease)

### Changed
- `dev` merged into `main`

---

## [v0.0.15] - 2025-12-14 (prerelease)

### Fixed
- `BibleApp` class closure repaired
- Keyboard search result highlighting improved

---

## [v0.0.14] - 2025-12-11 (prerelease)

### Added
- Accordion UI for settings modal
- Footnotes implementation

### Fixed
- Footnote bugs

---

## [v0.0.13] - 2025-12-10 (prerelease)

### Fixed
- Poetry verse highlighting bug

---

## [v0.0.12] - 2025-12-06 (prerelease)

_No release notes recorded._

---

## [v0.0.12-alpha] - 2025-12-06 (prerelease)

_No release notes recorded._

---

## [v0.0.11] - 2025-12-06 (prerelease)

_No release notes recorded._

---

## [v0.0.11-alpha] - 2025-12-06 (prerelease)

_No release notes recorded._

---

## [v0.0.10] - 2025-12-05 (prerelease)

_No release notes recorded._

---

## [v0.0.9] - 2025-12-05 (prerelease)

_No release notes recorded._

---

## [v0.0.8] - 2025-12-05 (prerelease)

### Fixed
- Modal settings adjustments and settings previews

---

## [v0.0.7] - 2025-12-05 (prerelease)

### Fixed
- Verse selection when verse numbers are hidden

---

## [v0.0.6] - 2025-12-05 (prerelease)

### Added
- Black theme and additional themes

### Fixed
- Verse 1 glow: verse 1 is now selectable and glows correctly

---

## [v0.0.5] - 2025-12-02 (prerelease)

### Fixed
- SVG buttons

---

## [v0.0.4] - 2025-12-02 (prerelease)

_No release notes recorded._

---

## [v0.0.3] - 2025-12-01 (prerelease)

_No release notes recorded._

---

## [v0.0.2] - 2025-12-01 (prerelease)

_No release notes recorded._

---

## [v0.0.1] - 2025-12-01 (prerelease)

Initial release.

---

[Unreleased]: https://github.com/stevenfarless/esv-bible/compare/v0.0.10-json-alpha...HEAD
[v0.0.10-json-alpha]: https://github.com/stevenfarless/esv-bible/compare/v0.0.9-json-alpha...v0.0.10-json-alpha
[v0.0.9-json-alpha]: https://github.com/stevenfarless/esv-bible/compare/v0.0.8-json-alpha...v0.0.9-json-alpha
[v0.0.8-json-alpha]: https://github.com/stevenfarless/esv-bible/compare/v0.0.7-json-alpha...v0.0.8-json-alpha
[v0.0.7-json-alpha]: https://github.com/stevenfarless/esv-bible/compare/v0.0.6-json-alpha...v0.0.7-json-alpha
[v0.0.6-json-alpha]: https://github.com/stevenfarless/esv-bible/compare/v0.0.5-json-alpha...v0.0.6-json-alpha
[v0.0.5-json-alpha]: https://github.com/stevenfarless/esv-bible/compare/v0.0.4-json-alpha...v0.0.5-json-alpha
[v0.0.4-json-alpha]: https://github.com/stevenfarless/esv-bible/compare/v0.0.3-json-alpha...v0.0.4-json-alpha
[v0.0.3-json-alpha]: https://github.com/stevenfarless/esv-bible/compare/v0.0.2-json-alpha...v0.0.3-json-alpha
[v0.0.2-json-alpha]: https://github.com/stevenfarless/esv-bible/compare/v0.0.1-json-alpha...v0.0.2-json-alpha
[v0.0.1-json-alpha]: https://github.com/stevenfarless/esv-bible/compare/v1.0.0-esv-api...v0.0.1-json-alpha
[v1.0.0-esv-api]: https://github.com/stevenfarless/esv-bible/compare/v0.0.17...v1.0.0-esv-api
[v0.0.17]: https://github.com/stevenfarless/esv-bible/compare/v0.0.16...v0.0.17
[v0.0.16]: https://github.com/stevenfarless/esv-bible/compare/v0.0.15...v0.0.16
[v0.0.15]: https://github.com/stevenfarless/esv-bible/compare/v0.0.14...v0.0.15
[v0.0.14]: https://github.com/stevenfarless/esv-bible/compare/v0.0.13...v0.0.14
[v0.0.13]: https://github.com/stevenfarless/esv-bible/compare/v0.0.11...v0.0.13
[v0.0.12]: https://github.com/stevenfarless/esv-bible/compare/v0.0.12-alpha...v0.0.12
[v0.0.12-alpha]: https://github.com/stevenfarless/esv-bible/compare/v0.0.11-alpha...v0.0.12-alpha
[v0.0.11]: https://github.com/stevenfarless/esv-bible/compare/v0.0.11-alpha...v0.0.11
[v0.0.11-alpha]: https://github.com/stevenfarless/esv-bible/compare/v0.0.5...v0.0.11-alpha
[v0.0.10]: https://github.com/stevenfarless/esv-bible/compare/v0.0.9...v0.0.10
[v0.0.9]: https://github.com/stevenfarless/esv-bible/compare/v0.0.8...v0.0.9
[v0.0.8]: https://github.com/stevenfarless/esv-bible/compare/v0.0.7...v0.0.8
[v0.0.7]: https://github.com/stevenfarless/esv-bible/compare/v0.0.6...v0.0.7
[v0.0.6]: https://github.com/stevenfarless/esv-bible/compare/v0.0.5...v0.0.6
[v0.0.5]: https://github.com/stevenfarless/esv-bible/compare/v0.0.4...v0.0.5
[v0.0.4]: https://github.com/stevenfarless/esv-bible/compare/v0.0.3...v0.0.4
[v0.0.3]: https://github.com/stevenfarless/esv-bible/compare/v0.0.2...v0.0.3
[v0.0.2]: https://github.com/stevenfarless/esv-bible/compare/v0.0.1...v0.0.2
[v0.0.1]: https://github.com/stevenfarless/esv-bible/releases/tag/v0.0.1
