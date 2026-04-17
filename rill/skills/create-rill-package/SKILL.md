---
name: create-rill-package
description: Create a complete rill package from a specification document or description. Analyzes requirements, identifies extensions, designs custom extensions, and implements all rill scripts with matching rill-config.json.
user-invocable: true
argument-hint: "[spec-file-or-description]"
allowed-tools: Read,Write,Edit,Glob,Grep,Bash,WebFetch,Agent,AskUserQuestion
---

# Create Rill Package

You are building a complete rill package from a user specification. Follow these phases in order. Do NOT skip phases or combine them.

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

Read the relevant example before implementing. Use `simple-summarizer` as a model for single-script packages. Use `doc-search-pipeline` as a model for multi-script packages with custom extensions.

## Phase 0: Verify Prerequisites

Before any other work, verify the environment meets rill's requirements. If any check fails, halt and instruct the user to resolve it before re-running the skill. Do NOT attempt to auto-install system prerequisites.

1. **Platform check — Linux or WSL.** Run `uname -a`. The rill runtime targets Linux (including WSL2 on Windows). If the output shows `Darwin` (macOS) or a non-Linux kernel, warn the user that rill is not officially supported on their platform and ask whether to continue at their own risk. If the output contains `Microsoft` or `WSL`, confirm WSL2 is in use.

2. **Node.js check.** Run `node --version`. Require Node.js 20 or newer. If missing or below 20, halt and tell the user to install Node 20+ (recommend `nvm install 20`).

3. **Global rill-cli check.** Run `which rill-run rill-check rill-build 2>/dev/null && npm ls -g @rcrsr/rill-cli 2>/dev/null`. If `@rcrsr/rill-cli` is not globally installed, halt and instruct the user:
   ```
   npm install -g @rcrsr/rill-cli
   ```
   The global install provides `rill-run`, `rill-check`, and `rill-build` on PATH. Local `npx` fallbacks work but the skill assumes global availability for validation steps in Phase 7e.

4. **npm check.** Run `npm --version`. If missing, halt and instruct the user to install npm (usually bundled with Node).

Report each check's result in a single block:

```
PREREQUISITE CHECKS
-------------------
Platform:       [Linux / WSL2 / other]  -> [PASS / FAIL]
Node.js:        [version]                -> [PASS / FAIL]
npm:            [version]                -> [PASS / FAIL]
@rcrsr/rill-cli: [version or missing]    -> [PASS / FAIL]
```

Proceed to Phase 1 only if all checks pass.

## Phase 1: Fetch Documentation

Fetch the reference docs before gathering requirements. The rill language reference and extension index provide context for identifying capabilities, asking informed clarifying questions, and making design decisions in later phases.

1. **Fetch the rill language reference** (for script-writing agents):
   ```
   curl -sL https://raw.githubusercontent.com/rcrsr/rill/refs/heads/main/docs/ref-llm.txt
   ```

2. **Fetch the extension index** (for extension identification):
   ```
   curl -sL https://raw.githubusercontent.com/rcrsr/rill-ext/refs/heads/main/llms.txt
   ```

3. **Fetch the rill-agent reference** (for HTTP deployment and bundling):
   ```
   curl -sL https://raw.githubusercontent.com/rcrsr/rill-agent/refs/heads/main/llms.txt
   ```

Store all outputs. Pass selectively to each agent:

| Agent invocation | Include language ref? | Include extension index? | Include agent ref? | Fetch per-extension doc? |
|-----------------|----------------------|--------------------------|--------------------|--------------------------|
| Phase 4 (identify extensions) | No | Yes (5KB) | No | No |
| Step 7b (rill-config.json) | No | No | No | Yes, via deep link from index |
| Step 7c (custom extensions) | No | No | No | No |
| Step 7d (rill scripts) | Yes (29KB) | No | No | No |
| Step 7a (server.js, bundling) | No | No | Yes | No |

When including docs in an agent prompt, add: "The rill documentation is included below. Do NOT fetch it again."

## Phase 2: Gather Requirements

The user provided: `$ARGUMENTS`

