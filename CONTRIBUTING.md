# Contributing to Bible Web App

Thank you for your interest in contributing. This document covers everything you need to get started.

## Getting the Code

```bash
git clone https://github.com/stevenfarless/esv-bible.git
cd esv-bible
```

## Running Locally

The app uses ES modules, which require HTTP — opening `index.html` directly from the filesystem will not work.

```bash
npx serve .
# or
python -m http.server 8000
```

Then open `http://localhost:8000`. No API key or environment setup is required. All Bible text is served from local JSON files in `translations/`.

## Branch Workflow

| Branch | Role |
|--------|------|
| `json-ver` | Default branch. All development and PRs target here. |
| `main` | Stable release snapshots. Promoted from `json-ver` at release time only. |

**Never branch from `main` or the retired `dev` branch.** Always branch from `json-ver`:

```bash
git checkout json-ver
git pull
git checkout -b feature/your-feature-name
```

Open your PR targeting `json-ver`. GitHub Actions deploys automatically on merge.

## Commit Message Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/) style:

```
<type>: <short summary>

[optional body]
[optional footer: Closes #issue]
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

Examples:
- `feat: add bookmarks panel to sidebar`
- `fix: resolve verse highlight not clearing on chapter change`
- `docs: update README branch strategy section`

## What Makes a PR Ready for Review

- Targets `json-ver` (not `main`)
- Scoped to a single concern — one bug fix or one feature per PR
- Includes a description of what changed and why
- Manually tested across at least Chrome and Firefox (desktop + mobile if relevant)
- No unrelated formatting or whitespace changes mixed in
- References the related issue (e.g., `Closes #42`) in the PR description

## Testing Changes

The project currently relies on manual testing. Before opening a PR, verify:

- Navigation between books, chapters, and verses works correctly
- Search returns expected results and pagination behaves
- Theme switching and verse highlighting are not broken
- Translation switching (ESV ↔ KJV) works if your change touches translation loading
- The app loads without console errors on a clean cache

## Finding Work

Browse open issues at https://github.com/stevenfarless/esv-bible/issues. Comment on an issue before starting work on it to avoid duplication.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). All contributors are expected to uphold it.
