# Contributing

> This file was moved from the root to `docs/CONTRIBUTING.md`. Update any bookmarks.

## Local Setup

1. Clone the repo and check out `json-ver`
2. Open `index.html` in a browser (use a local server to avoid CORS issues with JSON fetches)
3. Run `npx serve .` or use VS Code Live Server

## Branch Workflow

- `json-ver` is the main development and deployment branch
- Feature branches should be named `feat/<description>`
- Bug fix branches: `fix/<description>`

## PR Standards

- Title must follow Conventional Commits format
- Include a description of what changed and why
- Reference any related issues

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `chore:` maintenance/tooling
- `refactor:` code restructure without behavior change
- `docs:` documentation only
