---
name: create-rill-package
description: Create a complete rill package from a specification document or description. Analyzes requirements, identifies extensions, designs custom extensions, and implements all rill scripts with matching rill-config.json.
user-invocable: true
argument-hint: "[spec-file-or-description]"
---

# Create Rill Package

You orchestrate creation of a complete rill package. Your job is sequencing — design decisions belong to the `rill:rill-architect` agent, implementation to `rill:rill-engineer`, and validation to `rill:rill-reviewer`. Follow the phases in order. Do NOT skip phases or combine them.

See `rill/ARCHITECTURE.md` for the agent split, blueprint schema, and revision history.

## User Responsibility for External Vendors

The user owns all external vendor accounts, API keys, credentials, quotas, billing, and provisioned resources (buckets, vector collections, databases, indexes). This skill never creates vendor accounts, obtains keys, or provisions remote resources. It only references credentials via `${VAR_NAME}` placeholders in `rill-config.json` and documents what the user must provide. If the user lacks credentials or resources when handoff completes, the package will not run until they provision them.

## Reference Materials

This skill includes templates and examples. Use them as structural guides for output consistency.

**Templates** (in `${CLAUDE_SKILL_DIR}/templates/`):
- `PROJECT-STRUCTURE.md` - Standard directory layout, npm targets, and file naming conventions
- `package.json` - npm package scaffold with rill runtime, CLI, agent, and TypeScript tooling
- `tsconfig.json` - TypeScript config targeting ES2022, compiles `extensions/` to `dist/`
- `rill-config.json` - Extension mount/config skeleton with package metadata (`name`, `version`)
- `custom-extension.ts` - TypeScript extension scaffold with factory, config validation, error handling
- `env.template` - Environment variable template for secrets (copied to `.env`)
- `gitignore` - Ignore rules for `node_modules/`, `dist/`, `build/`, `.env`
- `server.js` - HTTP agent server using `@rcrsr/rill-agent` (optional, for deployment)

**Examples** (in `${CLAUDE_SKILL_DIR}/examples/`):
- `simple-summarizer/` - Single script, one built-in extension (Anthropic LLM), no custom extensions
- `doc-search-pipeline/` - Multiple scripts, 3 built-in extensions (OpenAI, Qdrant, S3) + 1 custom extension (web crawler), with entry point dispatcher

## Phase 0: Verify Prerequisites

Before any other work, verify the environment meets rill's requirements. If any check fails, halt and instruct the user to resolve it before re-running the skill. Do NOT attempt to auto-install system prerequisites.

1. **Platform check — Linux or WSL.** Run `uname -a`. The rill runtime targets Linux (including WSL2 on Windows). If the output shows `Darwin` (macOS) or a non-Linux kernel, warn the user that rill is not officially supported on their platform and ask whether to continue at their own risk.

2. **Node.js check.** Run `node --version`. Require Node.js 20 or newer.

3. **Global rill-cli check.** Run `which rill-run rill-check rill-build 2>/dev/null && npm ls -g @rcrsr/rill-cli 2>/dev/null`. If `@rcrsr/rill-cli` is not globally installed, halt and instruct the user: `npm install -g @rcrsr/rill-cli`.

4. **npm check.** Run `npm --version`.

Report each check's result:

```
PREREQUISITE CHECKS
-------------------
Platform:        [Linux / WSL2 / other]  -> [PASS / FAIL]
Node.js:         [version]                -> [PASS / FAIL]
npm:             [version]                -> [PASS / FAIL]
@rcrsr/rill-cli: [version or missing]     -> [PASS / FAIL]
```

Proceed to Phase 1 only if all checks pass.

## Phase 1: Fetch Documentation

The rill language reference is split into a small index, topic fragments, and a full bundle. Fetch the fragments each downstream agent needs once, then pass them selectively. Subagents do not refetch.

### Rill language reference (split documents)

Base path: `https://raw.githubusercontent.com/rcrsr/rill/refs/heads/main/docs/`

