# ESV Bible Web App

A single-page Bible reader focused on speed, readability, and a distraction-free experience. Built with vanilla JavaScript, HTML, and CSS, deployed via GitHub Pages. Bible text is served entirely from local JSON files — no external API required.

## Live Site

https://stevenfarless.github.io/esv-bible/

## Features

- Browse by book, chapter, and verse
- Search passages or keywords (client-side, full Bible)
- Per-verse highlighting with glow effects
- Light and dark themes with multiple color schemes
- Multiple translations (ESV, KJV) via local JSON files
- Mobile-friendly layout
- Reading position sync across devices via Firebase Auth

## How Bible Text Works

All verse content lives in `translations/` and is loaded at runtime via `fetch()` — no API key, no network dependency beyond the initial page load.

### File structure

```
translations/
└── ESV/
    └── ESV_books/
        ├── Genesis.json
        ├── Exodus.json
        └── ... (one file per book, 66 total)
```

Each book file has the shape:

```json
{
  "Genesis": {
    "1": {
      "1": "In the beginning, God created the heavens and the earth.",
      "2": "The earth was without form and void..."
    }
  }
}
```

Two filename overrides exist: `Psalms` maps to `Psalm.json` and `Song of Solomon` maps to `Song Of Solomon.json`.

Search runs entirely in the browser. On first search, all 66 book files are fetched in parallel and cached in memory. Subsequent searches and chapter navigation use the cache.

## Tech Stack

- **Language:** Vanilla JavaScript (ES modules), HTML5, CSS3
- **Data:** Local JSON translation files (`translations/`)
- **Auth/Sync:** Firebase Authentication + Realtime Database (optional — app works without sign-in)
- **Hosting:** GitHub Pages
- **CI/CD:** GitHub Actions (auto-deploy from `main`)

## Branch Strategy

- `main` — stable, production-ready
- `dev` — active development
- `json-ver` — local JSON translation source (replaces ESV API)

Work branches off `dev`, merged via PR, promoted to `main` when stable.

## Getting Started

### Prerequisites

- A modern browser (Chrome, Firefox, Safari, Edge)
- A static file server for local development (the app uses ES modules, which require HTTP — opening `index.html` directly from the filesystem won't work)

### Clone & Run Locally

```bash
git clone https://github.com/stevenfarless/esv-bible.git
cd esv-bible
npx serve .
# or
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser. No API key or environment setup required.

## Development Workflow

1. Branch from `dev`:
   ```bash
   git checkout dev
   git pull
   git checkout -b feature/your-feature-name
   ```
2. Commit with conventional-style messages.
3. Open a PR into `dev`.
4. Merge `dev` into `main` when ready to ship — GitHub Actions deploys automatically.

## Adding a Translation

1. Create a folder: `translations/{NAME}/{NAME}_books/`
2. Add one JSON file per book using the structure above.
3. Add a `<option value="{NAME}">` entry to `#translationSelector` in `index.html`.
4. Add a copyright string for `{NAME}` in `updateCopyright()` in `app.js`.

The `BibleApi` class in `bible-api.js` handles the rest automatically.

## Releasing

Releases use semantic-style tags (e.g. `v0.1.0`).

```bash
git tag v0.1.0
git push origin v0.1.0
```

Draft a GitHub Release using the tag and summarize the changes.

## Testing

Currently relies on manual testing:

- Cross-browser checks on desktop and mobile
- Navigation between books, chapters, and verses
- Search correctness and result pagination
- Theme switching and verse highlighting behavior
- Translation switching (ESV ↔ KJV)

Future improvements:

- Automated smoke tests via Playwright or Cypress
- Unit tests for `_parseReference` and search pagination logic in `bible-api.js`

## Contributing

1. Check open issues: https://github.com/stevenfarless/esv-bible/issues
2. Comment on an issue or open a new one.
3. Follow the Development Workflow above.
4. Keep PRs focused on a single concern.

## Roadmap

- Better poetry/wisdom verse formatting
- Search result selection jumping directly to the verse in context
- Per-verse notes, highlights, bookmarks, and favorites
- User-defined tags for verses
- Automated smoke tests

## Security

No user data is stored server-side beyond Firebase Auth (email/password) and Realtime Database (settings, reading position). The app works fully without signing in — Firebase is opt-in for sync only.
