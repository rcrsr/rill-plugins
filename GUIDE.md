# Creating a Rill Package with the `rill-make` Plugin

This guide walks you from zero to a working rill package using the `/rill-make:create-rill-package` skill. Follow the phases in order.

## What Is a Rill Package?

A rill package is an agent in a portable, runnable form. It bundles everything the agent needs in one directory: the rill scripts that define the pipeline, `rill-config.json` declaring extensions and configuration, any custom TypeScript extensions, and the `.env` referencing required credentials.

The same package runs in three contexts without code changes:

| Context | Command | What it uses |
|---------|---------|--------------|
| Local development | `npm run dev` (`rill run .`) | Reads the package directory directly |
| HTTP agent server | `npm run build && npm run serve` | `rill build` emits a self-contained bundle to `build/`, then `@rcrsr/rill-agent-http` serves it over HTTP (`POST /agents/:name/run`) |
| Azure AI Foundry | Deploy the `build/` output with `@rcrsr/rill-agent-foundry` | Same bundle, wrapped in the Foundry Responses API harness |

### Relationship to `rill-agent`

[`rill-agent`](https://github.com/rcrsr/rill-agent) is the runtime that hosts a built package as an HTTP service. It contributes no logic of its own. It loads the package manifest, calls the entry-point closure per HTTP request, and returns the structured result. The package encompasses all agent behavior. `rill-agent` provides the transport.

This separation matters because:

- **Portability**: the same package runs locally, on any HTTP host, or in Azure Foundry. No code branches per environment.
- **Testability**: `rill run` exercises the full agent without standing up a server.
- **Isolation**: credentials stay in `.env`, never in scripts. Static configuration stays in `rill-config.json`, never hard-coded.
- **Composition**: one agent can call another via `@rcrsr/rill-agent-ext-ahi`, which registers `ahi::<agentName>` functions in the rill runtime. Co-located agents skip HTTP; remote agents resolve through static URLs.

The skill in this plugin generates the package. `rill-agent` (separate repo) runs it in production. You move from one to the other by running `npm run build` and pointing a server at the output.

## 1. Prerequisites

The skill halts if any of these are missing.

### 1.1 Linux or WSL2

The rill runtime targets Linux. On Windows, use WSL2.

- Install WSL2: run `wsl --install` in an elevated PowerShell, then reboot.
- Verify: `uname -a` should print a Linux kernel string (on WSL it contains `Microsoft` or `WSL`).
- macOS works unofficially but is unsupported.

### 1.2 Node.js 22 LTS or newer

The rill runtime and CLI require Node `>= 22.16.0`. Use the latest Node 22 LTS (or newer current release) for forward compatibility.

- Install with nvm (recommended):
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  exec $SHELL
  nvm install --lts
  nvm use --lts
  ```
- Verify: `node --version` prints `v22.16.0` or higher, and `npm --version` prints a version string.

### 1.3 Claude Code

You need the Claude Code CLI to install the plugin and run the skill.

- Install: see the official instructions at https://code.claude.com/docs/en/overview.
- Verify: `claude --version` prints a version string.

### 1.4 Global `@rcrsr/rill-cli`

The CLI ships a unified `rill` binary with subcommands (`rill bootstrap`, `rill install`, `rill check`, `rill describe`, `rill build`, `rill run`, `rill eval`, `rill exec`). The skill drives this CLI through every phase. The package requires Node `>= 22.16.0` (enforced via `engines`).

```bash
npm install -g @rcrsr/rill-cli
```

Verify:

```bash
which rill
rill --version
npm ls -g @rcrsr/rill-cli
```

The `rill` binary must resolve on PATH and report version `>= 0.19.5`.

## 2. Install the Claude Code Plugin

From any directory, inside a Claude Code session.

If you previously installed the plugin from the old `rcrsr/rill-plugins` marketplace (where it was published as `rill@rill-plugins`), remove the old install first:

```
/plugin uninstall rill@rill-plugins
/plugin marketplace remove rill-plugins
```

Then add the current marketplace and install:

```
/plugin marketplace add rcrsr/claude-plugins
/plugin install rill-make@claude-plugins
/reload-plugins
```

`/reload-plugins` activates the plugin in the current session without a restart.

Confirm the plugin is active by opening the plugin manager:

```
/plugin
```

Go to the **Installed** tab. You should see `rill-make` in the list. The skill registers as `/rill-make:create-rill-package` and the subagents are `rill-architect`, `rill-engineer`, and `rill-reviewer`.

## 3. Run the Skill

Change to the directory where you want the new package's parent folder to live. The skill always creates the package in a new subfolder named after the package.

```bash
cd ~/projects
claude
```

Inside the session, invoke the skill with one of:

- **Inline description**:
  ```
  /rill-make:create-rill-package Summarize the top 5 AI news items each morning from a list of RSS feeds and post the summary to a file.
  ```
- **Specification file**:
  ```
  /rill-make:create-rill-package ./spec.md
  ```
- **No argument** (the skill will ask):
  ```
  /rill-make:create-rill-package
  ```

### What the Skill Does

The skill runs 8 phases. You answer clarifying questions and approve designs along the way.

| Phase | Purpose | Your input |
|-------|---------|-----------|
| 0 | Verify prerequisites | None (automatic) |
| 1 | Fetch rill docs | None |
| 2 | Gather requirements | Describe the package (or provide a spec) |
| 3 | Clarifying questions | Answer prompts about data format, LLM provider, storage, scale |
| 4 | Identify extensions | Review the extension plan |
| 5 | Design data flow | Approve the pipeline blueprint |
| 6 | Design custom extensions | Approve third-party npm packages and extension designs |
| 7 | Implement | Wait while the `rill-engineer` agent writes code |
| 8 | Review and deliver | Fill in `.env`, then run the package |

## 4. Fill in `.env`

When the skill completes, it emits a **Provisioning Checklist** listing every vendor account, credential, and remote resource you must set up before first run (API keys, buckets, vector collections, webhook endpoints, billing notes).

The skill does NOT create accounts, fetch keys, or provision remote resources. You own that step.

1. Open the generated `.env` file in your package directory.
2. Replace every placeholder with a real value.
3. Provision any remote resources listed in the checklist (e.g., create a Qdrant collection with the correct vector size, create the S3 bucket in the correct region).

## 5. Run the Package

Once `.env` is populated, tell the skill to run the package:

```
run the package
```

The skill invokes `npm run dev`, observes the output, and helps diagnose runtime issues. This is the verification step that closes out the workflow.

For HTTP deployment (optional):

```
npm run build && npm run serve
```

## Troubleshooting

- **"rill: command not found"**: `@rcrsr/rill-cli` is not globally installed. Run `npm install -g @rcrsr/rill-cli`.
- **Scripts fail `rill check`**: the skill retries automatically by re-invoking `rill-engineer` with the error. If it still fails, share the error with the skill and it will iterate.
- **"Missing credential" at runtime**: open `.env` and populate the flagged variable. Every variable must have a real value, not a placeholder.
- **Plugin not listed after install**: run `/reload-plugins`. If still missing, run `/plugin marketplace update claude-plugins` to refresh the catalog, then re-run `/plugin install rill-make@claude-plugins`.

## References

- Rill language: https://github.com/rcrsr/rill
- Rill extensions: https://github.com/rcrsr/rill-ext
- Rill agent (HTTP deployment): https://github.com/rcrsr/rill-agent
- Claude Code docs: https://docs.claude.com/en/docs/claude-code