| Document | Path | When to fetch |
|---|---|---|
| Index | `ref-llms.txt` | Optional; small map of fragments |
| Cheatsheet | `llm/cheatsheet.txt` | Always (≈5 KB; passed to architect, engineer config tasks, reviewer) |
| Control flow | `llm/control-flow.txt` | If any rill scripts will be written (≈4 KB) |
| Callables | `llm/callables.txt` | If any rill scripts will be written (≈6 KB) |
| Errors | `llm/errors.txt` | Always for reviewer; for engineer if scripts use `guard`/`retry` (≈5 KB) |
| Anti-patterns | `llm/anti-patterns.txt` | Always for reviewer (≈4 KB) |
| Types | `llm/types.txt` | If scripts use parameterized type assertions or conversions (≈5 KB) |
| Stdlib | `llm/stdlib.txt` | If scripts use string/list/dict methods or `enumerate`/`range` (≈3 KB) |
| Style | `llm/style.txt` | Optional; included only on demand (≈3 KB) |
| Full bundle | `ref-llms-full.txt` | When writing complete rill scripts (≈32 KB) |

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
| Phase 7b (engineer — rill-config.json) | – | – | – | – | – | – | – | – | – |
| Phase 7c (engineer — TS extensions) | – | – | – | – | – | – | – | – | – |
| Phase 7d (engineer — prompt files) | – | – | – | – | – | – | – | – | – |
| Phase 7e (engineer — rill scripts) | – | – | – | – | – | ✓ | – | ✓ | – |
| Phase 7g (engineer — dispatcher) | – | – | – | – | – | ✓ | – | – | – |
| Phase 7f (reviewer) | ✓ | – | – | ✓ | ✓ | – | – | ✓ | – |

The "Surfaces" column refers to the Extension Surface Inventory (`<package>/.rill-design/extension-surfaces.md`) captured in Phase 4.5. It is the authoritative call-surface reference for the architect (Phase 5), the engineer writing rill scripts (Phase 7e), and the reviewer validating call sites (Phase 7f).

When including docs in an agent prompt, add: "The rill documentation is included below. Do NOT fetch it again."

