---
name: create-rill-package
description: Create a complete rill package from a specification document or description. Analyzes requirements, identifies extensions, designs custom extensions, and implements all rill scripts with matching rill-config.json.
user-invocable: true
argument-hint: "[spec-file-or-description]"
---

# Create Rill Package

You orchestrate creation of a complete rill package. Your job is sequencing — design decisions belong to the `rill-make:rill-architect` agent, implementation to `rill-make:rill-engineer`, and validation to `rill-make:rill-reviewer`. Follow the phases in order. Do NOT skip phases or combine them.

This skill targets `@rcrsr/rill-cli >= 0.19.5`. The unified `rill` binary handles bootstrapping, extension installation, type-checking, building, and execution. The skill drives that CLI rather than crafting `package.json` and `rill-config.json` from scratch.

See `ARCHITECTURE.md` at the plugin root for the agent split, blueprint schema, and revision history.

## User Responsibility for External Vendors

The user owns all external vendor accounts, API keys, credentials, quotas, billing, and provisioned resources (buckets, vector collections, databases, indexes). This skill never creates vendor accounts, obtains keys, or provisions remote resources. It only references credentials via `${VAR_NAME}` placeholders in `rill-config.json` and documents what the user must provide. If the user lacks credentials or resources when handoff completes, the package will not run until they provision them.

## Reference Materials

This skill includes templates and examples. Use them as structural guides for output consistency.

**Templates** (in `${CLAUDE_SKILL_DIR}/templates/`):
- `PROJECT-STRUCTURE.md` — directory layout, file ownership, run/build commands
- `tsconfig.json` — minimal tsconfig that extends `.rill/tsconfig.rill.json` (only used when custom extensions exist)
- `custom-extension.ts.tmpl` — TypeScript extension scaffold with factory, config validation, error handling. Suffixed `.tmpl` so editors do not treat it as a TS source file; engineer drops the `.tmpl` suffix when copying into a generated package's `extensions/` directory.
- `env.template` — default lines (`# VAR=hint`) consulted by `scaffold-env.mjs` when generating a trimmed `.env`
- `server.js` — HTTP agent server using `@rcrsr/rill-agent` (copied by `scaffold-server.mjs` when HTTP deployment is requested)

**Scripts** (in `${CLAUDE_SKILL_DIR}/scripts/`):
- `preflight.mjs` — Phase 0 environment checks (platform, node, npm, rill-cli semver)
- `probe-surfaces.mjs <package-dir>` — Phase 4.5 probe + aggregate; runs `rill describe project --stubs --mount X` per mount and writes `extension-surfaces.md`
- `append-gitignore.mjs <package-dir>` — Phase 7a; appends canonical entries idempotently
- `scaffold-server.mjs <package-dir>` — Phase 7a; writes root `package.json`, copies `server.js`, runs `npm install`
- `scaffold-env.mjs <package-dir>` — Phase 7b; reads `rill-config.json` `${VAR_NAME}` references and writes a trimmed `.env`

All mechanical filesystem and version-comparison work runs through these scripts. Do not improvise inline node/bash equivalents — escape handling and parsing rules differ between agent renderings and the scripts capture them once.

There is no `package.json` template. `rill bootstrap` writes a scoped `package.json` inside `.rill/npm/`. A project-root `package.json` is only needed when HTTP serving (`server.js`) requires `@rcrsr/rill-agent` in root `node_modules/`; `scaffold-server.mjs` writes it.

There is no `rill-config.json` template. `rill bootstrap` writes a starter, `rill install` populates mounts and config, and the engineer edits the result in Step 7b.

There is no `.gitignore` template. `rill bootstrap` appends `.rill/`; `append-gitignore.mjs` appends `.env`, `build/`, `transcript/`, `dist/`.

**Examples** (in `${CLAUDE_SKILL_DIR}/examples/`):
- `simple-summarizer/` — single script, one built-in extension (Anthropic LLM), no custom extensions
- `doc-search-pipeline/` — multiple scripts, 3 built-in extensions (OpenAI, Qdrant, S3) + 1 custom extension (web crawler), with entry point dispatcher

## Phase 0: Verify Prerequisites

Before any other work, verify the environment meets rill's requirements. Run:

```
node ${CLAUDE_SKILL_DIR}/scripts/preflight.mjs
```

The script checks platform (Linux/WSL), Node.js (>= 22.16.0), npm, and `@rcrsr/rill-cli` (>= 0.19.5). It prints the report block and exits non-zero on any failure. If it fails, surface the printed report to the user and halt; do NOT attempt to auto-install system prerequisites. The platform check warns (not fails) on non-Linux kernels — re-run the script with `--allow-non-linux` after confirming with the user.

