---
name: create-rill-package
description: Create a complete rill package from a specification document or description. Analyzes requirements, identifies extensions, designs custom extensions, and implements all rill scripts with matching rill-config.json.
user-invocable: true
argument-hint: "[spec-file-or-description]"
---

# Create Rill Package

You orchestrate creation of a complete rill package. Your job is sequencing — design decisions belong to the `rill-architect` agent, implementation to `rill-engineer`, and validation to `rill-reviewer`. Follow the phases in order. Do NOT skip phases or combine them.

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

Fetch reference docs once. Pass them to subagents as needed; subagents do not refetch.

1. **Rill language reference:**
   `curl -sL https://raw.githubusercontent.com/rcrsr/rill/refs/heads/main/docs/ref-llm.txt`

2. **Extension index:**
   `curl -sL https://raw.githubusercontent.com/rcrsr/rill-ext/refs/heads/main/llms.txt`

3. **Rill-agent reference** (only if HTTP deployment is needed):
   `curl -sL https://raw.githubusercontent.com/rcrsr/rill-agent/refs/heads/main/llms.txt`

Selective inclusion in agent prompts:

| Invocation | Language ref | Extension index | Agent ref |
|-----------|--------------|-----------------|-----------|
| Phase 4 (architect — identify extensions) | No | Yes | No |
| Phase 5 (architect — design data flow) | Yes | No | No |
| Phase 6 (architect — custom extensions) | No | No | No |
| Phase 7a (skill — scaffold) | No | No | Yes (only if `serve`) |
| Phase 7b/c/d/e (engineer) | Yes | No | No |
| Phase 7f (reviewer) | No | No | No |

When including docs in an agent prompt, add: "The rill documentation is included below. Do NOT fetch it again."

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

Ask ONLY relevant questions. Use `AskUserQuestion` to combine all into one call. Wait for the response before Phase 4.

## Phase 4: Identify Capabilities and Extensions (architect)

Delegate to the `rill-architect` agent.

Use Agent with `subagent_type: "rill-architect"` and a prompt containing:
- The full requirements summary from Phase 2
- The user's answers from Phase 3
- The extension index content from Phase 1
- The package directory path (architect will write the blueprint there)
- Instruction: "The extension index is included below. Do NOT fetch documentation. Identify rill-ext packages, decide on any custom extensions, and write the Extension Plan section of the blueprint at `<package>/.rill-design/blueprint.md`. Reply with a short summary and any blueprint gaps."

Wait for the architect to write the blueprint. Read the blueprint and surface any "Blueprint gaps" to the user before continuing.

### NPM package discovery (orchestrator step)

If the architect's blueprint specifies a custom extension that wraps an npm package, search for the best candidate before Phase 6:
1. Use WebSearch to find the npm package (e.g., "npm rss parser", "npm stripe sdk")
2. Prefer high download counts, recent updates, TypeScript types
3. Present candidates to the user via `AskUserQuestion` and record the chosen package in the blueprint before proceeding

## Phase 5: Design Data Flow (architect)

Delegate to the `rill-architect` agent again.

Use Agent with `subagent_type: "rill-architect"` and a prompt containing:
- The package directory path
- The rill language reference content from Phase 1
- Any architect notes or user clarifications since Phase 4
- Instruction: "The rill language reference is included below. Do NOT fetch documentation. Extend the blueprint at `<package>/.rill-design/blueprint.md` with: Pipeline Blueprint section (per script), Prompt Inventory, and Design Checklist Results. Reply with a short summary and any blueprint gaps."

Read the updated blueprint. Present the Pipeline Blueprint and Prompt Inventory sections to the user. Wait for approval before Phase 6.

## Phase 6: Design Custom Extensions (architect)

If Phase 4 identified custom extensions, delegate to the `rill-architect` agent.

Use Agent with `subagent_type: "rill-architect"` and a prompt containing:
- The package directory path
- The custom extension template at `${CLAUDE_SKILL_DIR}/templates/custom-extension.ts`
- The npm package(s) to wrap (confirmed in Phase 4)
- Instruction: "Extend the blueprint at `<package>/.rill-design/blueprint.md` with the Custom Extension API Designs section. Each design specifies the TypeScript interface, function signatures, parameter and return types, config schema, and error codes. Keep extensions thin wrappers — business logic stays in rill scripts. Reply with a short summary."

Read the updated blueprint. Present the Custom Extension API Designs to the user for approval before Phase 7.

If no custom extensions are needed, skip to Phase 7.

## Phase 7: Implement (engineer)

ALL rill code, JSON config, prompt files, and TypeScript extensions go through the `rill-engineer` agent. Each step references the frozen blueprint as the source of truth. The engineer does not redesign — if the blueprint is incomplete, the engineer will return a "Blueprint gap" message; route the gap back to Phase 5 or 6 with the architect.

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
   - If custom TypeScript extensions exist: include `predev` (`tsc`), `check` (`tsc --noEmit`), `build` (`tsc && rill-build . --output build`); add `typescript` and `@types/node` to `devDependencies`
   - If no custom extensions: omit `predev`/`check`, set `build` to `rill-build . --output build`
   - Include the `serve` script if HTTP deployment is requested

