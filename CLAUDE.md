# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This repository is the source for the `rill-make` Claude Code plugin. It is distributed through the [`rcrsr/claude-plugins`](https://github.com/rcrsr/claude-plugins) marketplace, which references this repo as an external plugin source.

## Structure

```
.claude-plugin/plugin.json        # Plugin manifest (name: rill-make, version, author)
ARCHITECTURE.md                   # Agent split, blueprint schema, revision history
GUIDE.md                          # End-user walkthrough
skills/<skill-name>/SKILL.md      # User-invocable skills, namespaced as /rill-make:<skill-name>
agents/<agent-name>.md            # Subagents, invoked via Agent tool with subagent_type
demo/                             # Generated example packages, not part of the plugin distribution
```

The plugin lives at the repo root. There is no nested plugin directory and no local marketplace catalog.

## Rill Plugin Specifics

The plugin wraps authoring workflows for the rill scripting language (`@rcrsr/rill-cli` runtime, `@rcrsr/rill-ext` extensions, `@rcrsr/rill-agent` for HTTP). Key behaviors future Claude instances should know when editing plugin internals:

- The `create-rill-package` skill orchestrates 8 phases (fetch docs, gather requirements, clarify, identify extensions, design data flow, design custom extensions, implement, review) and delegates all rill code generation to the `rill-engineer` agent. Design decisions go through `rill-architect`; validation through `rill-reviewer`.
- Skill templates live in `skills/create-rill-package/templates/`; examples in `skills/create-rill-package/examples/`; helper scripts in `skills/create-rill-package/scripts/`. All are referenced via `${CLAUDE_SKILL_DIR}` at runtime.
- The `rill-engineer` agent always fetches upstream docs (`ref-llms-full.txt`, topic fragments under `docs/llm/`) via `curl -sL`, not `WebFetch`, because rill is novel and summarization loses syntax detail.
- Rill is a pipe-based language: `->` pipes values, `=>` captures to variables, no `=` assignment, no null, no truthiness, no exceptions. Scripts must wrap in named typed closures with `^("desc")` decoration on the closure and every parameter.

## Validation

Run `claude plugin validate .` from the repo root to check the plugin manifest before publishing a release.