Proceed to Phase 1 only when the script exits 0.

## Phase 1: Fetch Documentation

The rill language reference is split into a small index, topic fragments, and a full bundle. Fetch the fragments each downstream agent needs once, then pass them selectively. Subagents do not refetch.

### Rill language reference (split documents)

Base path: `https://raw.githubusercontent.com/rcrsr/rill/refs/heads/main/docs/`

| Document | Path | When to fetch |
|---|---|---|
| Index | `ref-llms.txt` | Optional; small map of fragments |
| Cheatsheet | `llm/cheatsheet.txt` | Always (~5 KB; passed to architect, engineer config tasks, reviewer) |
| Control flow | `llm/control-flow.txt` | If any rill scripts will be written (~4 KB) |
| Callables | `llm/callables.txt` | If any rill scripts will be written (~6 KB) |
| Errors | `llm/errors.txt` | Always for reviewer; for engineer if scripts use `guard`/`retry` (~5 KB) |
| Anti-patterns | `llm/anti-patterns.txt` | Always for reviewer (~4 KB) |
| Types | `llm/types.txt` | If scripts use parameterized type assertions or conversions (~5 KB) |
| Stdlib | `llm/stdlib.txt` | If scripts use string/list/dict methods or `enumerate`/`range` (~3 KB) |
| Style | `llm/style.txt` | Optional; included only on demand (~3 KB) |
| Full bundle | `ref-llms-full.txt` | When writing complete rill scripts (~32 KB) |

Fetch with `curl -sL`. Example:

```
curl -sL https://raw.githubusercontent.com/rcrsr/rill/refs/heads/main/docs/llm/cheatsheet.txt
curl -sL https://raw.githubusercontent.com/rcrsr/rill/refs/heads/main/docs/ref-llms-full.txt
```

### Other references

- **Extension index:**
  `curl -sL https://raw.githubusercontent.com/rcrsr/rill-ext/refs/heads/main/llms.txt`

- **Rill-agent reference** (only if HTTP deployment is needed):
  `curl -sL https://raw.githubusercontent.com/rcrsr/rill-agent/refs/heads/main/llms.txt`

### Selective inclusion in agent prompts

| Invocation | Cheatsheet | Control flow | Callables | Errors | Anti-patt. | Full bundle | Ext index | Surfaces | Agent ref |
|---|---|---|---|---|---|---|---|---|---|
| Phase 4 (architect — identify extensions) | ✓ | – | – | – | – | – | ✓ | – | – |
| Phase 5 (architect — design data flow) | ✓ | ✓ | ✓ | – | – | – | – | ✓ | – |
| Phase 6 (architect — custom TS extensions) | – | – | – | – | – | – | – | – | – |
| Phase 7a (skill — scaffold) | – | – | – | – | – | – | – | – | ✓ if `serve` |
| Phase 7b (engineer — rill-config.json edits) | – | – | – | – | – | – | – | – | – |
| Phase 7c (engineer — TS extensions) | – | – | – | – | – | – | – | – | – |
| Phase 7d (engineer — prompt files) | – | – | – | – | – | – | – | – | – |
| Phase 7e (engineer — rill scripts) | – | – | – | – | – | ✓ | – | ✓ | – |
| Phase 7g (engineer — dispatcher) | – | – | – | – | – | ✓ | – | – | – |
| Phase 7f (reviewer) | ✓ | – | – | ✓ | ✓ | – | – | ✓ | – |

The "Surfaces" column refers to the Extension Surface Inventory (`<package>/.rill-design/extension-surfaces.md`) captured in Phase 4.5. It is the authoritative call-surface reference for the architect (Phase 5), the engineer writing rill scripts (Phase 7e), and the reviewer validating call sites (Phase 7f).

When including docs in an agent prompt, add: "The rill documentation is included below. Do NOT fetch it again."

Phases 7b/c/d do not need the rill language reference — JSON edits, TypeScript, and `.prompt.md` files do not contain rill syntax.

## Phase 2: Gather Requirements

The user provided: `$ARGUMENTS`

**If the argument is a file path** (ends in `.md`, `.txt`, `.doc`, `.pdf`, or starts with `/`, `./`, `~`):
- Read the file using the Read tool
- Extract all functional requirements, inputs, outputs, data flows, and integration points

**If the argument is an inline description:**
- Parse the description for requirements

**If no argument was provided:**
- Use `AskUserQuestion` to ask: "Describe the rill package you want to build. Include: what it does, what data it processes, what external services it connects to, and what output it produces."

Produce a structured summary:

```
REQUIREMENTS SUMMARY
--------------------
Purpose: [one sentence]
Inputs: [list]
Outputs: [list]
External services: [list]
Data transformations: [list]
Error conditions: [list]
```