**If the argument is a file path** (ends in `.md`, `.txt`, `.doc`, `.pdf`, or starts with `/`, `./`, `~`):
- Read the file using the Read tool
- Extract all functional requirements, inputs, outputs, data flows, and integration points

**If the argument is an inline description:**
- Parse the description for requirements

**If no argument was provided:**
- Use the `AskUserQuestion` tool to ask: "Describe the rill package you want to build. Include: what it does, what data it processes, what external services it connects to, and what output it produces."

Use the extension index from Phase 1 to identify which rill capabilities match the stated requirements. This informs the requirements summary with concrete extension and pattern references.

After gathering requirements, produce a structured summary:

```
REQUIREMENTS SUMMARY
--------------------
Purpose: [one sentence]
Inputs: [list data sources]
Outputs: [list expected outputs]
External services: [list APIs, databases, storage]
Data transformations: [list processing steps]
Error conditions: [list failure modes]
```

### Determine Project Location

Always create the package in a new subfolder named after the package (lowercase, hyphens). This keeps packages isolated and makes the transcript `file` path unambiguous.

Record the decision as:
```
PACKAGE LOCATION: subfolder: package-name/
```

Include this decision in the requirements summary output.

## Phase 3: Ask Clarifying Questions

Review the requirements summary and the extension index from Phase 1 for gaps. Use your knowledge of available rill extensions and language features to ask targeted questions.

Ask the user about ANY of these that are unclear:

1. **Data format**: What format are inputs/outputs? (JSON, CSV, plain text, binary)
2. **LLM usage**: Does the package need LLM capabilities? Which provider? (Anthropic, OpenAI, Gemini)
3. **Storage**: Does it need persistent state? (SQLite for local, Redis for distributed)
4. **File storage**: Does it need file/object storage? (S3, R2, MinIO)
5. **Vector search**: Does it need embeddings or semantic search? (Qdrant, Pinecone, ChromaDB)
6. **MCP servers**: Does it need to connect to MCP tool servers?
7. **Claude Code**: Does it need to invoke Claude Code CLI?
8. **Concurrency**: Are operations independent (use `map`) or sequential (use `each`)?
9. **Error handling**: What happens on failure? Halt, retry, skip?
10. **Scale**: Expected data volumes? (affects iteration limits, batch sizes)
11. **Vendor provisioning**: For each external service identified (LLM provider, storage, vector DB, MCP server, payment processor, etc.), does the user already have an active account, valid API key, and any required resources provisioned (buckets created, vector collections with correct dimensions, database schemas, webhook endpoints)? If not, explicitly state that the user must provision these before running the package; this skill will not do it.

Ask ONLY the questions relevant to the package. Do NOT ask all 11 for every package.

Use the `AskUserQuestion` tool to present your questions. Combine all relevant questions into one AskUserQuestion call. Wait for the user's response before proceeding to Phase 4.

## Phase 4: Identify Rill Capabilities and Extensions

Delegate to the `rill-engineer` agent to identify which rill language features and extensions apply.

Use the Agent tool with `subagent_type: "rill-engineer"` and a prompt that includes:
- The full requirements summary from Phase 2
- The user's answers from Phase 3
- The extension index content fetched in Phase 1
- A request to: identify which rill-ext packages are needed (using the provided extension index), what configuration each requires, and which rill language patterns best fit the data flow
- Instruction: "The extension index is included below. Do NOT fetch documentation — use what is provided."
- A request to identify any capabilities that require custom TypeScript extensions (not covered by built-in rill-ext packages)

### When to create a custom extension

Only create a custom extension when one of these applies:

1. **External data access.** The package needs to fetch from or push to a service with no built-in rill-ext coverage (RSS feeds, vendor APIs, proprietary protocols). Wrap the minimum necessary functionality from an npm SDK package.
2. **Vendor SDK integration.** A third-party npm package provides the best way to interact with a service (e.g., `fast-xml-parser` for RSS, `@aws-sdk/client-s3` for S3, `stripe` for payments). The extension wraps the SDK, not reimplements it.
3. **Complexity beyond rill.** The logic involves binary data processing, cryptographic operations, or stateful protocols that rill's string/list/dict types cannot express cleanly.

