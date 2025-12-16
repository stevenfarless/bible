# ESV Bible Web App

A single-page ESV Bible reader focused on speed, readability, and a distraction-free experience. Built with vanilla JavaScript, HTML, and CSS, and deployed via GitHub Pages.

## Live Site

- https://stevenfarless.github.io/esv-bible/

## Features

- Browse by book, chapter, and verse
- Search for passages or keywords
- Per-verse highlighting with glow effects
- Light and dark themes
- Mobile-friendly layout

## Tech Stack

- **Language:** Vanilla JavaScript, HTML5, CSS3
- **Build/Hosting:** GitHub Pages
- **CI/CD:** GitHub Actions (auto-deploy from `main`)

## Branch Strategy

- `main` – stable, production-ready code
- `dev` – active development
- `glowfix` – recent bugfix work on highlighting/glow behavior

Most work should happen on topic branches off `dev`, then merged into `dev` via PR, and promoted to `main` when stable.

## Getting Started

### Prerequisites

- A modern browser (Chrome, Firefox, Safari, Edge)
- Optionally: `git` installed locally if you want to clone the repo

### Clone & Run Locally

```bash
git clone https://github.com/stevenfarless/esv-bible.git
cd esv-bible
# use a simple static server of your choice
npx serve .
# or
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

Because this is a static app, any static file server works (VS Code Live Server, `serve`, etc.).

## Development Workflow

1. Create a branch from `dev` for your change:
   ```bash
   git checkout dev
   git pull
   git checkout -b feature/your-feature-name
   ```
2. Make your changes and commit with clear, conventional-style messages.
3. Push your branch and open a Pull Request into `dev`.
4. Once validated, merge `dev` into `main` when you are ready to ship.

GitHub Actions will automatically build and deploy `main` to GitHub Pages.

## Releasing

Releases are managed using semantic-style tags (e.g. `v0.1.0`). Use tags to mark meaningful milestones and keep the changelog in the GitHub Releases UI.

Suggested release flow:

1. Ensure `main` is green and deployed.
2. Create a tag and push it:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
3. Draft a GitHub Release using the tag and summarize the changes.

## Testing

This project currently relies on manual testing:

- Cross-browser checks on desktop and mobile
- Navigation between books/chapters/verses
- Search correctness and result navigation
- Theme switching and verse highlighting behavior

Future improvements:

- Add automated smoke tests using Playwright or Cypress
- Add lightweight unit tests for core parsing/highlighting logic

## Contributing

1. Check open issues: https://github.com/stevenfarless/esv-bible/issues
2. Comment on an issue youd like to tackle or open a new one.
3. Follow the Development Workflow above.
4. Use clear commit messages and keep PRs focused on a single concern.

A future improvement is to add a `CONTRIBUTING.md` file and issue/PR templates to better guide contributions.

## Roadmap (from Issues)

Planned/desired features include:

- Settings modal accordion
- Better poetry/wisdom verse highlighting
- Search result selection that jumps directly to the verse
- Auto-hide header/nav on scrollAdd project README for dev branch
- Footnotes in a modal instead of only at the bottom
- Additional translations (e.g., KJV)
- Per-verse notes, highlights, bookmarks, and favorites
- User-defined tags for verses

For details, see the open issues in GitHub.

## Security

No authentication or user data is currently stored server-side. Future steps to harden security and transparency:

- Add a SECURITY policy (responsible disclosure instructions)
- Enable Dependabot and basic code scanning

## License

License information is not yet defined. Adding a clear open-source license (such as MIT) is recommended so others know how they can use and contribute to the project.
