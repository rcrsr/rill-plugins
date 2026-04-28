# rill plugin architecture

Plugin-maintainer reference for the `rill` Claude Code plugin. Read this before modifying agents, skill phases, or the blueprint schema.

## Goals

- **Separation of concerns.** Each agent has one job. Design decisions live in one agent; code generation lives in another; validation lives in a third.
- **Frozen handoffs.** Phases communicate through a single on-disk artifact (the blueprint). Downstream agents do not redesign; they implement or grade against the blueprint.
- **Independent review.** A reviewer agent grades implementations against the blueprint. The author of code does not validate its own output.
- **Thin orchestrator.** `SKILL.md` owns sequencing and user interaction, not design or implementation rules.

## Component map

```
create-rill-package (skill, orchestrator)
        │
        ├── rill-architect   (Phases 4-6)   → writes <package>/.rill-design/blueprint.md
        │
        ├── rill-engineer    (Phase 7)      → reads blueprint, writes rill/ts/json/md
        │
        └── rill-reviewer    (Phase 7f)     → reads blueprint + impl, writes review report
```

## Agents

### rill-architect

**Owns:** Phases 4 (Identify Capabilities), 5 (Design Data Flow), 6 (Design Custom Extensions).

**Inputs:**
- Requirements summary (from skill Phase 2)
- Clarifying answers (from skill Phase 3)
- Rill language reference and extension index (fetched in Phase 1)

**Output:** `<package>/.rill-design/blueprint.md` (schema below).

**Out of scope:** writing executable code, configuration files, or prompts. The architect decides shape and structure; the engineer writes the bytes.

### rill-engineer

**Owns:** Phase 7 (Implement). Specifically: `rill-config.json`, custom TypeScript extensions, `.prompt.md` files, `.rill` scripts, dispatcher scripts.

**Inputs:**
- Frozen blueprint at `<package>/.rill-design/blueprint.md`
- Rill language reference (passed by skill or fetched)
- Templates from `rill/skills/create-rill-package/templates/`

**Output:** package files at the canonical layout.

**Rule:** the engineer does not redesign. If the blueprint is incomplete or contradictory, it raises the gap back to the orchestrator rather than improvising.

### rill-reviewer

**Owns:** Phase 7f (Validate).

**Inputs:**
- Package directory path
- Frozen blueprint

**Steps:**
1. Run `npx rill-check <file>` on every `.rill` script. Collect errors.
2. Run `npx tsc --noEmit` if `extensions/` exists. Collect errors.
3. Read each implementation file and grade against the corresponding blueprint section. Note design-conformance violations.

**Output:** structured report with sections — `rill-check results`, `tsc results`, `design-conformance violations`, `verdict (pass | fail)`.

**Rule:** the reviewer does not fix violations. The orchestrator decides whether to re-invoke the engineer with the report.

## Blueprint schema

Materialized at `<package>/.rill-design/blueprint.md`. The architect writes it; the engineer and reviewer consume it.

```markdown
---
schema_version: 1
package: <name>
generated: <ISO-8601 timestamp>
---

# Requirements
- Purpose: <one sentence>
- Inputs: <list>
- Outputs: <list>
- External services: <list>
- Data transformations: <list>
- Error conditions: <list>

# Extension Plan

## Bundled
- mount: <namespace>
  package: @rcrsr/rill/ext/<name>
  purpose: <one sentence>
  config keys: <list>

## Vendor
- mount: <namespace>
  package: <npm-package>
  purpose: <one sentence>
  config keys: <list>

## Custom
- mount: <namespace>
  source: ./dist/extensions/<file>.js
  npm wrapped: <package or "none">
  purpose: <one sentence>
  exposed functions: <list of signatures>

# Prompt Inventory
- path: prompts/<name>.prompt.md
  description: <one sentence>
  params: <name: type, ...>
  output: string | list
  called by: <script:closure>

# Pipeline Blueprint

## PIPELINE: <script-name.rill>
Closure: ^("<desc>") |^("<param desc>") <name>: <type>| { ... } => $<closure_name>
Return type: <type>

Step 1: <description>
  Operator: <-> / fan / seq / acc / fold / filter>
  Call: $<ext>.<function>(<args>)
  Produces: <type> — <shape>

Step 2: ...

# Custom Extension API Designs

## <extension-name>
- Wraps: <npm-package>
- TypeScript interface:
  - <function>(<params>): <return>
- Config schema: <fields>
- Error codes: <list>

# Design Checklist Results

- [x] Every multiline or parameterized prompt is in prompts/*.prompt.md
- [x] @rcrsr/rill-ext-prompt-md is mounted whenever an LLM extension is used
- [x] fan vs seq selection follows I/O rules
- [x] log used for operations only, return value is structured data
- [x] Every script wrapped in fully-decorated typed closure
- [x] Static data lives in rill-config.json, not scripts
- [x] tool_loop only when LLM must decide what to fetch; provider compatibility confirmed
- [x] Every exec command has allowedArgs or blockedArgs
```