3. **Generate `tsconfig.json`** from template (only if custom extensions exist).

4. **Generate `.env`** from `${CLAUDE_SKILL_DIR}/templates/env.template`, including only the variables referenced in the blueprint Extension Plan.

5. **Generate `.gitignore`** from template.

6. **Run `npm install`**. Warn and continue if npm is unavailable.

7. **Generate `server.js`** from template (only if HTTP deployment is requested).

### Step 7b: rill-config.json (engineer)

Use Agent with `subagent_type: "rill-engineer"` and a prompt containing:
- The package directory path
- The blueprint path: `<package>/.rill-design/blueprint.md`
- The rill-config.json template path
- Instruction: "Read the blueprint, then write `rill-config.json` exactly as specified in the Extension Plan section. Use `${VAR_NAME}` for secrets. Bundled extensions use `@rcrsr/rill/ext/<name>`; vendor extensions use the npm name; custom extensions use `./dist/extensions/<file>.js`. The `main` field references `script.rill:closure_name` from the blueprint. If anything is unclear, return a Blueprint gap message instead of guessing."

### Step 7c: Custom TypeScript Extensions (engineer, if any)

For each custom extension in the blueprint, use Agent with `subagent_type: "rill-engineer"` and a prompt containing:
- The package directory path
- The blueprint path
- The extension name to implement
- The custom-extension template path
- Instruction: "Read the Custom Extension API Designs section of the blueprint. Implement the extension as a thin wrapper. All configuration comes from the factory `config` parameter, never directly from `process.env`. Errors use RILL-R004 format."

After all custom extensions are written, run `npm run check` to verify TypeScript compilation. If errors, fix them by re-invoking the engineer with the error message.

### Step 7d: Prompt Files (engineer, if LLMs are used)

For each prompt in the blueprint Prompt Inventory, use Agent with `subagent_type: "rill-engineer"` and a prompt containing:
- The package directory path
- The blueprint path
- The prompt entry (path, description, params, output mode, called-by)
- Instruction: "Read the Prompt Inventory section of the blueprint. Write the prompt file at the specified path with YAML frontmatter (`description`, `params`, `output`) and the prompt body. Use `{name}` interpolation for scalar params only. For `output: list`, use `@@ system` and `@@ user` markers."

### Step 7e: Rill Scripts (engineer)

For each script in the blueprint Pipeline Blueprint, use Agent with `subagent_type: "rill-engineer"` and a prompt containing:
- The package directory path
- The blueprint path
- The specific PIPELINE section the engineer should implement
- The rill-config.json content (so the engineer knows available mounts)
- The rill language reference content from Phase 1
- Instruction: "The rill language reference is included below. Do NOT fetch documentation. Read the blueprint and implement the specified PIPELINE exactly. Closure name, parameter names and types, return type, operator choices, and extension calls must match the blueprint. Use `log` only for operational messages."

For projects with multiple scripts, you MAY launch multiple `rill-engineer` agents in parallel for independent scripts. Scripts that depend on each other must be implemented sequentially.

### Step 7f: Validate (reviewer)

Use Agent with `subagent_type: "rill-reviewer"` and a prompt containing:
- The package directory path (absolute)
- The blueprint path
- Instruction: "Validate the implementation against the blueprint. Run rill-check on every .rill file, tsc --noEmit if extensions/ exists, and grade design conformance. Return the structured review report."

If the verdict is FAIL, route the violations back to the engineer:
- For tooling failures (rill-check / tsc), invoke the engineer with the specific error and the affected file
- For design-conformance failures, invoke the engineer with the violation and the blueprint section it violates
- After fixes, re-invoke the reviewer

Repeat until the reviewer returns PASS, or after 3 unsuccessful loops, halt and report the open violations to the user.

### Step 7g: Entry Point (engineer, multi-script only)

If the package has multiple scripts, use Agent with `subagent_type: "rill-engineer"` to create the dispatcher in `main.rill`. Reference the blueprint's Pipeline Blueprint sections for the available scripts.

## Phase 8: Review and Deliver

After implementation passes review:

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
6. Show the run command: `npm run dev`
7. If HTTP deployment is configured: `npm run build && npm run serve`
8. **Direct the user to fill in `.env`**. State explicitly: "Open `.env` and populate every variable with real values. The package will fail at runtime if any required credential is missing."
9. **Suggest running the package next**: "Once `.env` is populated, prompt me to run the package (e.g., `run the package`). I will execute it, observe the output, and help diagnose any runtime issues."

Ask the user if they want changes.

### Step 8b: Save Transcript

After the package is complete and the user is satisfied, emit a snoop meta tag to save the transcript in the package directory. This must be the LAST thing you output.

Emit an XML tag with these attributes (replace ALL placeholders):
- Tag name: `snoop:meta`
- `file`: package directory + `/transcript/create-rill-package`
- `description`: package name + colon + one-line summary
- `tags`: `rill,create-rill-package`
