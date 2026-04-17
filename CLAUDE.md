# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is a Claude Code plugin marketplace. It catalogs one or more plugins via `.claude-plugin/marketplace.json` and embeds their source directly in the repo (relative `source` paths).

## Structure

```
.claude-plugin/marketplace.json   # Catalog: lists plugins by name + source
rill/                             # Embedded plugin directory (source referenced as "./rill")
  .claude-plugin/plugin.json      # Plugin manifest (name, version, author)
  skills/<skill-name>/SKILL.md    # User-invocable skills, namespaced as /rill:<skill-name>
  agents/<agent-name>.md          # Subagents, invoked via Agent tool with subagent_type
```

Plugin directories sit at the repo root (flat layout, matching the `rcrsr/claude-plugins` reference). Do not nest under `plugins/`.

## Adding a New Embedded Plugin

1. Create `<plugin-name>/.claude-plugin/plugin.json` with `name`, `description`, `version`, `author`.
2. Add `skills/` and/or `agents/` at the plugin root (NOT inside `.claude-plugin/`).
3. Append an entry to `.claude-plugin/marketplace.json` `plugins` array with `name`, `source: "./<plugin-name>"`, `description`.

## External Plugin References

To reference a plugin hosted elsewhere instead of embedding, use:
```json
"source": { "source": "url", "url": "https://github.com/org/repo.git" }
```

## Rill Plugin Specifics

The `rill/` plugin wraps authoring workflows for the rill scripting language (`@rcrsr/rill` runtime, `@rcrsr/rill-ext` extensions, `@rcrsr/rill-agent` for HTTP). Key behaviors future Claude instances should know when editing plugin internals:

- The `create-rill-package` skill orchestrates 8 phases (fetch docs, gather requirements, clarify, identify extensions, design data flow, design custom extensions, implement, review) and delegates all rill code generation to the `rill-engineer` agent.
- Skill templates live in `rill/skills/create-rill-package/templates/`; examples in `rill/skills/create-rill-package/examples/`. Both are referenced via `${CLAUDE_SKILL_DIR}` at runtime.
- The `rill-engineer` agent always fetches upstream docs (`ref-llm.txt`, `llms-ext-index.txt`) via `curl -sL`, not `WebFetch`, because rill is novel and summarization loses syntax detail.
- Rill is a pipe-based language: `->` pipes values, `=>` captures to variables, no `=` assignment, no null, no truthiness, no exceptions. Scripts must wrap in named typed closures with `^("desc")` decoration on the closure and every parameter.

## Validation

Run `claude plugin validate .` from this directory to check marketplace and plugin JSON before distribution.