Do NOT create a custom extension for:
- Logic that rill operators can express (filtering, sorting, formatting, string manipulation)
- LLM interactions (use built-in LLM extensions)
- File I/O or KV storage (use built-in rill-ext packages)

### NPM package discovery

When a custom extension is needed, search for relevant npm packages:
1. Use WebSearch to find the best npm package for the capability (e.g., "npm rss parser", "npm stripe sdk")
2. Prefer packages with high download counts, recent updates, and TypeScript types
3. Present the candidate package(s) to the user for approval before adding to `package.json`

From the agent's response, produce:

```
EXTENSION PLAN
--------------
Bundled extensions needed:
  - [name]: [purpose] -> mount as "[namespace]" from "@rcrsr/rill/ext/[name]"

Vendor extensions needed:
  - [package name]: [purpose] -> mount as "[namespace]"

Custom extensions needed:
  - [name]: [what it does, why no built-in covers it]
  - npm package: [package name] — [what it provides]
  - Functions exposed to rill: [list]

Key rill patterns:
  - [pattern]: [where it applies]
```

ALL extensions — bundled, vendor, and custom — MUST appear in `extensions.mounts` in `rill-config.json`. Bundled extensions use `@rcrsr/rill/ext/<name>` as the mount path (listed in the "Import" column of the extension index). Vendor extensions use their npm package name. Custom extensions use `./dist/extensions/<file>.js`.

## Phase 5: Design the Data Flow

Before writing any code, design the rill pipeline as a blueprint. This separates "what operators and patterns to use" from "write correct syntax." The skill executor (you) does this step directly — do NOT delegate to an agent.

Using the extension plan from Phase 4 and the rill language reference from Phase 1, produce a **pipeline blueprint** that maps the full data flow in rill pseudocode.

### Design principles

1. **Express workflows in rill, not prompts.** Filtering, sorting, ranking, formatting, string manipulation, and data transformation belong in rill operators (`filter`, `map`, `fold`, `->` pipes). Do NOT delegate logic to the LLM that rill can express directly. LLM calls are for generation, summarization, data extraction from unstructured text, and tasks that require language understanding — not for processing well-defined structured data.

2. **Use LLM calls sparingly with atomic, well-scoped tasks.** Each LLM call should do one thing with a prescriptive, opinionated prompt. Prefer multiple focused calls over one large open-ended call. If the logic can be expressed as a rill pipeline (even a complex one), prefer rill.

3. **Choose the right data-gathering pattern.** When a pipeline needs external data to enrich LLM context, pick one of these two patterns based on the decision flow below.

   **Decision flow:**
   ```
   Does the script know WHAT to fetch before calling the LLM?
   ├── YES: items are enumerable (list of commits, URLs, IDs, records)
   │   └── Use PREFETCH: iterate with map/each, gather data, pass to message/generate
   └── NO: the LLM must decide what to fetch based on intermediate results
       ├── Is the provider OpenAI-native? (not Groq, Ollama, or other compatible APIs)
       │   ├── YES → Use tool_loop with tool closures
       │   └── NO → Restructure as prefetch if possible, or use OpenAI provider
       └── Does the LLM need multi-step reasoning to decide what to fetch?
           ├── YES → tool_loop is the only option; confirm provider supports it
           └── NO → Prefer prefetch; simpler, faster, no provider constraints
   ```

   **Prefetch pattern** (preferred when items are known):
   ```rill
   # Gather data deterministically, then summarize
   $items -> map {
     $cmd.tool(list["fetch", $]) -> .stdout
   } -> .join("\n---\n") => $context

   $ai.message("Summarize:\n\n{$context}")() -> .content => $summary
   ```
   Prefetch runs without LLM round-trips, works with all providers, and keeps the LLM focused on understanding rather than orchestrating.

   **Tool loop pattern** (only when LLM must decide what to fetch):
   ```rill
   # Define tool closures the LLM can call
   ^("Search docs by query") |^("Search query") q: string| {
     $cmd.search(list[$q]) -> .stdout
   }:string => $search

   # LLM decides which tools to call and when
   $ai.tool_loop(
     "Answer the question using search.\n\nQuestion: {$question}",
     dict[search: $search],
     dict[max_turns: 10]
   )() -> .content => $answer
   ```

   **Provider compatibility:** `tool_loop` sends provider-specific message properties (e.g., `parsed` for OpenAI). Non-OpenAI providers (Groq, Ollama, Together) may reject these. During Phase 3, confirm provider support if tool_loop is planned.

