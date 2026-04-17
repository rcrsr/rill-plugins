# Creating a Rill Package with the `rill` Plugin

This guide walks you from zero to a working rill package using the `/rill:create-rill-package` skill. Follow the phases in order.

## 1. Prerequisites

The skill halts if any of these are missing.

### 1.1 Linux or WSL2

The rill runtime targets Linux. On Windows, use WSL2.

- Install WSL2: run `wsl --install` in an elevated PowerShell, then reboot.
- Verify: `uname -a` should print a Linux kernel string (on WSL it contains `Microsoft` or `WSL`).
- macOS works unofficially but is unsupported.

### 1.2 Node.js 20 or newer

The rill runtime and CLI require Node 20+.

- Install with nvm (recommended):
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  exec $SHELL
  nvm install 20
  nvm use 20
  ```
- Verify: `node --version` prints `v20.x.x` or higher, and `npm --version` prints a version string.

### 1.3 Claude Code

You need the Claude Code CLI to install the plugin and run the skill.

- Install: see the official instructions at https://code.claude.com/docs/en/overview.
- Verify: `claude --version` prints a version string.

### 1.4 Global `@rcrsr/rill-cli`

The CLI provides five binaries: `rill-run`, `rill-check`, `rill-build`, `rill-exec`, and `rill-eval`. The skill uses `rill-run` to execute packages and `rill-check` to validate scripts during Phase 7e. The package requires Node `>=20.0.0` (enforced via `engines`).

```bash
npm install -g @rcrsr/rill-cli
```

Verify:

```bash
which rill-run rill-check rill-build
npm ls -g @rcrsr/rill-cli
```

All three binaries must resolve on PATH.

## 2. Install the Claude Code Plugin

From any directory, inside a Claude Code session:

```
/plugin marketplace add rcrsr/rill-plugins
/plugin install rill@rill-plugins
/reload-plugins
```

`/reload-plugins` activates the plugin in the current session without a restart.

Confirm the plugin is active by opening the plugin manager:

```
/plugin
```

Go to the **Installed** tab. You should see `rill` in the list. The skill registers as `/rill:create-rill-package` and the subagent as `rill-engineer`.

## 3. Run the Skill

Change to the directory where you want the new package's parent folder to live. The skill always creates the package in a new subfolder named after the package.

```bash
cd ~/projects
claude
```

Inside the session, invoke the skill with one of:

- **Inline description**:
  ```
  /rill:create-rill-package Summarize the top 5 AI news items each morning from a list of RSS feeds and post the summary to a file.
  ```
- **Specification file**:
  ```
  /rill:create-rill-package ./spec.md
  ```
- **No argument** (the skill will ask):
  ```
  /rill:create-rill-package
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

- **"rill-run: command not found"**: `@rcrsr/rill-cli` is not globally installed. Run `npm install -g @rcrsr/rill-cli`.
- **Scripts fail `rill-check`**: the skill retries automatically by re-invoking `rill-engineer` with the error. If it still fails, share the error with the skill and it will iterate.
- **"Missing credential" at runtime**: open `.env` and populate the flagged variable. Every variable must have a real value, not a placeholder.
- **Plugin not listed after install**: run `/reload-plugins`. If still missing, run `/plugin marketplace update rill-plugins` to refresh the catalog, then re-run `/plugin install rill@rill-plugins`.

## References

- Rill language: https://github.com/rcrsr/rill
- Rill extensions: https://github.com/rcrsr/rill-ext
- Rill agent (HTTP deployment): https://github.com/rcrsr/rill-agent
- Claude Code docs: https://docs.claude.com/en/docs/claude-code