Phases 7b/c/d do not need the rill language reference — JSON, TypeScript, and `.prompt.md` files do not contain rill syntax. Engineer invocations for those steps run with no rill-doc payload.

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
   find . -name rill-config.json -not -path '*/node_modules/*' -not -path './<new-package>/*'
   ```

2. **Read each sibling `rill-config.json`** and extract the set of extension mounts (the keys of `extensions`, by package name or local path).

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

Delegate to the `rill:rill-architect` agent.

Use Agent with `subagent_type: "rill:rill-architect"` and a prompt containing:
- The full requirements summary from Phase 2
- The user's answers from Phase 3
- The Sibling References inventory and full file contents collected in Phase 3.5
- The extension index content from Phase 1
- The cheatsheet (`llm/cheatsheet.txt`) content from Phase 1
- The package directory path (architect will write the blueprint there)
- Instruction: "The extension index and rill cheatsheet are included below. Do NOT fetch documentation. Sibling-package reference materials are also included; treat them as authoritative local conventions for auth variants, lifted custom extensions, and prompt patterns, and prefer their patterns over generic upstream defaults unless the requirements force otherwise. Identify rill-ext packages, decide on any custom extensions, and write the Extension Plan section of the blueprint at `<package>/.rill-design/blueprint.md`. Note in the blueprint which sibling patterns were reused. Reply with a short summary and any blueprint gaps."

Wait for the architect to write the blueprint. Read the blueprint and surface any "Blueprint gaps" to the user before continuing.

### NPM package discovery (orchestrator step)

If the architect's blueprint specifies a custom extension that wraps an npm package, search for the best candidate before Phase 6:
1. Use WebSearch to find the npm package (e.g., "npm rss parser", "npm stripe sdk")
2. Prefer high download counts, recent updates, TypeScript types
3. Present candidates to the user via `AskUserQuestion` and record the chosen package in the blueprint before proceeding

## Phase 4.5: Probe Extension Surfaces

The architect's Phase 4 selection is based on the extension index — text descriptions, not actual signatures. Before designing the data flow in Phase 5, capture the rich call surface of each chosen rill-ext package via `rill-describe`. This eliminates a class of design errors where the architect assumes a response shape the extension does not produce. Custom extensions are designed by the architect in Phase 6, so their surfaces are known by construction; this phase covers only npm-published rill-ext packages from the Phase 4 Extension Plan.

1. **Create the probe directory** at `<package>/.rill-design/probe/`. This directory holds a throwaway scaffold solely for surface capture; it does not affect the final package install in Phase 7a.

2. **Write `<package>/.rill-design/probe/package.json`** with:
   - `"type": "module"` and `"private": true`
   - Each rill-ext package from the blueprint Extension Plan (Bundled and Vendor) under `dependencies`, pinned to `^0.19` or whatever the latest published minor is
   - `@rcrsr/rill-cli` under `devDependencies`

3. **Write `<package>/.rill-design/probe/rill-config.json`** with:
   - `"version": "0.19"`
   - One mount per chosen extension under a stable shorthand name (e.g., `gws`, `ai`, `prompt`, `kv`, `s3`)
   - For each mount, `config` with literal stub credential values (`"token": "x"`, `"api_key": "x"`, `"base_url": "https://example.test/v1"`, etc.). Use literal `"x"` rather than `${VAR_NAME}` references — the goal is to construct factories, not to run them
   - Omit the `main` field; `rill-describe project` does not need a main script to enumerate mounts

4. **Run** `cd <package>/.rill-design/probe && npm install`. Surface any install failure to the user — a chosen rill-ext package version may not resolve.

5. **For each mount**, run:
   ```
   cd <package>/.rill-design/probe && npx rill-describe project --mount <name> > <name>.surface.json
   ```
   If a mount fails to construct (extension factory throws despite stub config), record the failure and surface it to the user — the chosen extension may need different scaffolding than literal `"x"` values.

6. **Aggregate the captured surfaces** into a single human-readable digest at `<package>/.rill-design/extension-surfaces.md`:

   ```markdown
   # Extension Surface Inventory
   Captured: <ISO-8601 timestamp from `date -u +%Y-%m-%dT%H:%M:%SZ`>
   rill version: <rillVersion field from any surface JSON>

   ## <mount-name> (<package>@<version>)

   ### <callable_name>(<param>: <typeDisplay>, ...) -> <returnTypeDisplay>
   <annotations.description if present>

   ### ...
   ```

   For each callable from each mount, list parameters with their `typeDisplay` and the `returnTypeDisplay`. Include the `annotations.description` when non-empty. Skip property accessors (`isProperty: true`) unless they are referenced in the requirements.

7. **Pass the digest content to Phase 5** as a payload labeled "Extension Surface Inventory". The architect uses the digest to design call sites against authoritative signatures rather than guessed shapes.

8. **Cleanup policy.** Leave `.rill-design/probe/` and `extension-surfaces.md` in place for the duration of the package build — Phase 6 may add custom extensions worth re-probing, and the surfaces are useful debugging context. Do not commit the probe directory; add `/.rill-design/probe/` to `.gitignore` in Step 7a. The digest at `extension-surfaces.md` is small enough to commit and serves as a frozen reference for the design.

## Phase 5: Design Data Flow (architect)

Delegate to the `rill:rill-architect` agent again.

Use Agent with `subagent_type: "rill:rill-architect"` and a prompt containing:
- The package directory path
- The cheatsheet, control-flow, and callables fragments from Phase 1 (`llm/cheatsheet.txt`, `llm/control-flow.txt`, `llm/callables.txt`)
- The Extension Surface Inventory from Phase 4.5 (`<package>/.rill-design/extension-surfaces.md`)
- Any architect notes or user clarifications since Phase 4
- Instruction: "The rill cheatsheet, control-flow, and callables fragments are included below, along with the Extension Surface Inventory captured by `rill-describe`. Do NOT fetch documentation. Do NOT guess extension signatures or response shapes — use the Inventory as the authoritative call surface. Every extension call site you specify in the Pipeline Blueprint must match a signature from the Inventory: parameter order, parameter types, and the nested return shape. Extend the blueprint at `<package>/.rill-design/blueprint.md` with: Pipeline Blueprint section (per script), Prompt Inventory, and Design Checklist Results. Reply with a short summary and any blueprint gaps."

Read the updated blueprint. Present the Pipeline Blueprint and Prompt Inventory sections to the user. Wait for approval before Phase 6.

## Phase 6: Design Custom Extensions (architect)

If Phase 4 identified custom extensions, delegate to the `rill:rill-architect` agent.

Use Agent with `subagent_type: "rill:rill-architect"` and a prompt containing:
- The package directory path
- The custom extension template at `${CLAUDE_SKILL_DIR}/templates/custom-extension.ts`
- The npm package(s) to wrap (confirmed in Phase 4)
- Instruction: "Extend the blueprint at `<package>/.rill-design/blueprint.md` with the Custom Extension API Designs section. Each design specifies the TypeScript interface, function signatures, parameter and return types, config schema, and error codes. Keep extensions thin wrappers — business logic stays in rill scripts. Reply with a short summary."

Read the updated blueprint. Present the Custom Extension API Designs to the user for approval before Phase 7.

If no custom extensions are needed, skip to Phase 7.

## Phase 7: Implement (engineer)

ALL rill code, JSON config, prompt files, and TypeScript extensions go through the `rill:rill-engineer` agent. Each step references the frozen blueprint as the source of truth. The engineer does not redesign — if the blueprint is incomplete, the engineer will return a "Blueprint gap" message; route the gap back to Phase 5 or 6 with the architect.

### Step 7a: Scaffold Project Environment (skill)

Create the package directory structure and Node.js/TypeScript environment.

1. **Create directory structure** following `${CLAUDE_SKILL_DIR}/templates/PROJECT-STRUCTURE.md`:
   ```
   [package-root]/
     .rill-design/      # already created by architect
     extensions/        # only if custom extensions exist
     scripts/           # only if multiple rill scripts
     prompts/           # only if LLM extensions exist
   ```

2. **Generate `package.json`** from `${CLAUDE_SKILL_DIR}/templates/package.json`:
   - Set `name` to the package name
   - Add each rill-ext package from the blueprint Extension Plan to `dependencies`
   - Add npm packages required by custom extensions
   - Always include `@rcrsr/rill-cli` and `@rcrsr/rill-agent` in `devDependencies`
   - If custom TypeScript extensions exist: include `check` (`tsc --noEmit`); add `typescript` and `@types/node` to `devDependencies`. Rill loads `.ts` extensions directly at runtime, so no precompile step is needed.
   - If no custom extensions: omit `check`. Set `build` to `rill-build . --output build` either way.
   - Include the `serve` script if HTTP deployment is requested

3. **Generate `tsconfig.json`** from template (only if custom extensions exist).

4. **Generate `.env`** from `${CLAUDE_SKILL_DIR}/templates/env.template`, including only the variables referenced in the blueprint Extension Plan.

5. **Generate `.gitignore`** from template.

6. **Run `npm install`**. Warn and continue if npm is unavailable.

7. **Generate `server.js`** from template (only if HTTP deployment is requested).

### Step 7b: rill-config.json (engineer)

Use Agent with `subagent_type: "rill:rill-engineer"` and a prompt containing:
- The package directory path
- The blueprint path: `<package>/.rill-design/blueprint.md`
- The rill-config.json template path
- Instruction: "Read the blueprint, then write `rill-config.json` exactly as specified in the Extension Plan section. Use `${VAR_NAME}` for secrets. Bundled extensions use `@rcrsr/rill/ext/<name>`; vendor extensions use the npm name; custom extensions use `./extensions/<file>.ts` (rill loads `.ts` directly at runtime). The `main` field references `script.rill:closure_name` from the blueprint. If anything is unclear, return a Blueprint gap message instead of guessing."

### Step 7c: Custom TypeScript Extensions (engineer, if any)

For each custom extension in the blueprint, use Agent with `subagent_type: "rill:rill-engineer"` and a prompt containing:
- The package directory path
- The blueprint path
- The extension name to implement
- The custom-extension template path
- Instruction: "Read the Custom Extension API Designs section of the blueprint. Implement the extension as a thin wrapper. The factory signature is `(config, ctx: ExtensionFactoryCtx)`. All configuration comes from the factory `config` parameter, never directly from `process.env`. Surface failures via `runCtx.invalidate(error, { code, provider, raw })` using the generic atom taxonomy (`#AUTH`, `#FORBIDDEN`, `#NOT_FOUND`, `#RATE_LIMIT`, `#QUOTA_EXCEEDED`, `#UNAVAILABLE`, `#CONFLICT`, `#PROTOCOL`, `#INVALID_INPUT`, `#TIMEOUT`, `#DISPOSED`, `#TYPE_MISMATCH`); RILL-R004 was retired in rill 0.19.0. Factory-time configuration validation throws `RuntimeError('RILL-R001', ...)`."