4. **Prefer `generate` over `message` for structured LLM output.** Use `$ext.generate(prompt, dict[schema: ...])` when the LLM output has a known shape. Structured output enforces the schema at the API level and returns `.data` with typed fields. Fall back to `$ext.message()` for free-form text or when the provider does not support `json_schema` response format. During Phase 3, confirm whether the target model supports structured output.

   **Schema format for `generate`:** Use a legacy dict with string type names, not `.^input` structural types. The `generate` function calls `buildJsonSchema`, which expects this format:

   ```rill
   # Simple schema — values are type name strings
   dict[name: "string", age: "number", active: "bool"] => $schema

   # Schema with descriptions — values are dicts with type and description
   dict[
     name: dict[type: "string", description: "Full name"],
     age: dict[type: "number", description: "Age in years"]
   ] => $schema

   # Nested schema — dict type with properties
   dict[
     user: dict[type: "dict", properties: dict[name: "string", email: "string"]]
   ] => $schema

   $ai.generate("Extract user info: Alice, 30", dict[schema: $schema]) -> .data
   ```

   Do NOT use `$closure.^input` as the schema — the `generate` function does not accept structural types.

5. **Put instructions in the message prompt, not the system prompt.** The `system` field in rill-config.json is unreliable across providers and models. Some models ignore or deprioritize system prompts. Place all task instructions, formatting rules, and constraints directly in the message prompt passed to `generate` or `message`. This produces consistent results regardless of provider. Reserve the config `system` field for identity-level context only (e.g., "You are a technical editor"), not for output instructions.

6. **Put static data in rill-config.json, not in scripts.** Lists of URLs, API endpoints, constants, and resource identifiers belong in `extensions.config` and are accessed via extension functions or config values. Scripts should read configuration, not hard-code it. This keeps scripts reusable across different configurations.

7. **Wrap scripts in fully decorated typed closures with return type signatures.** Every script must define a named closure with typed input parameters and a structural return type assertion (`:type` after the closing brace). Fully decorate the closure: `^("description")` on the closure itself and `^("description")` on every parameter. This metadata is visible to callers and tooling via `.^description`, `.^input`, and `.^output` reflection. The `main` field in `rill-config.json` references the closure name (e.g., `"main": "main.rill:summarize"`).

   ```rill
   # Fully decorated entry point with return type
   ^("Summarize top AI news") |^("Number of items to return") count: number| {
     # pipeline here...
     dict[items: $results, count: $results -> .len]
   }:dict(items: list, count: number) => $summarize
   ```

   Use the full structural type that matches the closure's return value. For simple returns use `:string` or `:number`. For dicts use `:dict(field: type, ...)`. This enables callers and tooling to inspect the output shape without reading the implementation.

   The `rill-config.json` entry point names the closure:
   ```json
   { "main": "main.rill:summarize" }
   ```

8. **Log operations, never functional results.** Use `log` for operational visibility (progress, timing, warnings). Never use `log` for primary output. All functional results must be returned as structured, typed values from the closure. Callers consume the return value, not log output.

   ```rill
   # Good: log for operations, return for results
   "Fetching {$urls -> .len} feeds..." -> log
   $results  # returned as structured data

   # Bad: logging the result
   $results -> log  # caller can't consume this
   ```

### Script boundary decision

Decide whether the package needs one script or multiple:
- **Single script**: The entire data flow is one pipeline with no branching entry points. Use `main.rill`.
- **Multiple scripts**: The package has distinct modes (e.g., ingest vs search), reusable sub-pipelines, or scripts that exceed 50 lines. Split into `scripts/` and use `main.rill` as dispatcher.

