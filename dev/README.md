# Bible Reader

A fast, offline-capable Bible reading web app built with vanilla JavaScript.
Served via GitHub Pages. Firebase handles auth and reading state sync only.

Live app: [stevenfarless.github.io/bible](https://stevenfarless.github.io/bible)

---

## Translations

| Translation | License |
|---|---|
| **ASV** - American Standard Version | Public domain |
| **BLB** - Berean Literal Bible | Public domain |
| **BSB** - Berean Standard Bible | Public domain |
| **KJV** - King James Version | Public domain |
| **LEB** - Lexham English Bible | (c) 2012 Logos Bible Software, free use with attribution |
| **MSB** - Majority Standard Bible | Public domain |
| **NET** - New English Translation | (c) Biblical Studies Press, free non-commercial use with attribution |
| **WEB** - World English Bible | Public domain |

Full copyright and attribution information is in [NOTICE](NOTICE).

---

## Features

**Reading**
- Section headings and paragraph breaks sourced from BSB structure data
- Footnotes and inline cross-references
- Verse-by-verse mode
- Adjustable font size and multiple color themes (dark and light)

**Navigation**
- Book, chapter, and verse picker modals
- Keyboard shortcuts: `<-` `->` chapter navigation, `^` `v` verse navigation, `Ctrl+K` search, `?` help

**Search**
- Full-text search across all translations with results grouped by testament and book
- Direct passage reference lookup (e.g. `John 3:16`, `Romans 8`)

**Sync and Offline**
- Firebase Authentication (email/password)
- Reading position and settings synced across devices via Firebase Realtime Database
- Service worker for full offline use after first load

---

## Project Structure

```
/
├── index.html              # App entry point
├── app.js                  # Orchestrator: init, loadPassage, delegation, SW registration
├── events.js               # All DOM event listener wiring (attachEventListeners)
├── keyboard.js             # Global keyboard shortcut handler
├── modals.js               # Modal open/close, book/chapter/verse population, drag-to-resize
├── settings.js             # Load, apply, and persist user preferences
├── auth.js                 # Firebase auth, login/signup/logout, reading position persistence
├── search.js               # Full-text and passage-reference search
├── navigation.js           # Prev/next chapter and verse button logic
├── reading-state.js        # State initialisation, chapter nav, verse scroll/glow
├── bible-api.js            # Translation loader and passage renderer
├── bible-structure.js      # Book/chapter/testament lookup tables
├── bsb-structure.js        # Heading/paragraph scaffold loader (BSB)
├── ui.js                   # Theme, element caching, icon updates
├── firebase-config.js      # Root stub, re-exports from config/firebase-config.js
├── sw.js                   # Service worker
├── styles.css              # All styles
├── cross_references.txt    # Cross-reference source data (8 MB)
├── package.json            # Dev dependencies (Vitest, Playwright)
├── vitest.config.js        # Unit test config
├── playwright.config.js    # E2E test config
├── config/
│   └── firebase-config.js  # Firebase init and exports (auth, db, config)
├── data/
│   ├── bsb-usfm/           # BSB USFM source files (67 books)
│   └── known_absent_verses.json
├── js/                     # Additional JS modules
├── translations/           # Per-translation Bible JSON files
├── scripts/                # Build and conversion scripts
├── tests/                  # Unit (Vitest) and E2E (Playwright) tests
└── docs/                   # Project documentation
```

---

## Architecture

`app.js` is a thin orchestrator. It owns `init`, `loadPassage`, service-worker
registration, and one-liner delegation methods for everything else. It should
only change when modifying the app lifecycle or how passages are loaded.

All other logic lives in single-responsibility modules. When adding a feature,
touch only the modules relevant to that feature:

| What you're adding | Files to touch |
|---|---|
| New user preference / setting | `settings.js` + `events.js` (one new toggle binding) |
| New modal | `modals.js` + `events.js` (open/close/populate + binding) |
| New keyboard shortcut | `keyboard.js` only |
| New auth behaviour | `auth.js` only |
| New event binding (button, toggle, etc.) | `events.js` only |
| New API call or passage rendering change | `bible-api.js` or `reading-state.js` |
| New search capability | `search.js` + `events.js` if it needs a new trigger |
| New lifecycle step at startup | `app.js` (`init`) |
| Change to how passages load | `app.js` (`loadPassage`) |

If you find yourself adding logic directly to `app.js`, it belongs in one of
the modules above instead.

---

## Firebase Setup

The app requires a Firebase project for auth and cross-device sync.

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** -> Email/Password provider
3. Enable **Realtime Database** and set security rules to block unauthenticated writes
4. Copy your config values into `config/firebase-config.js`

`config/firebase-config.js` is tracked in the repository. Do not commit
production credentials to a public repo. Use environment variable injection
or a CI secret for any public deployment.

---

## Development

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for local setup, branch
workflow, PR standards, and commit conventions.

### Running Tests

```bash
npm install
npm test          # Vitest unit tests
npm run e2e       # Playwright end-to-end tests
```

---

## Changelog

See [docs/CHANGELOG.md](docs/CHANGELOG.md).

## Security

See [docs/SECURITY.md](docs/SECURITY.md).

## License

See [LICENSE](LICENSE).
