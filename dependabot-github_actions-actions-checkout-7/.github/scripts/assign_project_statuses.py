#!/usr/bin/env python3
"""Assign statuses to open Lege Lux issues in GitHub Project 3.

Defaults to a dry run and preserves existing Now/Next/Someday values.

Preview:
    python3 .github/scripts/assign_project_statuses.py

Apply to blank or invalid open statuses:
    DRY_RUN=0 python3 .github/scripts/assign_project_statuses.py

Reclassify every open issue, including those with an existing valid status:
    DRY_RUN=0 OVERWRITE_EXISTING=1 python3 .github/scripts/assign_project_statuses.py
"""

import json
import os
import re
import subprocess
import sys
from collections import Counter

OWNER = os.getenv("PROJECT_OWNER", "stevenfarless")
PROJECT_NUMBER = int(os.getenv("PROJECT_NUMBER", "3"))
REPOSITORY = os.getenv("REPOSITORY", "stevenfarless/lege-lux")
DRY_RUN = os.getenv("DRY_RUN", "1") != "0"
OVERWRITE_EXISTING = os.getenv("OVERWRITE_EXISTING", "0") == "1"

NOW_MILESTONES = {
    "Critical Performance (CWV)",
    "Bug Fixes",
}

NEXT_MILESTONES = {
    "Offline & PWA",
    "Performance & Search",
    "Testing & Developer Experience",
    "Accounts & Sync",
    "Accessibility",
    "Security & Privacy",
    "UI & Responsive",
    "Text Layout & Display",
    "Translations & Refactoring",
    "Bible Text & Rendering",
}

SOMEDAY_MILESTONES = {
    "Greek & Hebrew Texts",
    "Translation Expansion",
    "User Features",
    "Reading Features",
    "UI Overhaul & Source Texts",
    "Backlog",
    "Repo Hygiene (no tag)",
    "json-ver Stability",
}

VALID_OPEN_STATUSES = {"Now", "Next", "Someday"}
REQUIRED_OPTIONS = VALID_OPEN_STATUSES | {"Done"}

QUERY = """
query($login: String!, $number: Int!, $cursor: String) {
  user(login: $login) {
    projectV2(number: $number) {
      id
      title
      fields(first: 100) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
            }
          }
        }
      }
      items(first: 100, after: $cursor) {
        nodes {
          id
          fieldValues(first: 100) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field {
                  ... on ProjectV2SingleSelectField {
                    name
                  }
                }
              }
            }
          }
          content {
            ... on Issue {
              number
              title
              url
              state
              repository {
                nameWithOwner
              }
              milestone {
                title
              }
              labels(first: 30) {
                nodes {
                  name
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
}
"""

MUTATION = """
mutation(
  $projectId: ID!,
  $itemId: ID!,
  $fieldId: ID!,
  $optionId: String!
) {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: $projectId,
      itemId: $itemId,
      fieldId: $fieldId,
      value: {singleSelectOptionId: $optionId}
    }
  ) {
    projectV2Item {
      id
    }
  }
}
"""


def graphql(query, variables):
    payload = json.dumps({"query": query, "variables": variables})
    result = subprocess.run(
        ["gh", "api", "graphql", "--input", "-"],
        input=payload,
        text=True,
        capture_output=True,
    )

    if result.returncode != 0:
        print(result.stderr.strip(), file=sys.stderr)
        raise SystemExit(result.returncode)

    response = json.loads(result.stdout)
    if response.get("errors"):
        print(json.dumps(response["errors"], indent=2), file=sys.stderr)
        raise SystemExit(1)

    return response["data"]


def fetch_project():
    cursor = None
    project = None
    items = []

    while True:
        data = graphql(
            QUERY,
            {
                "login": OWNER,
                "number": PROJECT_NUMBER,
                "cursor": cursor,
            },
        )
        current = data.get("user", {}).get("projectV2")

        if current is None:
            raise SystemExit(
                f"Project {OWNER}/{PROJECT_NUMBER} was not found or is not accessible."
            )

        if project is None:
            project = current

        page = current["items"]
        items.extend(page["nodes"])

        if not page["pageInfo"]["hasNextPage"]:
            break

        cursor = page["pageInfo"]["endCursor"]

    return project, items


def current_status(item):
    for value in item.get("fieldValues", {}).get("nodes", []):
        if not value:
            continue

        field = value.get("field") or {}
        if field.get("name") == "Status":
            return value.get("name")

    return None


