# Rill Package Structure

```
package-name/
  package.json                 # Dependencies, build/dev/compile/serve targets
  rill-config.json             # Extension mounts and configuration
  main.rill                    # Entry point script
  server.js                    # HTTP agent server (optional, for deployment)
  scripts/                     # Additional rill scripts (if multiple)
    step-one.rill
    step-two.rill
  extensions/                  # Custom TypeScript extensions (if any)
    ext-name.ts
  .env                         # Environment variables (secrets, API keys)
```

## File purposes

| File | Purpose |
|------|---------|
| `package.json` | Declares dependencies and npm script targets: `dev`, `build`, `compile`, `serve`. |
| `rill-config.json` | Declares extension mounts (namespace -> package), per-namespace config, and package metadata (`name`, `version`). |
| `main.rill` | Entry point. Single-script packages put all logic here. Multi-script packages use this as orchestrator. |
| `scripts/*.rill` | Separate scripts for distinct pipeline stages. Loaded via `use<module:name>`. |
| `extensions/*.ts` | Custom TypeScript extensions for capabilities not covered by built-in rill-ext packages. |
| `server.js` | HTTP server using `@rcrsr/rill-agent`. Loads the build and serves the agent over HTTP. Optional. |
| `.env` | API keys and secrets. Referenced in rill-config.json as `${VAR_NAME}`. Never committed. |

## npm script targets

| Target | Command | Purpose |
|--------|---------|---------|
| `dev` | `rill-run .` | Run the package in development mode. Replaces `run.sh`. |
| `build` | `tsc` | Compile custom TypeScript extensions to `dist/`. Only if extensions exist. |
| `check` | `tsc --noEmit` | Type-check extensions without emitting. Only if extensions exist. |
| `compile` | `tsc && rill-build . --output build` | Build extensions and build the package for deployment. |
| `serve` | `node server.js` | Start the HTTP agent server from the build. Requires `server.js`. |

## Conventions

- One concern per `.rill` file. Split when a script exceeds 50 lines.
- Name scripts by what they produce: `embed-docs.rill`, `search-index.rill`, `generate-report.rill`.
- Name custom extensions by what they connect to: `ext-github.ts`, `ext-stripe.ts`.
- The entry point `main.rill` should read as a high-level data flow, delegating details to modules.