### Determine Project Location

Always create the package in a new subfolder named after the package (lowercase, hyphens). This keeps packages isolated and makes the transcript `file` path unambiguous.

Record the decision as:
```
PACKAGE LOCATION: subfolder: package-name/
```

## Phase 3: Ask Clarifying Questions

Review the requirements and the extension index for gaps. Ask the user about ANY of these that are unclear:

1. **Data format**: What format are inputs/outputs? (JSON, CSV, plain text, binary)
2. **LLM usage**: Does the package need LLM capabilities? Which provider?
3. **Storage**: Does it need persistent state? (SQLite, Redis)
4. **File storage**: S3, R2, MinIO?
5. **Vector search**: Embeddings, semantic search? (Qdrant, Pinecone, ChromaDB)
6. **MCP servers**: Tool servers to connect to?
7. **Claude Code**: Does it need to invoke Claude Code CLI?
8. **Concurrency**: Independent (parallel) or sequential operations?
9. **Error handling**: Halt, retry, skip on failure?
10. **Scale**: Expected data volumes?
11. **Vendor provisioning**: For each external service, does the user already have an active account, valid API key, and required resources provisioned (buckets, collections, schemas, webhooks)? If not, state explicitly that the user must provision these before running.

Ask ONLY relevant questions. Use `AskUserQuestion` to combine all into one call. Wait for the response before Phase 3.5.

## Phase 3.5: Scan Sibling Packages for Reference Patterns

The architect designs against upstream docs alone unless given concrete examples. Sibling packages in the same repo encode local conventions (auth variants, lifted custom extensions, prompt patterns) that upstream docs miss. Surface them before the architect runs.

1. **Discover sibling packages.** From the repo root, locate every `rill-config.json` outside the new package directory:
   ```
   find . -name rill-config.json -not -path '*/node_modules/*' -not -path '*/.rill/*' -not -path './<new-package>/*'
   ```

2. **Read each sibling `rill-config.json`** and extract the set of extension mounts (the keys of `extensions.mounts`, by package name or local path).

3. **Score overlap with the planned package.** Compare each sibling's mount set against the rill-ext packages the user requires (from Phase 3 answers and the requirements summary). A sibling is relevant if it shares at least one extension package (e.g., both use `@rcrsr/rill-ext-google-workspace`) or wraps a custom extension matching a planned capability (e.g., `extensions/html.ts`).

4. **Collect reference materials** for every relevant sibling:
   - Full text of `rill-config.json`
   - Full text of `main.rill` (and any script under `scripts/` whose name matches a planned script)
   - Full text of any custom extension in `extensions/` whose filename overlaps a planned custom extension or a shared concern (HTML parsing, OAuth, etc.)

5. **Record the inventory** as:
   ```
   SIBLING REFERENCES
   ------------------
   <sibling-name>/  shares: [<extension-list>]
     rill-config.json:    [path]
     main.rill:           [path]
     extensions:          [paths or "none"]
   ```

   If no sibling overlaps, record `SIBLING REFERENCES: none` and proceed.

6. **Pass the collected file contents to Phase 4** as a "Reference Patterns" payload. The architect must read them before designing.

## Phase 4: Identify Capabilities and Extensions (architect)

Delegate to the `rill-make:rill-architect` agent.

Use Agent with `subagent_type: "rill-make:rill-architect"` and a prompt containing:
- The full requirements summary from Phase 2
- The user's answers from Phase 3
- The Sibling References inventory and full file contents collected in Phase 3.5
- The extension index content from Phase 1
- The cheatsheet (`llm/cheatsheet.txt`) content from Phase 1
- The package directory path (architect will write the blueprint there)
- Instruction: "The extension index and rill cheatsheet are included below. Do NOT fetch documentation. Sibling-package reference materials are also included; treat them as authoritative local conventions for auth variants, lifted custom extensions, and prompt patterns, and prefer their patterns over generic upstream defaults unless the requirements force otherwise. Identify rill-ext packages, decide on any custom extensions, and write the Extension Plan section of the blueprint at `<package>/.rill-design/blueprint.md`. Note in the blueprint which sibling patterns were reused. Reply with a short summary and any blueprint gaps."

Wait for the architect to write the blueprint. Read the blueprint and surface any "Blueprint gaps" to the user before continuing.

### Integration strategy gate

When the blueprint includes a `## Custom` extension entry, confirm the architect recorded both `integration option:` and `rationale:` fields per the resolution order in `rill-architect.md` (option 1 = official SDK; option 2 = community SDK; option 3 = REST via fetch; option 4 = MCP bridge as last resort). If any custom entry is missing those fields, route the gap back to the architect.