## Orchestration flow (SKILL.md)

```
Phase 0: verify prerequisites          (skill)
Phase 1: fetch documentation           (skill)
Phase 2: gather requirements           (skill + AskUserQuestion)
Phase 3: ask clarifying questions      (skill + AskUserQuestion)
Phase 4: identify capabilities         → rill-architect
Phase 5: design data flow              → rill-architect (extends blueprint)
Phase 6: design custom extensions      → rill-architect (extends blueprint)
                                         [user approves blueprint]
Phase 7a: scaffold project             (skill — npm/tsconfig/env)
Phase 7b: rill-config.json             → rill-engineer (reads blueprint)
Phase 7c: custom TS extensions         → rill-engineer (reads blueprint)
Phase 7d: prompt files                 → rill-engineer (reads blueprint)
Phase 7e: rill scripts                 → rill-engineer (reads blueprint)
Phase 7f: validate                     → rill-reviewer (reads blueprint + impl)
            ↳ if fail: re-invoke engineer with report; loop until pass or hard-stop
Phase 7g: entry point (multi-script)   → rill-engineer
Phase 8:  review and deliver           (skill)
```

## Extending the plugin

### Adding a new domain agent

1. Create `rill/agents/<role>.md` with a focused description and minimal-context tool list.
2. Add a section above describing its scope and inputs/outputs.
3. Add a phase to `SKILL.md` that delegates with a self-contained prompt (the agent gets no conversation history).
4. If the new agent produces an artifact other agents consume, document it in the blueprint schema or as a sibling artifact in `<package>/.rill-design/`.

### Adding a new SKILL.md phase

1. Decide which agent owns it. If none fits, that's a signal to add a new agent.
2. Update the orchestration flow diagram above.
3. Keep the phase prompt self-contained; the agent has no prior context.

### Changing the blueprint schema

1. Bump `schema_version` in the schema block above and in the architect's prompt.
2. Update both the engineer and reviewer agents to read the new schema fields.
3. Note the change in the revision history below.

### Updating to a new rill runtime version

1. Re-fetch `https://raw.githubusercontent.com/rcrsr/rill/refs/heads/main/docs/ref-llm.txt` and diff against the language reference embedded in `rill-engineer.md`.
2. Update the engineer's "Known Documentation Errata" and any troubleshooting tables.
3. Update the architect's operator selection rules if collection-operator semantics changed.
4. Bump the plugin version (minor for additive changes, major for breaking syntax shifts).

## Revision history

| Version | Change |
|---------|--------|
| 0.6.0   | Split rill-engineer into architect + engineer + reviewer; introduced on-disk blueprint at `<package>/.rill-design/blueprint.md`. |
| 0.5.0   | Updated inline guidance to rill 0.19 syntax (seq/fan/acc, while...do, `-> type`); mandated prompt-md externalization for multiline/parameterized prompts. |
| 0.4.0   | LLM prompt documentation enhancements. |
| 0.3.0   | Comprehensive guide for creating Rill packages. |
| 0.2.0   | Prerequisite verification phase. |
| 0.1.0   | Initial release. |