### Pipeline blueprint format

For each script, produce a step-by-step blueprint. Each step must specify:
1. **What** — the transformation in plain language
2. **Operator** — which rill operator (`map`, `each`, `fold`, `filter`, `->`) and why
3. **Extension call** — which `$ext.function()` if any, with key parameters
4. **Data shape** — what the step produces (type and structure)

Use this format:

```
PIPELINE: [script-name.rill]
---
Step 1: [description]
  Operator: [-> / map / each / fold / filter]
  Call: $ext.function(params)
  Produces: [type] — [shape description]

Step 2: [description]
  Operator: [...]
  ...
```

### Operator selection rules

Apply these rules when choosing operators:

| Situation | Operator | Rationale |
|-----------|----------|-----------|
| Transform items independently, no I/O | `map` | Parallel, no side effects |
| Transform items with I/O (API calls) | `each` | Sequential, respects rate limits |
| Remove items from a collection | `filter` | Parallel, returns matching items |
| Reduce collection to single value | `fold(init)` | Sequential with accumulator `$@` |
| Chain transforms on a single value | `->` pipe | Left-to-right data flow |
| Resolve LLM stream to result | `()` | Stream resolution |
| Index items during iteration | `enumerate -> each/map` | Access via `$.index`, `$.value` |

### Design checklist

Before moving to Phase 6, verify the blueprint covers:
- [ ] Every data source has an extension call or host input
- [ ] Every intermediate value has a named capture (`=> $name`) only if reused
- [ ] `map` is used for pure transforms, `each` for side effects or sequential I/O
- [ ] LLM calls use `generate` with legacy dict schema when output shape is known; fall back to `message` for free-form text
- [ ] Task instructions live in the message prompt, not in the config `system` field
- [ ] Script is wrapped in a named typed closure, fully decorated (`^("desc")` on closure and every param)
- [ ] The final expression is the return value (structured data, no `log`)
- [ ] `log` is used only for operational messages (progress, warnings), never for results
- [ ] Script stays under 50 lines (split if over)
- [ ] No LLM call does what a rill operator can do (filtering, sorting, formatting)
- [ ] Static data (URLs, constants, system prompts) lives in rill-config.json, not hard-coded
- [ ] Data gathering follows the decision flow: prefetch when items are known, tool_loop only when LLM must decide what to fetch
- [ ] If tool_loop is used, provider compatibility is confirmed (non-OpenAI providers may reject it)
- [ ] Every exec command has arg constraints: use `allowedArgs` when all args are static and predictable; use `blockedArgs` when args include dynamic values (URLs, user input)

Present the pipeline blueprint to the user. Wait for approval before proceeding to Phase 6.

## Phase 6: Design Custom Extensions

If Phase 4 identified custom extensions, first confirm third-party dependencies with the user, then delegate the design.

### Step 6a: Confirm third-party packages

If the extension plan includes npm packages the user hasn't explicitly requested, present them for approval:

"The package needs [capability]. I recommend using [npm-package] ([download count], [last updated]). This adds a third-party dependency. Approve?"

Do NOT proceed with a third-party package the user hasn't confirmed.

### Step 6b: Design the extension

Custom extensions should be **thin wrappers** around npm packages. The extension translates between the npm SDK's API and rill's type system (`RillValue`, `RillFunction`). Keep business logic in rill scripts, not in the extension.

Use the Agent tool with `subagent_type: "rill-engineer"` and a prompt that includes:
- The extension plan from Phase 4 (including the npm package to wrap)
- The pipeline blueprint from Phase 5 (so the agent sees how extension functions are called)
- The custom extension template at `${CLAUDE_SKILL_DIR}/templates/custom-extension.ts`
- A request to design each custom extension: TypeScript interface, function signatures, parameter types, return types, config schema, error handling
- A request to ensure designs follow rill-ext conventions (RillStream for streaming, RILL-R004 for errors)
- Instruction: "Design a thin wrapper around the npm package. Expose only the functions the rill script needs. Keep the extension focused and minimal. All configuration and credentials must come from rill-config.json (via the factory config parameter), not from environment variables read directly in the extension."

