import json
import os
import re
import urllib.error
import urllib.request


REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "stevenfarless/lege-lux")
TOKEN = os.environ["GITHUB_TOKEN"]
API_ROOT = f"https://api.github.com/repos/{REPOSITORY}"

CATEGORIES = [
    {
        "key": "accessibility",
        "title": "Accessibility",
        "description": "Accessibility, touch-target, semantic, contrast, and assistive-technology work.",
        "aliases": ["accessibility", "a11y"],
        "terms": ["accessibility", "a11y", "aria", "contrast", "screen reader", "target size", "keyboard focus"],
    },
    {
        "key": "performance",
        "title": "Performance & Reliability",
        "description": "Runtime performance, loading, rendering stability, reliability, and diagnostics.",
        "aliases": ["performance", "reliability", "lighthouse", "web vitals"],
        "terms": ["performance", "perf:", "lcp", "cls", "tbt", "render-blocking", "lazy-load", "layout shift", "timeout", "memory", "worker"],
    },
    {
        "key": "offline",
        "title": "Offline & PWA",
        "description": "Service worker, caching, offline behavior, installation, and PWA delivery.",
        "aliases": ["offline", "pwa", "service worker", "cache"],
        "terms": ["service worker", "offline", "pwa", "app shell", "precache", "cache storage", "installed translation", "manifest", "sw.js", "feat(sw)", "chore(sw)"],
    },
    {
        "key": "accounts",
        "title": "Accounts & Sync",
        "description": "Authentication, Firebase, account state, entitlement, and settings synchronization.",
        "aliases": ["accounts", "authentication", "auth", "sync", "firebase"],
        "terms": ["firebase", "auth", "sign in", "signed-in", "account", "sync settings", "recaptcha", "entitlement"],
    },
    {
        "key": "original-languages",
        "title": "Original Languages",
        "description": "Greek, Hebrew, manuscript traditions, interlinear text, and original-language display modes.",
        "aliases": ["original languages", "greek", "hebrew", "manuscript"],
        "terms": ["greek", "hebrew", "septuagint", "lxx", "interlinear", "textus receptus", "byzantine", "alexandrian", "uncial", "scriptio continua", "manuscript tradition"],
    },
    {
        "key": "translations",
        "title": "Translations & Text Delivery",
        "description": "Translation support, downloads, bundles, metadata, licensing, and delivery systems.",
        "aliases": ["translations", "translation", "text delivery"],
        "terms": ["translation", "download translation", "premium translation", "bundle delivery", "meta.json", "usfm", "epub"],
    },
    {
        "key": "bible-rendering",
        "title": "Bible Text & Rendering",
        "description": "Bible text rendering, poetry, headings, paratext, verses, chapters, and passage presentation.",
        "aliases": ["bible text", "rendering", "paratext", "scripture"],
        "terms": ["paratext", "poetry", "verse", "chapter", "pericope", "footnote", "cross-reference", "cross reference", "heading", "passage text", "scripture rendering"],
    },
    {
        "key": "reading-features",
        "title": "Reading Features",
        "description": "Reading plans, bookmarks, focus modes, continuous reading, and reader customization.",
        "aliases": ["reading features", "reader", "reading"],
        "terms": ["reading plan", "bookmark", "focus mode", "continuous scroll", "text display", "line spacing", "letter spacing", "column width", "reading setting"],
    },
    {
        "key": "search-navigation",
        "title": "Search & Navigation",
        "description": "Search, book and chapter navigation, sticky navigation, and passage discovery.",
        "aliases": ["search", "navigation", "book picker"],
        "terms": ["search", "book picker", "book modal", "navigation", "sticky header", "chapter arrows", "deep link", "reference search"],
    },
    {
        "key": "ui-ux",
        "title": "UI & UX",
        "description": "Visual design, modals, controls, themes, settings layout, animation, and interaction polish.",
        "aliases": ["ui", "ux", "design", "interface", "visual polish"],
        "terms": ["modal", "settings", "theme", "font size", "corner radius", "button", "animation", "layout", "bottom sheet", "chrome", "color", "visual", "appearance"],
    },
    {
        "key": "testing-dev",
        "title": "Testing & Developer Experience",
        "description": "Tests, CI, workflows, refactors, diagnostics, maintainability, and developer tooling.",
        "aliases": ["testing", "developer experience", "ci", "maintenance", "technical debt"],
        "terms": ["test", "smoke", "playwright", "workflow", "github actions", "refactor", "codeql", "lint", "diagnostic", "maintainability", "custom property naming"],
    },
    {
        "key": "security",
        "title": "Security & Privacy",
        "description": "Security headers, privacy, hardening, and abuse-resistance work.",
        "aliases": ["security", "privacy", "hardening"],
        "terms": ["security", "csp", "hsts", "coop", "xss", "prototype pollution", "privacy"],
    },
    {
        "key": "backlog",
        "title": "Backlog & Triage",
        "description": "Open work that does not yet fit a more specific delivery milestone.",
        "aliases": ["backlog", "triage", "miscellaneous"],
        "terms": [],
    },
]