def classify(issue, existing):
    if issue["state"].upper() != "OPEN":
        return None

    if not OVERWRITE_EXISTING and existing in VALID_OPEN_STATUSES:
        return existing

    milestone = (issue.get("milestone") or {}).get("title", "")
    labels = {
        node["name"].strip().lower()
        for node in issue.get("labels", {}).get("nodes", [])
        if node and node.get("name")
    }
    searchable = " ".join([issue.get("title", ""), *sorted(labels)]).lower()

    if milestone in NOW_MILESTONES:
        return "Now"

    if re.search(
        r"\b(urgent|critical|blocker|data loss|security vulnerability|regression)\b",
        searchable,
    ):
        return "Now"

    if milestone in NEXT_MILESTONES:
        return "Next"

    if labels & {
        "bug",
        "performance",
        "accessibility",
        "security",
        "pwa",
        "offline",
    }:
        return "Next"

    if milestone in SOMEDAY_MILESTONES:
        return "Someday"

    return "Someday"


def main():
    subprocess.run(["gh", "auth", "status"], check=True)

    project, items = fetch_project()
    fields = [node for node in project["fields"]["nodes"] if node]
    status_field = next(
        (field for field in fields if field.get("name") == "Status"),
        None,
    )

    if status_field is None:
        raise SystemExit('Project has no single-select field named "Status".')

    options = {option["name"]: option["id"] for option in status_field["options"]}
    missing = REQUIRED_OPTIONS - options.keys()

    if missing:
        raise SystemExit(
            "Missing required Status options: " + ", ".join(sorted(missing))
        )

    relevant = []
    for item in items:
        issue = item.get("content")
        if not issue:
            continue
        if issue.get("repository", {}).get("nameWithOwner") != REPOSITORY:
            continue
        if issue.get("state", "").upper() != "OPEN":
            continue
        relevant.append((item, issue))

    print(
        f'Project: {project["title"]} ({OWNER} project {PROJECT_NUMBER})\n'
        f"Repository: {REPOSITORY}\n"
        f"Open project issues found: {len(relevant)}\n"
        f"Dry run: {DRY_RUN}\n"
        f"Overwrite existing Now/Next/Someday: {OVERWRITE_EXISTING}\n"
    )

    counts = Counter()
    changes = 0

    for item, issue in sorted(relevant, key=lambda pair: pair[1]["number"]):
        existing = current_status(item)
        target = classify(issue, existing)

        if existing == target:
            counts[target] += 1
            print(
                f'KEEP   #{issue["number"]:<4} {target:<7} '
                f'{issue["title"]}'
            )
            continue

        changes += 1
        counts[target] += 1
        verb = "WOULD" if DRY_RUN else "SET"
        print(
            f'{verb:<6} #{issue["number"]:<4} '
            f'{existing or "(blank)":<9} -> {target:<7} '
            f'{issue["title"]}'
        )

        if not DRY_RUN:
            graphql(
                MUTATION,
                {
                    "projectId": project["id"],
                    "itemId": item["id"],
                    "fieldId": status_field["id"],
                    "optionId": options[target],
                },
            )

    print("\nFinal open-status totals:")
    for name in ("Now", "Next", "Someday"):
        print(f"  {name}: {counts[name]}")

    if DRY_RUN:
        print(
            f"\nPreview complete. {changes} item(s) would change.\n"
            "Apply with: DRY_RUN=0 python3 "
            ".github/scripts/assign_project_statuses.py"
        )
        return

    _, refreshed_items = fetch_project()
    unresolved = []

    for item in refreshed_items:
        issue = item.get("content")
        if not issue:
            continue
        if issue.get("repository", {}).get("nameWithOwner") != REPOSITORY:
            continue
        if issue.get("state", "").upper() != "OPEN":
            continue

        status = current_status(item)
        if status not in VALID_OPEN_STATUSES:
            unresolved.append((issue["number"], issue["title"], status))

    if unresolved:
        for number, title, status in unresolved:
            print(
                f'UNRESOLVED #{number}: status={status!r} title={title}',
                file=sys.stderr,
            )
        raise SystemExit(
            f"{len(unresolved)} open issue(s) still lack a valid status."
        )

    print(f"\nApplied {changes} change(s). Every open project issue has a status.")


if __name__ == "__main__":
    main()