After all custom extensions are written, run `npm run check` to verify TypeScript compilation. If errors, fix them by re-invoking the engineer with the error message.

### Step 7d: Prompt Files (engineer, if LLMs are used)

For each prompt in the blueprint Prompt Inventory, use Agent with `subagent_type: "rill:rill-engineer"` and a prompt containing:
- The package directory path
- The blueprint path
- The prompt entry (path, description, params, output mode, called-by)
- Instruction: "Read the Prompt Inventory section of the blueprint. Write the prompt file at the specified path with YAML frontmatter (`description`, `params`) and the prompt body. Use `{name}` interpolation for scalar params only. For list-mode prompts (per blueprint) include `@@ system` / `@@ user` / `@@ assistant` markers; for string-mode include none. Do NOT write `output:` in the frontmatter — rill-ext 0.19.2 prompt-md removed that field and infers mode from body content. Hyphens in filename segments convert to `_` in the resolved callable name (e.g., `summarize-email.prompt.md` → `$prompt.summarize_email`)."

### Step 7e: Rill Scripts (engineer)

For each script in the blueprint Pipeline Blueprint, use Agent with `subagent_type: "rill:rill-engineer"` and a prompt containing:
- The package directory path
- The blueprint path
- The specific PIPELINE section the engineer should implement
- The rill-config.json content (so the engineer knows available mounts)
- The Extension Surface Inventory from Phase 4.5 (`<package>/.rill-design/extension-surfaces.md`)
- The full rill language bundle (`ref-llms-full.txt`) content from Phase 1
- Instruction: "The full rill language bundle and the Extension Surface Inventory are included below. Do NOT fetch documentation. Read the blueprint and implement the specified PIPELINE exactly. Closure name, parameter names and types, return type, operator choices, and extension calls must match the blueprint. Every extension call site must match a signature from the Inventory — if the blueprint contradicts the Inventory, return a Blueprint gap message instead of guessing. Use `log` only for operational messages."

