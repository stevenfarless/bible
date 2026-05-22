# ESV Bible Reader

A fast, offline-capable Bible reading app built with vanilla JavaScript, served via GitHub Pages.

## Features

- Multiple translations: ESV, BSB, KJV, NIV, NLT, CSB, NKJV, MEV, ISV, LEB, NRSVue, and more
- Section headings and paragraph breaks (BSB)
- Cross-references
- Search across passages
- Dark/light mode with multiple color themes
- Firebase authentication for synced reading position
- Service worker for offline use
- Verse-by-verse mode

## Project Structure

```
/
├── index.html          # App entry point
├── app.js              # Main app logic
├── bible-api.js        # Translation loader
├── bsb-structure.js    # Heading/paragraph scaffold loader
├── reading-state.js    # Navigation state
├── ui.js               # Theme and UI utilities
├── firebase-config.js  # Firebase init
├── sw.js               # Service worker
├── styles.css          # All styles
├── cross_references.txt
├── data/
│   └── bsb-usfm/       # BSB USFM source files (67 books)
├── translations/       # Per-translation Bible JSON files
├── scripts/            # Build and conversion scripts
└── docs/               # Project documentation
```

## Development

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for local setup, branch workflow, PR standards, and commit conventions.

See [docs/CODE_OF_CONDUCT.md](docs/CODE_OF_CONDUCT.md) for community standards.

## Changelog

See [docs/CHANGELOG.md](docs/CHANGELOG.md) for version history.

## Security

See [docs/SECURITY.md](docs/SECURITY.md) for the security policy.

## License

See [LICENSE](LICENSE).
