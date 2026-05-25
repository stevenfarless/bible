## Branch Hierarchy & Merge Order

> **This is the `dev` branch** — the integration branch. All feature branches merge here before anything goes to `main`.
>
> ```
> main
> └── dev                         ← YOU ARE HERE
>     └── search                  ← full-text search feature; merges into dev
>         └── refactor/split-app-js  ← breaks app.js into modules; merges into search
> ```
>
> **Merge order (bottom-up):**
> 1. `refactor/split-app-js` → `search`
> 2. `search` → `dev`
> 3. `dev` → `main`
>
> Do not skip steps or merge out of order. Each child branch must be fully tested and reviewed before moving up the chain.

# Bible Reader

A fast, offline-capable Bible reading app built with vanilla JavaScript, served via GitHub Pages.

## Features

- Multiple translations: ESV, BSB, KJV, NIV, NLT, CSB, NKJV, MEV, ISV, LEB, NRSVue, and more
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
├── app.js                  # Main app logic and BibleApp class
├── bible-api.js            # Translation loader and passage renderer
├── bsb-structure.js        # Heading/paragraph scaffold loader (BSB)
├── reading-state.js        # Navigation and settings state
├── ui.js                   # Theme, UI utilities, and element caching
├── firebase-config.js      # Root stub (redirects to config/)
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
│   └── known_absent_verses.json  # Per-translation list of TR-absent verses
├── js/                     # Additional JS modules
├── translations/           # Per-translation Bible JSON files
├── scripts/                # Build and conversion scripts
├── tests/                  # Unit (Vitest) and E2E (Playwright) tests
└── docs/                   # Project documentation
```

## Firebase Setup

This branch requires a Firebase project for auth and reading state sync.

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

The app loads Bible translations from JSON files in `translations/`. Translations fall into two categories based on copyright.

### Public-domain / CC0 (safe to ship as JSON in a public repo)

| Translation | Text Base | Style | Apocrypha | Closest Mainstream Twin |
|---|---|---|---|---|
| **WEB** — World English Bible | Byzantine/Majority Text | Formal, modern English | Yes (separate edition) | NKJV / ESV |
| **BSB** — Berean Standard Bible | NA28 / BHS | Balanced formal-dynamic | No | CSB / ESV |
| **NHEB** — New Heart English Bible | Byzantine (WEB-derived) | Slightly smoother than WEB | No | NIV / CSB |
| **OEB** — Open English Bible | Westcott-Hort | Dynamic, contemporary | No (pair with PD Apocrypha) | NIV / NRSV |
| **KJV** | Textus Receptus | Archaic Early Modern English | Yes | NKJV |
| **RV (1895)** — Revised Version | Westcott-Hort | Formal, slightly archaic | Yes | RSV / NRSV |
| **Douay-Rheims** | Latin Vulgate | Latinate, formal | Yes (Catholic deuterocanon) | NABRE / NRSV-CE |
| **ASV** | Westcott-Hort | Rigorous, mildly archaic | No | NASB |
| **YLT** — Young's Literal | Hebrew / Greek direct | Hyper-literal; study only | No | Interlinear |

**WEB** is the only PD modern-English option that also ships a Deuterocanon/Apocrypha edition. **BSB** is the strongest all-around PD modern translation for evangelical study use. For text-critically aware users: WEB, NHEB, and KJV follow the Byzantine/Majority Text NT; WEB/BSB differ at a handful of contested verses (e.g., 1 John 5:7–8, Mark 16:9–20).

### Copyrighted with permissive licenses (API or private storage only)

| Translation | License Summary | Style | Closest Mainstream Twin |
|---|---|---|---|
| **LEB** — Lexham English Bible | Free to give away; commercial bundling allowed if LEB < 25% of work | Very literal; NT highly regarded | NASB / ESV |
| **NET** — New English Translation | Non-commercial free use permitted in apps with NET tag and attribution | Natural modern English; 60k+ translator notes | NIV / CSB |

All other copyrighted translations bundled in this app (ESV, NASB, CSB, NIV, NKJV, NLT, NRSVue, MEV, ISV) must not be stored as full JSON in a public repository. They are loaded via API or private Firebase storage. See [NOTICE](NOTICE) for per-translation copyright information and issue [#136](https://github.com/stevenfarless/esv-bible/issues/136) for full licensing and scholarly notes.

## License

See [LICENSE](LICENSE).