If any entry chose `4: MCP bridge`, halt before Phase 4.5 and request explicit user approval via `AskUserQuestion`, including the architect's rationale and the named MCP server. Do not proceed without an affirmative answer.

### NPM package discovery (orchestrator step)

If the architect's blueprint specifies a custom extension that wraps an npm package, search for the best candidate before Phase 6:
1. Use WebSearch to find the npm package (e.g., "npm rss parser", "npm stripe sdk")
2. Prefer high download counts, recent updates, TypeScript types
3. Present candidates to the user via `AskUserQuestion` and record the chosen package in the blueprint before proceeding

## Phase 4.5: Bootstrap, Install, and Probe Extension Surfaces

The architect's Phase 4 selection is based on the extension index — text descriptions, not actual signatures. Before designing the data flow in Phase 5, install the chosen rill-ext packages and capture their call surfaces with `rill describe project --stubs`. This eliminates a class of design errors where the architect assumes a response shape the extension does not produce.

The install in this phase is the real install — it carries through to Phase 7. There is no throwaway probe directory.

1. **Create the package directory** and the design subdirectory:
   ```
   mkdir -p <package>/.rill-design
   ```

2. **Bootstrap the package.** From the package directory, run `rill bootstrap`. This creates `.rill/npm/`, `.rill/tsconfig.rill.json`, a starter `rill-config.json`, and seeds gitignore files.

   If `rill bootstrap` exits non-zero, halt. Surface stderr to the user. Most likely causes: Node.js below 22.16.0 or a stale global `@rcrsr/rill-cli`. Do not attempt recovery without user direction.

3. **Install each rill-ext package** from the blueprint Extension Plan (Bundled and Vendor sections). For each entry, use the mount namespace declared in the blueprint:
   ```
   rill install <package-name> --as <mount-from-blueprint>
   ```
   `--as` is mandatory: without it the mount is derived from the package name and may not match the blueprint. The architect records the mount under each `## Bundled` / `## Vendor` entry's `mount: <namespace>` line; transcribe that value verbatim.

   If the blueprint Prompt Inventory contains any entry, also install `@rcrsr/rill-ext-prompt-md --as prompt`. Any LLM extension that consumes a prompt requires it; absence of prompt-md when prompts exist will fail at script load.

   rill-cli 0.19.5 separates install from validation: `rill install` runs npm and writes the mount, but does not invoke the extension factory. No `.env` sourcing is needed at install time, and configs do not need to be pre-populated. Validation runs at `rill describe project --stubs` (Step 4) and at `rill run` (smoke test in Step 7h), both of which give actionable errors when configuration is missing or wrong.

   If any `rill install` call exits non-zero, the failure is at the npm layer (404, network, registry auth, name typo). Surface the failed package name and stderr to the user. Use `AskUserQuestion` to ask: (a) drop the extension and revisit Phase 4 with the architect, (b) abort. Do not silently continue with a missing mount.

4. **Write stub configs from the Extension Plan.** Install populated `extensions.mounts` but left `extensions.config` empty. Probe (next step) constructs each extension's factory and most factories need at least an auth/credential dict to exist. Use Agent with `subagent_type: "rill-make:rill-engineer"` and a prompt containing:
   - The package directory path
   - The blueprint path: `<package>/.rill-design/blueprint.md`
   - The current `rill-config.json` content
   - Instruction: "Read the Extension Plan in the blueprint. For each `## Bundled` and `## Vendor` entry, transcribe its `config keys:` block into `rill-config.json` `extensions.config.<mount>` verbatim. The architect emits literal values per the placeholder convention: `${env.VAR_NAME}` for env-resolved fields and bare literals for everything else. Do not reinterpret — copy values exactly. The `${env.VAR}` form is required at this step so `rill describe project --stubs` can synthesize placeholders during probe; Step 7b rewrites these to `${VAR}` for runtime resolution. Do NOT touch `extensions.mounts` (rill install owns that). Do NOT set `main` yet (that needs the closure name from Phase 5). If a Custom mount has no config keys, leave its entry as `{}` or omit it entirely."

5. **Probe and aggregate extension surfaces.** From the package directory, run:
   ```
   node ${CLAUDE_SKILL_DIR}/scripts/probe-surfaces.mjs <package-dir>
   ```
   The script reads `rill-config.json` `extensions.mounts`, runs `rill describe project --stubs --mount <mount>` for each, writes per-mount JSON to `.rill-design/<mount>.surface.json`, and aggregates a markdown digest at `.rill-design/extension-surfaces.md`. The `--stubs` flag synthesizes `"x"` for every unset `${env.VAR}` reference so factories construct without populated `.env`; numeric and boolean config still requires real values. The digest format uses one `## <mount>` heading per mount and one bullet per callable with parameters, defaults, return type, and (when the return is a structural dict) a `return shape: dict[...]` line. If a mount fails to construct under stubs, the script exits non-zero with the offending mount on stderr — surface to the user and revisit the Extension Plan or the Step 4 config write.

