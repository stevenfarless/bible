#!/usr/bin/env python3
"""Fully rebalance Lege Lux Project 3.

Behavior:
- Closed repository issues are moved to Done.
- Issues moved directly to Done in the Project remain Done.
- Reopened repository issues return to the active queue.
- Every active open issue is ranked on every run.
- The highest-ranked 2 active issues become Now.
- The next 4 active issues become Next.
- All remaining active issues become Someday.

Ranking favors urgent/critical wording, milestone priority, useful labels,
and then the oldest issue number.
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


def parse_issues(items: list[dict[str, Any]]) -> list[ProjectIssue]:
    parsed: list[ProjectIssue] = []

    for item in items:
        issue = item.get("content")
        if not issue:
            continue
        if issue.get("repository", {}).get("nameWithOwner") != REPOSITORY:
            continue

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
                status=current_status(item),
            )
        )

    return parsed


def priority_key(issue: ProjectIssue) -> tuple[int, int]:
    searchable = " ".join([issue.title, *sorted(issue.labels)])
    score = MILESTONE_PRIORITY.get(issue.milestone, 0)
    score += sum(LABEL_PRIORITY.get(label, 0) for label in issue.labels)

    if URGENT_PATTERN.search(searchable):
        score += 2000

    return (-score, issue.number)


def is_triggered_reopen(issue: ProjectIssue) -> bool:
    return (
        TRIGGER_ACTION == "reopened"
        and TRIGGER_ISSUE_NUMBER.isdigit()
        and issue.number == int(TRIGGER_ISSUE_NUMBER)
    )


def desired_active_statuses(
    active_issues: list[ProjectIssue],
) -> dict[int, str]:
    ranked = sorted(active_issues, key=priority_key)
    desired: dict[int, str] = {}

    for index, issue in enumerate(ranked):
        if index < NOW_CAPACITY:
            desired[issue.number] = "Now"
        elif index < NOW_CAPACITY + NEXT_CAPACITY:
            desired[issue.number] = "Next"
        else:
            desired[issue.number] = "Someday"

    return desired


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
        "Mode: full rebalance of all current active statuses\n"
    )

    # Synchronize completion and reopening before ranking active work.
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

    # Open issues intentionally marked Done remain completed and are excluded.
    active_issues = [
        issue
        for issue in issues
        if issue.state == "OPEN" and issue.status != "Done"
    ]
    desired = desired_active_statuses(active_issues)

    for issue in sorted(active_issues, key=lambda value: value.number):
        target = desired[issue.number]
        set_status(
            project["id"],
            status_field["id"],
            options,
            issue,
            target,
            "full queue rebalance",
            changes,
        )

    totals = {
        name: sum(1 for issue in issues if issue.status == name)
        for name in ("Now", "Next", "Someday", "Done")
    }

    print("\nResulting project totals:")
    for name in ("Now", "Next", "Someday", "Done"):
        print(f"  {name}: {totals[name]}")

    expected_now = min(NOW_CAPACITY, len(active_issues))
    expected_next = min(
        NEXT_CAPACITY,
        max(0, len(active_issues) - expected_now),
    )

    if totals["Now"] != expected_now or totals["Next"] != expected_next:
        raise SystemExit(
            "Calculated queue totals are incorrect: "
            f'expected Now={expected_now}, Next={expected_next}; '
            f'got Now={totals["Now"]}, Next={totals["Next"]}'
        )

    if DRY_RUN:
        print(f"\nPreview complete. {len(changes)} change(s) would be made.")
        return

    _, refreshed_raw_items = fetch_project()
    refreshed = parse_issues(refreshed_raw_items)
    refreshed_active = [
        issue
        for issue in refreshed
        if issue.state == "OPEN" and issue.status != "Done"
    ]
    refreshed_desired = desired_active_statuses(refreshed_active)
    unresolved: list[ProjectIssue] = []

    for issue in refreshed:
        if issue.state == "CLOSED" and issue.status != "Done":
            unresolved.append(issue)
        elif issue.state == "OPEN" and issue.status not in ALL_STATUSES:
            unresolved.append(issue)
        elif is_triggered_reopen(issue) and issue.status == "Done":
            unresolved.append(issue)
        elif issue.number in refreshed_desired:
            if issue.status != refreshed_desired[issue.number]:
                unresolved.append(issue)

    if unresolved:
        for issue in unresolved:
            expected = refreshed_desired.get(issue.number, "Done")
            print(
                f'UNRESOLVED #{issue.number}: state={issue.state} '
                f'status={issue.status!r} expected={expected!r} '
                f'title={issue.title}',
                file=sys.stderr,
            )
        raise SystemExit(f"{len(unresolved)} project item(s) failed verification.")

    print(
        f"\nApplied {len(changes)} change(s). "
        "Every current active status was fully rebalanced."
    )


if __name__ == "__main__":
    main()
