#!/usr/bin/env python3
"""Fully rebalance Lege Lux Project 3 within each milestone.

For every milestone:
- The highest-ranked 2 active issues become Now.
- The next 4 active issues become Next.
- Remaining active issues become Someday.

Closed repository issues become Done. Issues moved directly to Done in the
Project remain Done. A repository issue reopened by the triggering event
returns to the active queue.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from collections import defaultdict
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
NO_MILESTONE = "(No Milestone)"

LABEL_PRIORITY = {
    "security": 180,
    "bug": 160,
    "performance": 140,
    "accessibility": 120,
    "pwa": 100,
    "offline": 100,
}

TITLE_PRIORITY = (
    (re.compile(r"\bsecurity\b", re.IGNORECASE), 180),
    (re.compile(r"\bbug\b", re.IGNORECASE), 160),
    (re.compile(r"\bperf(?:ormance)?\b", re.IGNORECASE), 140),
    (re.compile(r"\b(?:a11y|accessibility)\b", re.IGNORECASE), 120),
    (re.compile(r"\b(?:pwa|offline)\b", re.IGNORECASE), 100),
)

URGENT_PATTERN = re.compile(
    r"\b(urgent|critical|blocker|data loss|security vulnerability|regression)\b",
    re.IGNORECASE,
)

STATUS_CONTINUITY = {
    "Now": 40,
    "Next": 20,
    "Someday": 0,
    None: 0,
}


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
                milestone=(issue.get("milestone") or {}).get("title") or NO_MILESTONE,
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
    score = sum(LABEL_PRIORITY.get(label, 0) for label in issue.labels)
    score += STATUS_CONTINUITY.get(issue.status, 0)

    for pattern, value in TITLE_PRIORITY:
        if pattern.search(issue.title):
            score += value

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
    by_milestone: dict[str, list[ProjectIssue]] = defaultdict(list)
    for issue in active_issues:
        by_milestone[issue.milestone].append(issue)

    desired: dict[int, str] = {}

    for milestone, milestone_issues in sorted(by_milestone.items()):
        ranked = sorted(milestone_issues, key=priority_key)

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
        f'[{issue.milestone}; {reason}] {issue.title}'
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


def print_milestone_totals(issues: list[ProjectIssue]) -> None:
    grouped: dict[str, dict[str, int]] = defaultdict(
        lambda: {"Now": 0, "Next": 0, "Someday": 0, "Done": 0}
    )

    for issue in issues:
        if issue.status in ALL_STATUSES:
            grouped[issue.milestone][issue.status] += 1

    print("\nPer-milestone totals:")
    for milestone in sorted(grouped):
        counts = grouped[milestone]
        print(
            f"  {milestone}: "
            f'Now={counts["Now"]}, '
            f'Next={counts["Next"]}, '
            f'Someday={counts["Someday"]}, '
            f'Done={counts["Done"]}'
        )


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
        f"Now capacity per milestone: {NOW_CAPACITY}\n"
        f"Next capacity per milestone: {NEXT_CAPACITY}\n"
        f"Dry run: {DRY_RUN}\n"
        f"Trigger action: {TRIGGER_ACTION or '(none)'}\n"
        "Mode: full rebalance inside every milestone\n"
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

    # Open items intentionally marked Done remain completed and are excluded.
    active_issues = [
        issue
        for issue in issues
        if issue.state == "OPEN" and issue.status != "Done"
    ]
    desired = desired_active_statuses(active_issues)

    for issue in sorted(active_issues, key=lambda value: (value.milestone, value.number)):
        set_status(
            project["id"],
            status_field["id"],
            options,
            issue,
            desired[issue.number],
            "per-milestone rebalance",
            changes,
        )

    print_milestone_totals(issues)

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

    grouped_active: dict[str, list[ProjectIssue]] = defaultdict(list)
    for issue in refreshed_active:
        grouped_active[issue.milestone].append(issue)

    for milestone, milestone_issues in grouped_active.items():
        now_count = sum(issue.status == "Now" for issue in milestone_issues)
        next_count = sum(issue.status == "Next" for issue in milestone_issues)

        if now_count > NOW_CAPACITY or next_count > NEXT_CAPACITY:
            print(
                f"CAPACITY ERROR {milestone}: "
                f"Now={now_count}, Next={next_count}",
                file=sys.stderr,
            )
            unresolved.extend(milestone_issues)

    if unresolved:
        seen: set[int] = set()
        for issue in unresolved:
            if issue.number in seen:
                continue
            seen.add(issue.number)
            expected = refreshed_desired.get(issue.number, "Done")
            print(
                f'UNRESOLVED #{issue.number}: milestone={issue.milestone!r} '
                f'state={issue.state} status={issue.status!r} '
                f'expected={expected!r} title={issue.title}',
                file=sys.stderr,
            )
        raise SystemExit(f"{len(seen)} project item(s) failed verification.")

    print(
        f"\nApplied {len(changes)} change(s). "
        "Every milestone now has at most 2 Now and at most 4 Next issues."
    )


if __name__ == "__main__":
    main()