6. **Pass the digest content to Phase 5** as a payload labeled "Extension Surface Inventory". The architect uses the digest to design call sites against authoritative signatures rather than guessed shapes.

7. **Persistence.** Leave `.rill-design/extension-surfaces.md` and the per-mount surface JSON files in place — they document the design and serve as a reference during implementation. The `.rill/npm/` install is gitignored automatically by `rill bootstrap`.

## Phase 5: Design Data Flow (architect)

Delegate to the `rill-make:rill-architect` agent again.

Use Agent with `subagent_type: "rill-make:rill-architect"` and a prompt containing:
- The package directory path
- The cheatsheet, control-flow, and callables fragments from Phase 1 (`llm/cheatsheet.txt`, `llm/control-flow.txt`, `llm/callables.txt`)
- The Extension Surface Inventory from Phase 4.5 (`<package>/.rill-design/extension-surfaces.md`)
- Any architect notes or user clarifications since Phase 4
- Instruction: "The rill cheatsheet, control-flow, and callables fragments are included below, along with the Extension Surface Inventory captured by `rill describe project --stubs`. Do NOT fetch documentation. Do NOT guess extension signatures or response shapes — use the Inventory as the authoritative call surface. Every extension call site you specify in the Pipeline Blueprint must match a signature from the Inventory: parameter order, parameter types, and the nested return shape. Extend the blueprint at `<package>/.rill-design/blueprint.md` with: Pipeline Blueprint section (per script), Prompt Inventory, and Design Checklist Results. Reply with a short summary and any blueprint gaps."

Read the updated blueprint. Present the Pipeline Blueprint and Prompt Inventory sections to the user. Wait for approval before Phase 6.

## Phase 6: Design Custom Extensions (architect)

If Phase 4 identified custom extensions, delegate to the `rill-make:rill-architect` agent.

Use Agent with `subagent_type: "rill-make:rill-architect"` and a prompt containing:
- The package directory path
- The custom extension template at `${CLAUDE_SKILL_DIR}/templates/custom-extension.ts.tmpl` (read it as a `.ts` scaffold; the `.tmpl` suffix is purely to keep editors from picking it up as a real TS source file)
- The npm package(s) to wrap (confirmed in Phase 4)
- Instruction: "Extend the blueprint at `<package>/.rill-design/blueprint.md` with the Custom Extension API Designs section. Each design specifies the TypeScript interface, function signatures, parameter and return types, config schema, and error codes. Keep extensions thin wrappers — business logic stays in rill scripts. Reply with a short summary."

Read the updated blueprint. Present the Custom Extension API Designs to the user for approval before Phase 7.

If no custom extensions are needed, skip to Phase 7.

## Phase 7: Implement (engineer)

ALL rill code, JSON config edits, prompt files, and TypeScript extensions go through the `rill-make:rill-engineer` agent. Each step references the frozen blueprint as the source of truth. The engineer does not redesign — if the blueprint is incomplete, the engineer will return a "Blueprint gap" message; route the gap back to Phase 5 or 6 with the architect.

### Step 7a: Scaffold Project Environment (skill)

The package was bootstrapped and rill-ext packages were installed in Phase 4.5. This step adds the remaining files.

1. **Create directory structure** following `${CLAUDE_SKILL_DIR}/templates/PROJECT-STRUCTURE.md`:
   ```
   <package>/
     extensions/        # only if custom extensions exist
     scripts/           # only if multiple rill scripts
     prompts/           # only if LLM extensions exist
   ```

2. **Append canonical entries to `.gitignore`** (`rill bootstrap` already added `.rill/`):
   ```
   node ${CLAUDE_SKILL_DIR}/scripts/append-gitignore.mjs <package-dir>
   ```
   The script appends `.env`, `build/`, `transcript/`, `dist/` only if missing. Idempotent.

3. **Generate `tsconfig.json`** if custom extensions exist. Copy `${CLAUDE_SKILL_DIR}/templates/tsconfig.json.tmpl` to `<package-dir>/tsconfig.json` (the template is suffixed `.tmpl` in the plugin source so editors do not pick it up as a real TS project; the destination drops the suffix). The template extends `./.rill/tsconfig.rill.json` so module resolution finds extension types in `.rill/npm/node_modules/`. Skip this step when the blueprint declares no custom extensions.

