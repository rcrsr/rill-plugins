# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The plugin version tracks the targeted `@rcrsr/rill-cli` minor (0.19.x).

## [0.19.0] - 2026-05-04

### Added

- Initial release of the `rill-make` plugin at the repo root, distributed via the [`rcrsr/claude-plugins`](https://github.com/rcrsr/claude-plugins) marketplace. Install with `/plugin install rill-make@claude-plugins`.
- `create-rill-package` user-invocable skill (`/rill-make:create-rill-package`) implementing an 8-phase workflow: fetch docs, gather requirements, clarify, identify extensions, design data flow, design custom extensions, implement, review.
- `rill-engineer`, `rill-architect`, and `rill-reviewer` subagents (invoked as `rill-make:rill-*`) covering code generation, design decisions, and validation.
- Skill templates for `package.json`, `tsconfig.json.tmpl`, `rill-config.json`, `custom-extension.ts.tmpl`, `server.js`, env template, and gitignore. The `.tmpl` suffix prevents editor type-checking against unresolved imports; the skill drops the suffix when materializing files.
- Skill examples: `simple-summarizer` (single script, one built-in extension) and `doc-search-pipeline` (multi-script with custom crawler extension).
- `scripts/preflight.mjs` enforcing Node `>= 22.16.0` and `@rcrsr/rill-cli >= 0.19.5`.
- `scripts/probe-surfaces.mjs` parsing `parsed.mounts.<mount>` from `rill describe project --stubs`, rendering parameter defaults and `return shape: dict[...]` for nested dict returns.
- `scripts/scaffold-custom-ext.mjs`: scans custom `.ts` extension imports, installs missing deps and `@types/*` under `.rill/npm/`, and creates the package-root `node_modules` symlink. Idempotent.
- `rill-architect` "Config-key placeholder convention": `Bundled` and `Vendor` Extension Plan entries use literal placeholders (`${env.VAR}` for probe stubs, `${VAR}` for runtime).
- Phase 3 clarifying question for vendor account, key, and resource readiness; Phase 8 Provisioning Checklist with per-vendor account URL, credentials, remote resources, and billing notes.
- Explicit user-responsibility statement for external vendor accounts, credentials, and resource provisioning.
- `CLAUDE.md`, `ARCHITECTURE.md`, `GUIDE.md`, `README.md` documenting plugin layout, agent split, blueprint schema, and end-user walkthrough.

### Migration

- Users on the previous `rill@rill-plugins` install must remove it before installing `rill-make`. Run `/plugin uninstall rill@rill-plugins` and `/plugin marketplace remove rill-plugins`, then add `rcrsr/claude-plugins` and install `rill-make@claude-plugins`.

### Notes

- Targets `@rcrsr/rill-cli >= 0.19.5`. Phase 4.5 install order is install → write stub configs → probe surfaces (the 0.19.5 install no longer invokes the extension factory).
- Phase 7b rewrites `${env.VAR}` (probe-stub form) to `${VAR}` (runtime form) when finalizing config.
- Phase 7f reviewer uses `rill check` (project scan) and `rill check <file> --types` (lint + tsc).
- Phase 7h and Phase 8 omit the `--` separator from `rill run` examples; `rill-cli 0.19.5` parses `rill run --key value` correctly.
- `templates/tsconfig.json.tmpl` sets `ignoreDeprecations: "6.0"`, `baseUrl` + `paths` override for `@types/*` resolution under `.rill/npm/`, and `skipLibCheck: true` for TS 7 compatibility.
- `GUIDE.md` recommends Node 22 LTS and the unified `rill` binary; the standalone `rill-run`/`rill-check`/`rill-build` binaries are obsolete.

[0.19.0]: https://github.com/rcrsr/rill-make/releases/tag/v0.19.0
