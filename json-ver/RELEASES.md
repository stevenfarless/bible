# Release Process

This document defines the versioning scheme, milestone-to-release mapping, and the steps to cut a release. It is the authoritative reference for when and how to tag.

---

## Versioning Scheme

This project uses [Semantic Versioning](https://semver.org): `vMAJOR.MINOR.PATCH`.

- **MAJOR** stays `0` until the app is stable, auth-gated translations are working, and it is suitable for general use. That threshold is `v1.0.0`.
- **MINOR** increments for each milestone that ships a new user-facing capability.
- **PATCH** is reserved for hotfixes between milestone releases (e.g., `v0.1.1` for a critical bug found after `v0.1.0` ships).
- All releases before `v1.0.0` are marked **pre-release** on GitHub.

### Note on pre-v0.1.0 history

Releases `v0.0.1` through `v0.0.17` (Dec 2025) used the ESV API. Releases `v0.0.1-json-alpha` through `v0.0.10-json-alpha` (May 2026) were the initial json-ver era. Those tags are preserved as-is. The first release under this scheme is `v0.1.0`.

---

## Rule: One Milestone = One Release

Each GitHub milestone maps to one release tag when all its issues are closed.

**Exception:** Milestones whose issues are entirely internal (repo hygiene, CI, security tooling, DevX) with no user-facing changes do **not** get their own release tag. Their work is folded into the next feature milestone's release.

---

## Milestone → Tag Mapping

| # | Milestone | Tag | Notes |
|---|---|---|---|
| 3 | v1.0 – json-ver Stability | `v0.1.0` | Combined with M4 |
| 4 | v1.0 – UI & Responsive | `v0.1.0` | Combined with M3 |
| 5 | v1.1 – Repo Hygiene | *(no tag)* | Fold into `v0.1.0` — no user-facing changes |
| 6 | v1.1 – Text Layout & Display | `v0.2.0` | |
| 7 | v1.2 – Greek & Hebrew Texts | `v0.3.0` | |
| 8 | v1.3 – Translation Expansion | `v0.4.0` | |
| — | Personal Study (Bookmarks, Notes, Tags, Profiles) | `v0.5.0` | Future milestone |
| — | Stable: auth-gated translations + full test coverage | `v1.0.0` | Full release, not pre-release |

---

## Steps to Cut a Release

1. **Confirm all milestone issues are closed.** On GitHub → Issues → Milestones, the milestone should show 0 open issues.
2. **Update the changelog.** Draft release notes following the template below.
3. **Create the release on GitHub:**
   - Go to Releases → Draft a new release
   - Tag: `vX.Y.Z` targeting `main` (after merging `json-ver` → `main`)
   - Mark as **Pre-release** for all `v0.x.x` releases
   - Paste the release body
4. **Close the milestone** on GitHub → Issues → Milestones.
5. **Open the next milestone** if it does not already exist.

---

## Release Body Template

```markdown
## vX.Y.Z — Month YYYY

### What's new
- Short description of each user-facing change, grouped by feature area

### Bug fixes
- Short description of each bug fixed (#issue-number)

### Internal
- Any non-user-facing changes worth noting (CI, deps, tooling)

**Milestone closed:** [Milestone name](link-to-milestone)
**Full changelog:** https://github.com/stevenfarless/esv-bible/compare/vPREV...vNEXT
```

---

## Hotfix Process

If a critical bug is found after a milestone release:

1. Fix on `json-ver`, open a PR to `main`
2. Tag as `vX.Y.Z+1` (e.g., `v0.1.1` after `v0.1.0`)
3. Release body should reference the bug issue number and the original release it affects
4. No milestone is required for a hotfix release