Present the extension designs to the user for approval before implementing.

If no custom extensions are needed, skip to Phase 7.

## Phase 7: Implement the Solution

ALL rill code and rill-config.json in this phase MUST go through the `rill-engineer` agent. The agent has access to the latest rill documentation and enforces correctness. Environment scaffolding (package.json, tsconfig, etc.) is handled directly by this skill.

### Step 7a: Scaffold Project Environment

Create the package directory structure and Node.js/TypeScript environment. Read the templates and adapt them to the package.

1. **Create directory structure** following `${CLAUDE_SKILL_DIR}/templates/PROJECT-STRUCTURE.md`, using the package location decision from Phase 2:
   - If **current directory**: create `extensions/` and `scripts/` subdirectories as needed, place files directly in the working directory
   - If **subfolder**: create `package-name/` first, then `extensions/` and `scripts/` inside it
   ```
   [package-root]/
     extensions/        # only if custom extensions exist
     scripts/           # only if multiple rill scripts
   ```

2. **Generate `package.json`** from `${CLAUDE_SKILL_DIR}/templates/package.json`:
   - Set `name` to the package name (lowercase, hyphens)
   - Add each rill-ext package from the extension plan to `dependencies`
   - Add any npm packages required by custom extensions to `dependencies`
   - Keep `@rcrsr/rill` as a dependency (the runtime)
   - Always include `@rcrsr/rill-cli` in `devDependencies` (provides `rill-run`, `rill-check`, `rill-build`)
   - Always include `@rcrsr/rill-agent` in `devDependencies` (provides bundling and HTTP serving)
   - Always include the `dev` script (`rill-run .`)
   - If custom TypeScript extensions exist: include `build`, `check`, and `compile` scripts, plus `typescript` and `@types/node` in `devDependencies`
   - If no custom TypeScript extensions exist: omit `build`, `check` scripts, set `compile` to `rill-build . --output build` (no `tsc` prefix), and omit `typescript` and `@types/node` from `devDependencies`
   - Include the `serve` script (`node server.js`) if the user wants HTTP deployment

3. **Generate `tsconfig.json`** from `${CLAUDE_SKILL_DIR}/templates/tsconfig.json` (only if custom extensions exist):
   - Keep defaults as-is unless the package requires different settings

4. **Generate `.env`** from `${CLAUDE_SKILL_DIR}/templates/env.template`:
   - Include only the variables referenced in the extension plan
   - Remove irrelevant provider sections

5. **Generate `.gitignore`** from `${CLAUDE_SKILL_DIR}/templates/gitignore`

6. **Run `npm install`** to install dependencies. If npm is not available, warn the user and continue.

7. **Generate `server.js`** from `${CLAUDE_SKILL_DIR}/templates/server.js` (only if the user wants HTTP deployment):
   - Keep defaults as-is unless the package requires different settings (e.g., port number)

### Step 7b: rill-config.json

Use the Agent tool with `subagent_type: "rill-engineer"` to generate the configuration file. Include in the prompt:
- The extension plan from Phase 4
- The package name and version (for the top-level `"name"` and `"version"` fields)
- The closure name(s) from the pipeline blueprint (for the `"main": "script.rill:closure_name"` field)
- All mount namespaces and their packages
- All config parameters per extension
- Any static data from the blueprint that belongs in config (URL lists, constants, system prompts)
- Instruction to use `${VAR_NAME}` for secrets (matching the `.env` file from Step 7a)
- Instruction to write the file to the package directory
- The template at `${CLAUDE_SKILL_DIR}/templates/rill-config.json` as the structural starting point
- Instruction: "ALL extensions must appear in extensions.mounts. Bundled extensions use `@rcrsr/rill/ext/<name>` as the mount path. Vendor extensions use their npm package name. Custom extensions use `./dist/extensions/<file>.js`."

### Step 7c: Custom TypeScript Extensions (if any)