4. **Scaffold the HTTP server** (only if the blueprint requests HTTP deployment):
   ```
   node ${CLAUDE_SKILL_DIR}/scripts/scaffold-server.mjs <package-dir>
   ```
   The script copies `${CLAUDE_SKILL_DIR}/templates/server.js`, writes a root `package.json` with `@rcrsr/rill-agent` in `dependencies` and a `serve` script (`node server.js`), and runs `npm install` from the package root. This root install is separate from the `.rill/npm/` scoped install that `rill bootstrap` produced.

`.env` is NOT generated here — it is produced by Step 7b after the engineer fills in `${VAR_NAME}` placeholders, so the trim can read actual references rather than guess from the blueprint.

### Step 7b: Finalize rill-config.json (engineer) and generate .env (skill)

`rill install` populated `extensions.mounts`. Phase 4.5 Step 4 wrote stub `extensions.config` blocks using `${env.VAR}` placeholders so probe could enumerate surfaces. Now finalize the config: set top-level metadata, the `main` handler, switch placeholders to the runtime form, and add any keys the architect added in Phase 5/6.

1. **Engineer edits the config.** Use Agent with `subagent_type: "rill-make:rill-engineer"` and a prompt containing:
   - The package directory path
   - The blueprint path: `<package>/.rill-design/blueprint.md`
   - The current `rill-config.json` content
   - Instruction: "Read the blueprint and the existing rill-config.json. Set the top-level `name` (package identifier from the blueprint), `version` (rill schema version matching the installed `@rcrsr/rill-cli` major.minor, e.g. `\"0.19\"`), and `main` (`script.rill:closure_name` from the Pipeline Blueprint). For every `${env.VAR}` placeholder under `extensions.config`, rewrite it to `${VAR}` — the `${env.VAR}` form is only recognized by `rill describe project --stubs` for surface probes; runtime resolution requires the bare `${VAR}` form. Replace any literal credentials with `${VAR}` placeholders matching `.env`. Add any config keys called out in the blueprint's Pipeline Blueprint or Custom Extension API Designs that the Phase 4.5 stub did not include. Do NOT touch `extensions.mounts` (rill install owns that). If anything is unclear, return a Blueprint gap message instead of guessing."

2. **Skill generates .env.** Run:
   ```
   node ${CLAUDE_SKILL_DIR}/scripts/scaffold-env.mjs <package-dir>
   ```
   The script scans the just-edited `rill-config.json` for `${VAR}` references, reads `${CLAUDE_SKILL_DIR}/templates/env.template` for default lines, and writes `<package-dir>/.env` containing only the referenced variables. Already-populated values in an existing `.env` are preserved.

### Step 7c: Custom TypeScript Extensions (engineer, if any)

For each custom extension in the blueprint:

1. **Engineer writes the file.** Use Agent with `subagent_type: "rill-make:rill-engineer"` and a prompt containing:
   - The package directory path
   - The blueprint path
   - The extension name to implement
   - The custom-extension template path
   - Instruction: "Read the Custom Extension API Designs section of the blueprint. Implement the extension as a thin wrapper at `extensions/<file>.ts`. The factory signature is `(config, ctx: ExtensionFactoryCtx)`. All configuration comes from the factory `config` parameter, never directly from `process.env`. Surface failures via `runCtx.invalidate(error, { code, provider, raw })` using the generic atom taxonomy (`#AUTH`, `#FORBIDDEN`, `#NOT_FOUND`, `#RATE_LIMIT`, `#QUOTA_EXCEEDED`, `#UNAVAILABLE`, `#CONFLICT`, `#PROTOCOL`, `#INVALID_INPUT`, `#TIMEOUT`, `#DISPOSED`, `#TYPE_MISMATCH`); RILL-R004 was retired in rill 0.19.0. Factory-time configuration validation throws `RuntimeError('RILL-R001', ...)`."

2. **Scaffold the extension's npm dependencies and the import-resolution symlink.** After the engineer writes `extensions/<file>.ts`, run:
   ```
   node ${CLAUDE_SKILL_DIR}/scripts/scaffold-custom-ext.mjs <package-dir> extensions/<file>.ts
   ```
   The script scans the `.ts` file for bare-specifier imports, `npm install`s any that are not already under `.rill/npm/node_modules/` (skipping `@rcrsr/*`, which ship via vendor extension installs), pulls in matching `@types/<pkg>` when published, and creates `<package-dir>/node_modules → .rill/npm/node_modules` as a symlink. The symlink is required because Node's import resolver looks at the `.ts` file's nearest `node_modules`, not at `.rill/npm/`. Without it, the next `rill describe` or `rill run` halts with a transitive `ERR_MODULE_NOT_FOUND` (rill-config 0.19.2 surfaces an actionable hint pointing at the same `ln -sfn` command, but auto-scaffolding avoids the loop entirely). The script is idempotent.