def request(method: str, path: str, payload=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{API_ROOT}{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "lege-lux-milestone-assignment",
        },
    )
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else None
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8")
        raise SystemExit(f"GitHub API {method} {path} failed: {error.code} {detail}") from error


def paginate(path: str):
    page = 1
    while True:
        separator = "&" if "?" in path else "?"
        items = request("GET", f"{path}{separator}per_page=100&page={page}")
        if not items:
            return
        yield from items
        if len(items) < 100:
            return
        page += 1


def normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def category_score(category, issue) -> int:
    title = issue.get("title", "").lower()
    labels = " ".join(label.get("name", "") for label in issue.get("labels", [])).lower()
    body = (issue.get("body") or "").lower()
    score = 0
    for term in category["terms"]:
        if term in title:
            score += 8
        if term in labels:
            score += 6
        if term in body:
            score += 1
    return score


def classify(issue):
    scored = [(category_score(category, issue), index, category) for index, category in enumerate(CATEGORIES[:-1])]
    score, _, category = max(scored, key=lambda item: (item[0], -item[1]))
    return category if score > 0 else CATEGORIES[-1]


def milestone_match_score(category, milestone) -> int:
    title = normalize(milestone["title"])
    desired = normalize(category["title"])
    if title == desired:
        return 100
    score = 0
    for alias in category["aliases"]:
        normalized_alias = normalize(alias)
        if normalized_alias and normalized_alias in title:
            score = max(score, 50 + len(normalized_alias))
    desired_words = set(desired.split())
    title_words = set(title.split())
    score += 5 * len(desired_words & title_words)
    return score


def get_or_create_milestone(category, milestones):
    ranked = sorted(
        ((milestone_match_score(category, milestone), milestone) for milestone in milestones),
        key=lambda item: item[0],
        reverse=True,
    )
    if ranked and ranked[0][0] >= 15:
        return ranked[0][1]

    created = request(
        "POST",
        "/milestones",
        {
            "title": category["title"],
            "description": category["description"],
            "state": "open",
        },
    )
    milestones.append(created)
    print(f"Created milestone #{created['number']}: {created['title']}")
    return created


def main():
    milestones = list(paginate("/milestones?state=open"))
    issues = [
        issue
        for issue in paginate("/issues?state=open&milestone=none")
        if "pull_request" not in issue
    ]

    if not issues:
        print("No open unmilestoned issues found.")
        return

    category_milestones = {}
    assignments = []

    for issue in issues:
        category = classify(issue)
        if category["key"] not in category_milestones:
            category_milestones[category["key"]] = get_or_create_milestone(category, milestones)
        milestone = category_milestones[category["key"]]
        request("PATCH", f"/issues/{issue['number']}", {"milestone": milestone["number"]})
        assignments.append((issue["number"], issue["title"], milestone["title"]))
        print(f"Assigned #{issue['number']} to {milestone['title']}: {issue['title']}")

    summary = {}
    for _, _, milestone_title in assignments:
        summary[milestone_title] = summary.get(milestone_title, 0) + 1

    print("\nAssignment summary:")
    for milestone_title, count in sorted(summary.items()):
        print(f"- {milestone_title}: {count}")
    print(f"Total assigned: {len(assignments)}")


if __name__ == "__main__":
    main()
