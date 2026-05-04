# Rill Package Structure

```
package-name/
  rill-config.json             # Mounts and config (created by `rill bootstrap`, mutated by `rill install`)
  main.rill                    # Entry point script
  .env                         # Secrets, referenced as ${VAR_NAME} in rill-config.json
  .gitignore                   # `rill bootstrap` appends `.rill/`; the skill adds `.env`, `build/`, `transcript/`
  .rill/                       # Created by `rill bootstrap` (gitignored)
    npm/                       # Scoped install root for extensions (replaces project node_modules)
    tsconfig.rill.json         # Path mappings into .rill/npm/node_modules; extended by user tsconfig.json
  scripts/                     # Additional rill scripts (multi-script packages)
    step-one.rill
  prompts/                     # LLM prompts (required when LLMs are used)
    summarize.prompt.md
    agents/research.prompt.md
  extensions/                  # Custom TypeScript extensions (optional)
    ext-name.ts
  tsconfig.json                # `extends: "./.rill/tsconfig.rill.json"` (only if custom extensions exist)
  server.js                    # HTTP agent server (optional, for deployment)
  package.json                 # Optional: only when HTTP serve or other npm-driven workflow is needed
```

## File ownership

| File | Created by | Notes |
|------|------------|-------|
| `rill-config.json` | `rill bootstrap` (starter), then `rill install <pkg>` populates `extensions.mounts` and `extensions.config`. The skill adds `name`, `version`, `main`, and `${VAR_NAME}` placeholders for credentials. |
| `.rill/npm/` | `rill bootstrap` writes a scoped `package.json` here. `rill install` populates `node_modules/`. Never commit. |
| `.rill/tsconfig.rill.json` | `rill bootstrap` writes path mappings into `.rill/npm/node_modules/`. User `tsconfig.json` extends it. |
| `.gitignore` | `rill bootstrap` appends `.rill/`. The skill appends `.env`, `build/`, `transcript/`, `dist/`. |
| `main.rill` / `scripts/*.rill` | The engineer agent writes these from the architect's pipeline blueprint. |
| `prompts/**/*.prompt.md` | The engineer agent writes these from the prompt inventory. Required whenever any LLM extension is mounted. |
| `extensions/*.ts` | The engineer agent writes the file, then the skill runs `rill install ./extensions/<file>.ts --as <mount>` to register it. |
| `tsconfig.json` | The skill writes only when custom extensions exist. Body: `{ "extends": "./.rill/tsconfig.rill.json", "include": ["extensions/**/*.ts"] }`. |
| `server.js` | Optional. Skill copies the template only if HTTP deployment was requested. |
| `package.json` | Optional. Skill writes a minimal one only if `server.js` exists (needs `@rcrsr/rill-agent` in root `node_modules/`) or the user asked for npm scripts as conveniences. |
| `.env` | The skill copies `env.template` and trims it to the variables referenced in the blueprint Extension Plan. |

## Run, build, type-check

| Action | Command | Notes |
|--------|---------|-------|
| Run | `rill run` | Reads `rill-config.json`, executes the `main` handler. |
| Run with handler params | `rill run -- --param_name value` | Flag names match closure parameter names verbatim. |
| Build | `rill build --output build` | Default nests under `build/<package-name>/`. Pass `--flat` to write directly into `--output`. |
| Lint | `rill check <file>` | Default fails only on `error` severity. Pass `--min-severity info` for strict mode. |
| Type-check | `rill check --types` | Resolves `tsc` from `node_modules/.bin/` then `.rill/npm/node_modules/.bin/`. |
| Serve | `node server.js` | Requires root `package.json` with `@rcrsr/rill-agent` and a build under `build/`. |

## Conventions

- One concern per `.rill` file. Split when a script exceeds 50 lines.
- Name scripts by what they produce: `embed-docs.rill`, `search-index.rill`, `generate-report.rill`.
- Name custom extensions by what they connect to: `ext-github.ts`, `ext-stripe.ts`.
- The entry point `main.rill` should read as a high-level data flow, delegating details to modules.
