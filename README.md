# Bible Reader

A fast, offline-capable Bible reading app built with vanilla JavaScript, served via GitHub Pages.

## Features

- Multiple translations
- Section headings and paragraph breaks (BSB)
- Footnotes and cross-references
- Full-text search across all passages
- Dark/light mode with multiple color themes
- Firebase Authentication for sign-in
- Firebase Realtime Database sync for reading position and settings across devices
- Service worker for offline use
- Verse-by-verse reading mode
- Keyboard shortcuts (`←` `→` chapter nav, `V` verse mode, `S` section headings, `?` help)

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
├── firebase-config.js      # Root stub — re-exports from config/firebase-config.js
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

## Architecture

`app.js` is a thin orchestrator. It owns `init`, `loadPassage`, the service-worker helpers, and one-liner delegation methods for everything else. It should only change when you are modifying the app lifecycle or how passages are loaded.

All other logic lives in single-responsibility modules. When adding a feature, touch only the modules relevant to that feature:

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

`app.js` itself should not grow. If you find yourself adding logic directly to `app.js`, it belongs in one of the modules above instead.

## Firebase Setup

This app requires a Firebase project for auth and reading state sync.

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** (Email/Password and/or Google sign-in)
3. Enable **Realtime Database** and set rules to block unauthenticated writes
4. Copy your Firebase config values into `config/firebase-config.js`

> **Do not commit real API keys.** The config file is tracked for convenience during development but should be replaced with environment variable injection before any public deployment. See issue [#118](https://github.com/stevenfarless/esv-bible/issues/118).

## Development

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for local setup, branch workflow, PR standards, and commit conventions.

See [docs/CODE_OF_CONDUCT.md](docs/CODE_OF_CONDUCT.md) for community standards.

### Running Tests

```bash
npm install
npm test          # Vitest unit tests
npm run e2e       # Playwright end-to-end tests
```

## Changelog

See [docs/CHANGELOG.md](docs/CHANGELOG.md) for version history.

## Security

See [docs/SECURITY.md](docs/SECURITY.md) for the security policy.

## Translations

The app loads Bible translations from JSON files in `translations/`. See [NOTICE](NOTICE) for full copyright and attribution information.

### Included translations

| Translation | License |
|---|---|
| **BSB** — Berean Standard Bible | Public domain |
| **KJV** — King James Version | Public domain |
| **MSB** — Majority Standard Bible | Public domain |
| **LEB** — Lexham English Bible | © 2012 Logos Bible Software — free use with attribution |
| **NET** — New English Translation | © Biblical Studies Press — free non-commercial use with attribution |

## License

See [LICENSE](LICENSE).