Use the Agent tool with `subagent_type: "rill-engineer"` for each custom extension. Include in the prompt:
- The extension design from Phase 6
- The template at `${CLAUDE_SKILL_DIR}/templates/custom-extension.ts` as the structural starting point
- Instruction to create the TypeScript source file in the `extensions/` directory
- Instruction to implement all functions with proper type annotations and descriptions
- Instruction to handle errors with RILL-R004 format
- Instruction to export the extension value for host registration

After all custom extensions are written, run `npm run check` to verify TypeScript compilation. Fix any type errors before proceeding.

### Step 7d: Rill Scripts

Use the Agent tool with `subagent_type: "rill-engineer"` for each rill script. Include in the prompt:
- The pipeline blueprint from Phase 5 for this specific script (the agent implements the design, not invents one)
- The extension plan (which extensions are available under which namespaces)
- The rill-config.json content (so the agent knows available mounts)
- The rill language reference content fetched in Phase 1
- Instruction: "The rill language reference is included below. Do NOT fetch documentation — use what is provided."
- Instruction: "Implement the pipeline blueprint below. Follow the operator choices and data shapes exactly. Do not redesign the flow. Wrap the script in a named typed closure matching the blueprint. Use `log` only for operational messages, never for results."
- Instruction to write the `.rill` file to the package directory

For projects with multiple scripts, you MAY launch multiple `rill-engineer` agents in parallel for independent scripts. Scripts that depend on each other must be implemented sequentially.

### Step 7e: Validate Rill Scripts

After all rill scripts are written, run `npx rill-check <file>` on each `.rill` file. If errors are found, fix them by re-invoking the rill-engineer agent with the error message and script content. Repeat until all scripts pass validation. Do NOT proceed to Phase 8 with failing scripts.

### Step 7f: Entry Point

If the package has multiple scripts, use the Agent tool with `subagent_type: "rill-engineer"` to create the main entry script that orchestrates them. Include the full list of scripts and their purposes.

## Phase 8: Review and Deliver

After implementation:

1. List all created files with a one-line description of each
2. Show the complete `rill-config.json`
3. Produce a **Provisioning Checklist** that the user must complete before the package will run. For each external vendor the package depends on, list:
   - **Vendor and purpose** (e.g., "OpenAI — chat completions and embeddings")
   - **Account URL** where the user signs up or logs in
   - **Required credential(s)** and their env var names (matching the `.env` file), including any required scopes or permissions
   - **Resources to provision remotely** before first run (e.g., "Create a Qdrant collection named `docs` with vector size 1536 and Cosine distance", "Create an S3 bucket in region `us-east-1`", "Set up a Stripe webhook endpoint pointing to your server URL")
   - **Billing note** if usage incurs cost
   State clearly: "This skill did not create any vendor accounts, fetch any keys, or provision any remote resources. You are responsible for all of the above."
4. Note any assumptions made during implementation
5. Suggest next steps (testing, deployment, extensions)
6. Show the run command: `npm run dev`
7. If HTTP deployment is configured, show the compile and serve commands: `npm run compile && npm run serve`
8. **Direct the user to fill in `.env`** with the credentials from the Provisioning Checklist before running. State explicitly: "Open `.env` and populate every variable with real values. The package will fail at runtime if any required credential is missing or placeholder."
9. **Suggest running the package next** so the skill can verify functionality. Phrase it as: "Once `.env` is populated, prompt me to run the package (e.g., `run the package`). I will execute it, observe the output, and help diagnose any runtime issues before we call this complete."

Ask the user if they want changes to any part of the implementation.

### Step 8b: Save Transcript

After the package is complete and the user is satisfied, emit a snoop meta tag to save the transcript in the package directory. This must be the LAST thing you output.

Emit an XML tag with these attributes (replace ALL placeholders with actual values):
- Tag name: `snoop:meta`
- `file`: the package directory + `/transcript/create-rill-package` (e.g., `ai-news-summary/transcript/create-rill-package`)
- `description`: package name + colon + one-line summary
- `tags`: `rill,create-rill-package`

IMPORTANT: Do NOT copy the template verbatim. Replace every placeholder before emitting.
