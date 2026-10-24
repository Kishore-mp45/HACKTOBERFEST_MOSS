"""Create a deterministic, synthetic 30-document workspace for local demos."""

from __future__ import annotations

import argparse
from pathlib import Path

PROJECTS = {
    "cedar": {
        "topic": "Cedar product launch",
        "details": [
            "The design team reviewed the updated onboarding flow.",
            "The launch checklist tracks decisions from the weekly planning meeting.",
            "The team is comparing two options for the first-run experience.",
            "Release notes should explain the changes in plain language.",
            "Feedback from the pilot group is being collected for review.",
            "The support guide needs a short section about account setup.",
            "The product group agreed to keep the initial release focused.",
            "A follow-up meeting will review the pilot results.",
            "The team is organizing research notes before the launch.",
            "The onboarding work is coordinated across design and support.",
        ],
        "actions": [
            "TODO: Send the revised onboarding draft to the design team.",
            "Deadline: Review the launch checklist by November 6, 2026.",
            "TODO: Summarize pilot feedback for the product meeting.",
            None,
            "TODO: Prepare a short support guide for account setup.",
            None,
            "Deadline: Confirm the release notes by November 13, 2026.",
            None,
            "TODO: Share the research summary with the team.",
            None,
        ],
    },
    "harbor": {
        "topic": "Harbor community garden",
        "details": [
            "The north beds are being prepared for the winter planting plan.",
            "The volunteer group discussed water access and tool storage.",
            "The garden map records the current paths and shared beds.",
            "The compost area needs clearer signs for new volunteers.",
            "Seasonal notes describe which plants did well this year.",
            "The group is planning a small seed exchange for neighbors.",
            "The tool shed inventory was reviewed by the coordinators.",
            "The garden calendar includes community work sessions.",
            "The path between the beds should remain accessible.",
            "Volunteer notes are collected after each work session.",
        ],
        "actions": [
            "TODO: Ask volunteers to label the shared tools.",
            None,
            "Deadline: Update the garden map by November 8, 2026.",
            "TODO: Print clear signs for the compost area.",
            None,
            "TODO: Prepare a list of seeds for the exchange.",
            None,
            "Deadline: Publish the winter work calendar by November 15, 2026.",
            None,
            "TODO: Collect volunteer feedback after the next session.",
        ],
    },
    "orchard": {
        "topic": "Orchard finance planning",
        "details": [
            "The quarterly budget compares planned and actual expenses.",
            "The finance notes group invoices by project and month.",
            "The forecast includes expected maintenance costs.",
            "The team reviewed the process for recording reimbursements.",
            "Monthly totals are checked before the report is shared.",
            "The budget worksheet keeps a record of approved estimates.",
            "Finance meeting notes include questions about next quarter.",
            "The invoice archive is organized by vendor and date.",
            "The project forecast was updated with current estimates.",
            "Expense summaries are prepared for the planning group.",
        ],
        "actions": [
            "Deadline: Reconcile October invoices by November 10, 2026.",
            None,
            "TODO: Confirm the maintenance estimate with the facilities team.",
            None,
            "TODO: Review reimbursement entries before month end.",
            None,
            "Deadline: Share the next-quarter forecast by November 18, 2026.",
            None,
            "TODO: File the updated project estimate.",
            None,
        ],
    },
}


def document_text(project: str, topic: str, detail: str, action: str | None) -> str:
    lines = [
        f"# {topic}",
        "",
        f"Synthetic demo note for the {project} workspace collection.",
        "",
        detail,
        "",
    ]
    if action:
        lines.extend([action, ""])
    lines.extend(
        [
            "This fabricated content is provided only for local demonstration.",
            "It contains no real people, organizations, or commitments.",
            "",
        ]
    )
    return "\n".join(lines)


def generate_demo_data(output_directory: Path) -> list[Path]:
    output_directory.mkdir(parents=True, exist_ok=True)
    generated: list[Path] = []
    for project, content in PROJECTS.items():
        for index, (detail, action) in enumerate(
            zip(content["details"], content["actions"], strict=True),
            start=1,
        ):
            path = output_directory / f"{project}-{index:02d}.md"
            expected = document_text(project, content["topic"], detail, action)
            if path.exists():
                if path.read_text(encoding="utf-8") != expected:
                    raise FileExistsError(
                        f"Refusing to overwrite non-demo file: {path}"
                    )
            else:
                path.write_text(expected, encoding="utf-8", newline="\n")
            generated.append(path)
    return generated


def main() -> None:
    repository_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=repository_root / "demo_workspace",
        help="Output directory (default: ./demo_workspace)",
    )
    args = parser.parse_args()
    generated = generate_demo_data(args.output.expanduser().resolve())
    print(f"Available: {len(generated)} synthetic demo documents in {args.output}")


if __name__ == "__main__":
    main()