For projects with multiple scripts, you MAY launch multiple `rill:rill-engineer` agents in parallel for independent scripts. Scripts that depend on each other must be implemented sequentially.

### Step 7f: Validate (reviewer)

Use Agent with `subagent_type: "rill:rill-reviewer"` and a prompt containing:
- The package directory path (absolute)
- The blueprint path
- The cheatsheet, errors, and anti-patterns fragments from Phase 1 (`llm/cheatsheet.txt`, `llm/errors.txt`, `llm/anti-patterns.txt`)
- The Extension Surface Inventory from Phase 4.5 (`<package>/.rill-design/extension-surfaces.md`)
- Instruction: "The rill cheatsheet, errors, anti-patterns, and the Extension Surface Inventory are included below. Do NOT fetch documentation. Validate the implementation against the blueprint and the Inventory. Run rill-check on every .rill file, tsc --noEmit if extensions/ exists, verify every extension call site matches a signature from the Inventory (param order, types, return shape), and grade design conformance. Return the structured review report."

If the verdict is FAIL, route the violations back to the engineer:
- For tooling failures (rill-check / tsc), invoke the engineer with the specific error and the affected file
- For design-conformance failures, invoke the engineer with the violation and the blueprint section it violates
- After fixes, re-invoke the reviewer

Repeat until the reviewer returns PASS, or after 3 unsuccessful loops, halt and report the open violations to the user.

### Step 7g: Entry Point (engineer, multi-script only)

If the package has multiple scripts, use Agent with `subagent_type: "rill:rill-engineer"` to create the dispatcher in `main.rill`. Reference the blueprint's Pipeline Blueprint sections for the available scripts.

### Step 7h: Runtime Smoke Test (engineer fix-loop)

The reviewer in Step 7f only checks static syntax (`rill-check`, `tsc --noEmit`). It cannot detect wrong extension call shapes, wrong prompt filenames, or call-site signature mismatches. Run a single end-to-end execution to surface those defects before delivery.

1. **Inform the user** that a runtime smoke test is required. State: "The package compiles and passes static review. Before delivery, I will run it once to catch runtime errors that static checks miss. This requires `.env` populated with real credentials."

2. **Use `AskUserQuestion`** to ask: did the user populate `.env`, or do they want to skip the smoke test?
   - If skipped, record `SMOKE TEST: SKIPPED (no credentials)` and proceed to Phase 8 with a delivery warning.
   - If proceeding, continue.

3. **Build the run command** from the blueprint's main closure signature:
   - No required params: `npm run dev`
   - Required params: `npm run dev -- --<param_name> <value>` for each, using minimal valid sample values from the blueprint

4. **Execute** and capture exit code, stdout, and stderr.

5. **Classify the outcome:**
   - Exit 0: `SMOKE TEST: PASS`. Proceed to Phase 8.
   - Exit non-zero with credential or quota error (HTTP 401/403, `invalid_grant`, `missing API key`, rate-limit messages): treat as environmental, not an implementation defect. Surface the stderr to the user, ask whether to retry after credential fix or proceed to delivery, and do not loop on the engineer.
   - Exit non-zero with any other error (runtime halt, extension call shape mismatch, missing prompt callable, type assertion failure): treat as an implementation defect; route to the engineer fix-loop.

6. **Engineer fix-loop for implementation defects.** Use Agent with `subagent_type: "rill:rill-engineer"` and a prompt containing:
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
6. Show the run command. `rill-run` runs in **handler mode** when `main` names a closure (`script.rill:closure_name`) and binds CLI flags to the closure's parameters by name:
   - Closure with no required params (or all defaulted): `npm run dev`
   - Closure with required params: `npm run dev -- --<param_name> <value>` for each param. Flag names match the closure parameter names verbatim (underscores stay underscores). Bool params accept `--<param_name>` as a true switch.
   - Document every closure param under the run command in the delivery report (e.g., `npm run dev -- --max_scan 50` for `|max_scan: number|`).
7. If HTTP deployment is configured: `npm run build && npm run serve`
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