3. **Skill registers the mount.** From the package directory:
   ```
   rill install ./extensions/<file>.ts --as <mount-from-blueprint>
   ```
   Use the mount name declared in the blueprint Custom Extension API Designs section (`mount: <namespace>` line). If no mount is recorded, halt and route a Blueprint gap to the architect rather than inventing one. This adds the mount to `rill-config.json` without invoking npm.

4. **Type-check.** After all custom extensions are written and installed, run `rill check --types` from the package directory. If errors, fix them by re-invoking the engineer with the error message.

### Step 7d: Prompt Files (engineer, if LLMs are used)

For each prompt in the blueprint Prompt Inventory, use Agent with `subagent_type: "rill-make:rill-engineer"` and a prompt containing:
- The package directory path
- The blueprint path
- The prompt entry (path, description, params, output mode, called-by)
- Instruction: "Read the Prompt Inventory section of the blueprint. Write the prompt file at the specified path with YAML frontmatter (`description`, `params`) and the prompt body. Use `{name}` interpolation for scalar params only. For list-mode prompts (per blueprint) include `@@ system` / `@@ user` / `@@ assistant` markers; for string-mode include none. Do NOT write `output:` in the frontmatter — rill-ext 0.19.2 prompt-md removed that field and infers mode from body content. Hyphens in filename segments convert to `_` in the resolved callable name (e.g., `summarize-email.prompt.md` → `$prompt.summarize_email`)."

### Step 7e: Rill Scripts (engineer)

For each script in the blueprint Pipeline Blueprint, use Agent with `subagent_type: "rill-make:rill-engineer"` and a prompt containing:
- The package directory path
- The blueprint path
- The specific PIPELINE section the engineer should implement
- The rill-config.json content (so the engineer knows available mounts)
- The Extension Surface Inventory from Phase 4.5 (`<package>/.rill-design/extension-surfaces.md`)
- The full rill language bundle (`ref-llms-full.txt`) content from Phase 1
- Instruction: "The full rill language bundle and the Extension Surface Inventory are included below. Do NOT fetch documentation. Read the blueprint and implement the specified PIPELINE exactly. Closure name, parameter names and types, return type, operator choices, and extension calls must match the blueprint. Every extension call site must match a signature from the Inventory — if the blueprint contradicts the Inventory, return a Blueprint gap message instead of guessing. Use `log` only for operational messages."

For projects with multiple scripts, you MAY launch multiple `rill-make:rill-engineer` agents in parallel for independent scripts. Scripts that depend on each other must be implemented sequentially.

### Step 7f: Validate (reviewer)

Use Agent with `subagent_type: "rill-make:rill-reviewer"` and a prompt containing:
- The package directory path (absolute)
- The blueprint path
- The cheatsheet, errors, and anti-patterns fragments from Phase 1 (`llm/cheatsheet.txt`, `llm/errors.txt`, `llm/anti-patterns.txt`)
- The Extension Surface Inventory from Phase 4.5 (`<package>/.rill-design/extension-surfaces.md`)
- Instruction: "The rill cheatsheet, errors, anti-patterns, and the Extension Surface Inventory are included below. Do NOT fetch documentation. Validate the implementation against the blueprint and the Inventory. Run `rill check` (no-arg, scans the whole project) and, if `extensions/` exists, `rill check <main-file> --types` (combined lint + tsc, single call). Verify every extension call site matches a signature from the Inventory (param order, types, return shape), and grade design conformance. Return the structured review report."

If the verdict is FAIL, route the violations back to the engineer:
- For tooling failures (`rill check`, `rill check --types`), invoke the engineer with the specific error and the affected file
- For design-conformance failures, invoke the engineer with the violation and the blueprint section it violates
- After fixes, re-invoke the reviewer

Repeat until the reviewer returns PASS, or after 3 unsuccessful loops, halt and report the open violations to the user.

### Step 7g: Entry Point (engineer, multi-script only)

If the package has multiple scripts, use Agent with `subagent_type: "rill-make:rill-engineer"` to create the dispatcher in `main.rill`. Reference the blueprint's Pipeline Blueprint sections for the available scripts.

### Step 7h: Runtime Smoke Test (engineer fix-loop)

The reviewer in Step 7f only checks static syntax (`rill check`, `rill check --types`). It cannot detect wrong extension call shapes, wrong prompt filenames, or call-site signature mismatches. Run a single end-to-end execution to surface those defects before delivery.

1. **Inform the user** that a runtime smoke test is required. State: "The package compiles and passes static review. Before delivery, I will run it once to catch runtime errors that static checks miss. This requires `.env` populated with real credentials."

