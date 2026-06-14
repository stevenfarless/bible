#!/usr/bin/env python3
"""Keep Lege Lux Project 3 supplied with Now and Next work.

Behavior:
- Closed repository issues are moved to Done.
- Issues moved directly to Done in the Project remain Done.
- Reopened repository issues return to the active queue.
- Blank or invalid open statuses are normalized to Someday.
- Vacancies in Now are filled from Next.
- Vacancies in Next are filled from Someday.
- Existing excess items are never demoted automatically.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from dataclasses import dataclass
from typing import Any

from assign_project_statuses import MUTATION, current_status, fetch_project, graphql

OWNER = os.getenv("PROJECT_OWNER", "stevenfarless")
PROJECT_NUMBER = int(os.getenv("PROJECT_NUMBER", "3"))
REPOSITORY = os.getenv("REPOSITORY", "stevenfarless/lege-lux")
NOW_CAPACITY = int(os.getenv("NOW_CAPACITY", "2"))
NEXT_CAPACITY = int(os.getenv("NEXT_CAPACITY", "4"))
DRY_RUN = os.getenv("DRY_RUN", "0") != "0"
TRIGGER_ACTION = os.getenv("TRIGGER_ACTION", "")
TRIGGER_ISSUE_NUMBER = os.getenv("TRIGGER_ISSUE_NUMBER", "")

OPEN_STATUSES = {"Now", "Next", "Someday"}
ALL_STATUSES = OPEN_STATUSES | {"Done"}

MILESTONE_PRIORITY = {
    "Critical Performance (CWV)": 1000,
    "Bug Fixes": 950,
    "Security & Privacy": 900,
    "Offline & PWA": 850,
    "Accounts & Sync": 800,
    "Performance & Search": 750,
    "Accessibility": 700,
    "Testing & Developer Experience": 650,
    "UI & Responsive": 600,
    "Bible Text & Rendering": 550,
    "Text Layout & Display": 500,
    "Translations & Refactoring": 450,
    "Reading Features": 400,
    "User Features": 350,
    "Translation Expansion": 300,
    "Greek & Hebrew Texts": 250,
    "UI Overhaul & Source Texts": 200,
    "Repo Hygiene (no tag)": 150,
    "json-ver Stability": 100,
    "Backlog": 0,
}

LABEL_PRIORITY = {
    "security": 180,
    "bug": 160,
    "performance": 140,
    "accessibility": 120,
    "pwa": 100,
    "offline": 100,
}

URGENT_PATTERN = re.compile(
    r"\b(urgent|critical|blocker|data loss|security vulnerability|regression)\b",
    re.IGNORECASE,
)


@dataclass
class ProjectIssue:
    item_id: str
    number: int
    title: str
    state: str
    milestone: str
    labels: set[str]
    status: str | None
    original_status: str | None


def parse_issues(items: list[dict[str, Any]]) -> list[ProjectIssue]:
    parsed: list[ProjectIssue] = []

    for item in items:
        issue = item.get("content")
        if not issue:
            continue
        if issue.get("repository", {}).get("nameWithOwner") != REPOSITORY:
            continue

        status = current_status(item)
        parsed.append(
            ProjectIssue(
                item_id=item["id"],
                number=issue["number"],
                title=issue["title"],
                state=issue.get("state", "").upper(),
                milestone=(issue.get("milestone") or {}).get("title", ""),
                labels={
                    node["name"].strip().lower()
                    for node in issue.get("labels", {}).get("nodes", [])
                    if node and node.get("name")
                },
                status=status,
                original_status=status,
            )
        )

    return parsed


def priority_key(issue: ProjectIssue) -> tuple[int, int]:
    searchable = " ".join([issue.title, *sorted(issue.labels)])
    score = MILESTONE_PRIORITY.get(issue.milestone, 0)
    score += sum(LABEL_PRIORITY.get(label, 0) for label in issue.labels)

    if URGENT_PATTERN.search(searchable):
        score += 2000

    if issue.original_status == "Done" and issue.state == "OPEN":
        score += 1000

    return (-score, issue.number)


def is_triggered_reopen(issue: ProjectIssue) -> bool:
    return (
        TRIGGER_ACTION == "reopened"
        and TRIGGER_ISSUE_NUMBER.isdigit()
        and issue.number == int(TRIGGER_ISSUE_NUMBER)
    )


def set_status(
    project_id: str,
    field_id: str,
    options: dict[str, str],
    issue: ProjectIssue,
    target: str,
    reason: str,
    changes: list[str],
) -> None:
    if issue.status == target:
        return

    action = "WOULD SET" if DRY_RUN else "SET"
    line = (
        f'{action:<9} #{issue.number:<4} '
        f'{issue.status or "(blank)":<9} -> {target:<7} '
        f'[{reason}] {issue.title}'
    )
    print(line)
    changes.append(line)

    if not DRY_RUN:
        graphql(
            MUTATION,
            {
                "projectId": project_id,
                "itemId": issue.item_id,
                "fieldId": field_id,
                "optionId": options[target],
            },
        )

    issue.status = target


def main() -> None:
    subprocess.run(["gh", "auth", "status"], check=True)

    project, raw_items = fetch_project()
    fields = [node for node in project["fields"]["nodes"] if node]
    status_field = next(
        (field for field in fields if field.get("name") == "Status"),
        None,
    )

    if status_field is None:
        raise SystemExit('Project has no single-select field named "Status".')

    options = {option["name"]: option["id"] for option in status_field["options"]}
    missing = ALL_STATUSES - options.keys()
    if missing:
        raise SystemExit(
            "Missing required Status options: " + ", ".join(sorted(missing))
        )

    issues = parse_issues(raw_items)
    changes: list[str] = []

    print(
        f'Project: {project["title"]} ({OWNER} project {PROJECT_NUMBER})\n'
        f"Repository: {REPOSITORY}\n"
        f"Now capacity: {NOW_CAPACITY}\n"
        f"Next capacity: {NEXT_CAPACITY}\n"
        f"Dry run: {DRY_RUN}\n"
        f"Trigger action: {TRIGGER_ACTION or '(none)'}\n"
    )

    for issue in sorted(issues, key=lambda value: value.number):
        if issue.state == "CLOSED":
            set_status(
                project["id"],
                status_field["id"],
                options,
                issue,
                "Done",
                "issue closed",
                changes,
            )
        elif issue.status == "Done" and is_triggered_reopen(issue):
            set_status(
                project["id"],
                status_field["id"],
                options,
                issue,
                "Someday",
                "issue reopened",
                changes,
            )
        elif issue.status not in ALL_STATUSES:
            set_status(
                project["id"],
                status_field["id"],
                options,
                issue,
                "Someday",
                "normalize open issue",
                changes,
            )

    active_issues = [
        issue
        for issue in issues
        if issue.state == "OPEN" and issue.status in OPEN_STATUSES
    ]

    now_items = [issue for issue in active_issues if issue.status == "Now"]
    next_items = [issue for issue in active_issues if issue.status == "Next"]

    now_slots = max(0, NOW_CAPACITY - len(now_items))
    if now_slots:
        for issue in sorted(next_items, key=priority_key)[:now_slots]:
            set_status(
                project["id"],
                status_field["id"],
                options,
                issue,
                "Now",
                "fill Now vacancy",
                changes,
            )

    next_items = [issue for issue in active_issues if issue.status == "Next"]
    next_slots = max(0, NEXT_CAPACITY - len(next_items))
    if next_slots:
        someday_candidates = [
            issue for issue in active_issues if issue.status == "Someday"
        ]
        for issue in sorted(someday_candidates, key=priority_key)[:next_slots]:
            set_status(
                project["id"],
                status_field["id"],
                options,
                issue,
                "Next",
                "fill Next vacancy",
                changes,
            )

    totals = {
        name: sum(1 for issue in issues if issue.status == name)
        for name in ("Now", "Next", "Someday", "Done")
    }

    print("\nResulting project totals:")
    for name in ("Now", "Next", "Someday", "Done"):
        print(f"  {name}: {totals[name]}")

    if totals["Now"] > NOW_CAPACITY:
        print(
            f'WARNING: Now contains {totals["Now"]} items; '
            f"capacity is {NOW_CAPACITY}. No automatic demotion was performed."
        )

    if totals["Next"] > NEXT_CAPACITY:
        print(
            f'WARNING: Next contains {totals["Next"]} items; '
            f"capacity is {NEXT_CAPACITY}. No automatic demotion was performed."
        )

    if DRY_RUN:
        print(f"\nPreview complete. {len(changes)} change(s) would be made.")
        return

    _, refreshed_raw_items = fetch_project()
    refreshed = parse_issues(refreshed_raw_items)
    unresolved = []

    for issue in refreshed:
        if issue.state == "CLOSED" and issue.status != "Done":
            unresolved.append(issue)
        elif issue.state == "OPEN" and issue.status not in ALL_STATUSES:
            unresolved.append(issue)
        elif is_triggered_reopen(issue) and issue.status == "Done":
            unresolved.append(issue)

    if unresolved:
        for issue in unresolved:
            print(
                f'UNRESOLVED #{issue.number}: state={issue.state} '
                f'status={issue.status!r} title={issue.title}',
                file=sys.stderr,
            )
        raise SystemExit(f"{len(unresolved)} project item(s) failed verification.")

    print(f"\nApplied {len(changes)} change(s). Queue verification passed.")


if __name__ == "__main__":
    main()
