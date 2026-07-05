#!/usr/bin/env python3
"""Parse .claude/core-values.yml for session injection (zero-dep YAML subset + optional PyYAML)."""
from __future__ import annotations

import os
import sys


def parse_yaml_simple(content: str) -> dict:
    """Parse constrained core-values YAML without PyYAML."""
    data: dict = {"sections": []}
    current_section: dict | None = None

    for line in content.split("\n"):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        if line[0] != " " and ":" in line:
            key, _, value = line.partition(":")
            value = value.strip().strip('"').strip("'")
            if key.strip() == "sections":
                continue
            data[key.strip()] = value
            continue

        if stripped.startswith("- name:"):
            name = stripped[7:].strip().strip('"').strip("'")
            current_section = {"name": name, "values": []}
            data["sections"].append(current_section)
            continue

        if stripped == "values:":
            continue

        if stripped.startswith("- ") and current_section is not None:
            value = stripped[2:].strip().strip('"').strip("'")
            current_section["values"].append(value)

    return data


def load_config(config_path: str) -> dict | None:
    if not config_path or not os.path.isfile(config_path):
        return None

    with open(config_path, encoding="utf-8") as f:
        content = f.read()

    try:
        import yaml  # type: ignore

        data = yaml.safe_load(content)
        return data if isinstance(data, dict) else None
    except ImportError:
        return parse_yaml_simple(content)


def format_markdown(data: dict) -> str:
    lines = ["## Core Values & Development Standards", ""]

    motto = data.get("motto", "")
    if motto:
        lines.extend([f"**{motto}**", ""])

    for section in data.get("sections", []):
        lines.append(f"### {section['name']}")
        for value in section.get("values", []):
            if ": " in value and not value.startswith("**"):
                key, _, rest = value.partition(": ")
                lines.append(f"- **{key}**: {rest}")
            else:
                lines.append(f"- {value}")
        lines.append("")

    return "\n".join(lines).rstrip()


def format_reminder(data: dict) -> str:
    motto = data.get("motto", "")
    if motto:
        return f"Standards: {motto} | Full rules: ./CLAUDE.md — read when implementing."
    return "Full rules: ./CLAUDE.md — read when implementing."


MDC_HEADER = """---
description: Binding project standards — mandatory floor; full rules in CLAUDE.md
alwaysApply: true
---

# Binding Project Standards (mandatory)

> AUTO-GENERATED from `.claude/core-values.yml` — run `pnpm standards:gen` after edits.

Violating these rules requires stopping, stating the violation, and correcting before continuing.
These override default model habits when they conflict.

**`./CLAUDE.md` is the full contract.** In Cursor it is always applied. In Claude Code, the SessionStart hook injects the full file on startup, resume, `/clear`, and compaction — that counts as standards in context; do not tell the user to Read `./CLAUDE.md` after `/clear` unless the injected block is missing. Use the Read tool only as a fallback.

This rule file is a floor, not a substitute.

"""

MDC_FOOTER = """
## Communication

- **Session start:** caveman mode (`full`) — same as `/caveman`. Terse every response until `stop caveman` or `normal mode`.
- Code/commits/PRs: normal prose unless user asks for caveman-commit/review.
"""


def format_mdc(data: dict) -> str:
    parts = [MDC_HEADER.rstrip()]
    for section in data.get("sections", []):
        name = section["name"]
        if name == "Communication":
            continue
        parts.append(f"\n## {name}\n")
        for value in section.get("values", []):
            parts.append(f"- {value}")
    parts.append(MDC_FOOTER.rstrip())
    return "\n".join(parts) + "\n"


def main() -> None:
    motto_only = "--motto" in sys.argv
    emit_mdc = "--emit-mdc" in sys.argv
    check_mdc = "--check-mdc" in sys.argv

    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    config_path = args[0] if args else None
    mdc_path = args[1] if len(args) > 1 and (emit_mdc or check_mdc) else None

    data = load_config(config_path or "")
    if not data:
        sys.exit(0)

    if motto_only:
        print(format_reminder(data))
        return

    if emit_mdc:
        if not mdc_path:
            print("parse-core-values: --emit-mdc requires output path", file=sys.stderr)
            sys.exit(1)
        content = format_mdc(data)
        with open(mdc_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"standards:gen: wrote {mdc_path}")
        return

    if check_mdc:
        if not mdc_path:
            print("parse-core-values: --check-mdc requires path", file=sys.stderr)
            sys.exit(1)
        expected = format_mdc(data)
        if not os.path.isfile(mdc_path):
            print(f"standards:check: missing {mdc_path} — run pnpm standards:gen", file=sys.stderr)
            sys.exit(1)
        with open(mdc_path, encoding="utf-8") as f:
            actual = f.read()
        if actual != expected:
            print(
                "standards:check: 00-binding-standards.mdc out of sync — run pnpm standards:gen",
                file=sys.stderr,
            )
            sys.exit(1)
        print("standards:check: mdc matches core-values.yml")
        return

    print(format_markdown(data))


if __name__ == "__main__":
    main()