2. **Use `AskUserQuestion`** to ask: did the user populate `.env`, or do they want to skip the smoke test?
   - If skipped, record `SMOKE TEST: SKIPPED (no credentials)` and proceed to Phase 8 with a delivery warning.
   - If proceeding, continue.

3. **Build the run command** from the blueprint's main closure signature:
   - No required params: `rill run`
   - Required params: `rill run --<param_name> <value>` for each, using minimal valid sample values from the blueprint. Do NOT prefix with `--` — rill-cli treats the literal `--` as a positional `rootDir` and the run fails. Bool params accept `--<param_name>` as a true switch.

4. **Execute** from the package directory and capture exit code, stdout, and stderr.

5. **Classify the outcome:**
   - Exit 0: `SMOKE TEST: PASS`. Proceed to Phase 8.
   - Exit non-zero with credential or quota error (HTTP 401/403, `invalid_grant`, `missing API key`, rate-limit messages): treat as environmental, not an implementation defect. Surface the stderr to the user, ask whether to retry after credential fix or proceed to delivery, and do not loop on the engineer.
   - Exit non-zero with any other error (runtime halt, extension call shape mismatch, missing prompt callable, type assertion failure): treat as an implementation defect; route to the engineer fix-loop.

6. **Engineer fix-loop for implementation defects.** Use Agent with `subagent_type: "rill-make:rill-engineer"` and a prompt containing:
   - The package directory path
   - The blueprint path
   - The full stderr text from the failed run
   - The script path and closure most likely involved (inferred from the run command and stderr)
   - The blueprint section that closure implements (Pipeline Blueprint, Prompt Inventory, or Custom Extension API Designs entry)
   - The rill-config.json content
   - Instruction: "The package halted at runtime. Locate the offending call site, fix it to match the blueprint and the actual extension or prompt contract, and report what changed. If the blueprint itself is wrong (e.g., specifies a response field that the extension does not return), return a Blueprint gap message instead of guessing."

   After the engineer reports a fix, re-run the smoke test from step 4. Cap the loop at 3 iterations. After 3 unsuccessful loops, halt and report the open stderr to the user.

7. **If the engineer returns a Blueprint gap**, route the gap to the architect (Phase 5 or Phase 6 as appropriate), update the blueprint, then re-invoke the engineer for the affected step before re-running the smoke test.

## Phase 8: Review and Deliver

After implementation passes review and the smoke test passes (or is skipped with explicit user approval):

1. List all created files with a one-line description of each
2. Show the complete `rill-config.json`
3. Produce a **Provisioning Checklist** the user must complete before the package will run. For each external vendor:
   - **Vendor and purpose** (e.g., "OpenAI — chat completions and embeddings")
   - **Account URL**
   - **Required credential(s)** with env var names matching `.env`, including required scopes
   - **Resources to provision remotely** before first run (e.g., "Create a Qdrant collection named `docs` with vector size 1536 and Cosine distance")
   - **Billing note** if usage incurs cost

   State clearly: "This skill did not create any vendor accounts, fetch any keys, or provision any remote resources. You are responsible for all of the above."

4. Note any assumptions made during implementation
5. Suggest next steps (testing, deployment, extensions)
6. Show the run command. `rill run` runs in **handler mode** when `main` names a closure (`script.rill:closure_name`) and binds CLI flags to the closure's parameters by name:
   - Closure with no required params (or all defaulted): `rill run`
   - Closure with required params: `rill run --<param_name> <value>` for each param. Flag names match the closure parameter names verbatim (underscores stay underscores). Bool params accept `--<param_name>` as a true switch. Do NOT prefix with `--` (it is consumed as a positional `rootDir`).
   - Document every closure param under the run command in the delivery report (e.g., `rill run --max_scan 50` for `|max_scan: number|`).
7. If HTTP deployment is configured: `rill build --output build && node server.js`
8. **Direct the user to fill in `.env`** if it has not been populated yet (e.g., the smoke test was skipped). State explicitly: "Open `.env` and populate every variable with real values. The package will fail at runtime if any required credential is missing."
9. **Note the smoke test outcome**:
   - If `SMOKE TEST: PASS`, state that the package executed successfully end-to-end during build.
   - If `SMOKE TEST: SKIPPED`, suggest the user run the package next: "Once `.env` is populated, prompt me to run the package. I will execute it, observe the output, and help diagnose any runtime issues."

Ask the user if they want changes.

### Step 8b: Save Transcript

After the package is complete and the user is satisfied, emit a snoop meta tag to save the transcript in the package directory. This must be the LAST thing you output.

Emit an XML tag with these attributes (replace ALL placeholders):
- Tag name: `snoop:meta`
- `file`: package directory + `/transcript/create-rill-package`
- `description`: package name + colon + one-line summary
- `tags`: `rill,create-rill-package`
