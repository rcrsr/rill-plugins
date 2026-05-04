# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.10.0] - 2026-05-03

### Changed

- Bump rill plugin to 0.10.0; targets `@rcrsr/rill-cli >= 0.19.5`.
- `create-rill-package` Phase 4.5 reorders to install → write stub configs → probe surfaces. Install no longer invokes the extension factory in rill-cli 0.19.5, so the previous chicken-and-egg dance (pre-populate config, source `.env`, install incrementally) is removed.
- `create-rill-package` Phase 7b updates: engineer rewrites `${env.VAR}` (probe-stub form) to `${VAR}` (runtime form) when finalizing config.
- `create-rill-package` Phase 7c adds an automated scaffold step: `scripts/scaffold-custom-ext.mjs` scans the custom `.ts` extension's bare imports, npm-installs missing deps under `.rill/npm/`, and creates the `node_modules → .rill/npm/node_modules` symlink that local-`.ts` extensions need at runtime.
- `create-rill-package` Phase 7h and Phase 8 drop the `--` separator from `rill run` examples. `rill-cli 0.19.5` parses `rill run --key value` correctly; the literal `--` was consumed as a positional `rootDir`.
- `create-rill-package` Phase 7f reviewer instruction now uses `rill check` (no-arg project scan) and `rill check <file> --types` (combined lint + tsc) — both behaviors shipped in `rill-cli 0.19.5`.
- `rill-architect` agent: `Bundled` and `Vendor` Extension Plan entries now require literal placeholders (`"${env.VAR_NAME}"`) instead of prose ("env var X"). New "Config-key placeholder convention" section documents the dual-form rule (`${env.VAR}` for probe stubs, `${VAR}` for runtime).
- `templates/tsconfig.json`: adds `ignoreDeprecations: "6.0"`, `baseUrl` + `paths` override for `@types/*` resolution under `.rill/npm/`, and `skipLibCheck: true`. Required for TS 7 and for `@types/*` packages installed alongside rill-ext deps.
- `scripts/probe-surfaces.mjs`: parses `parsed.mounts.<mount>` per the documented `rill describe project --stubs` output schema. Renders parameter defaults and a `return shape: dict[...]` line for nested dict returns. The previous parser wrote "no callables reported" for every mount.
- `scripts/preflight.mjs`: minimum `@rcrsr/rill-cli` floor bumped to `0.19.5`.

### Added

- `scripts/scaffold-custom-ext.mjs`: scans a custom `.ts` extension for bare-specifier imports, installs missing deps (and `@types/*` when published) under `.rill/npm/`, and creates the package-root `node_modules` symlink. Idempotent.

## [0.1.0] - 2026-04-16

### Added

- Initial marketplace scaffold with `.claude-plugin/marketplace.json` cataloging embedded plugins.
- Embedded `rill` plugin (v0.1.0) with manifest at `rill/.claude-plugin/plugin.json`.
- `rill-engineer` subagent for authoring, reviewing, and debugging rill scripts and `rill-ext` configurations.
- `create-rill-package` user-invocable skill implementing an 8-phase workflow from specification to validated rill package.
- Skill templates for `package.json`, `tsconfig.json`, `rill-config.json`, custom extension scaffold, `server.js`, env template, and gitignore.
- Skill examples: `simple-summarizer` (single script, one built-in extension) and `doc-search-pipeline` (multi-script with custom crawler extension).
- Explicit user-responsibility statement for external vendor accounts, credentials, and resource provisioning.
- Phase 3 clarifying question covering vendor account, key, and resource readiness.
- Phase 8 Provisioning Checklist listing per-vendor account URL, credentials, remote resources, and billing notes.
- `CLAUDE.md` documenting marketplace layout, plugin-addition workflow, and rill-specific conventions.

[Unreleased]: https://github.com/rcrsr/rill-plugins/compare/v0.10.0...HEAD
[0.10.0]: https://github.com/rcrsr/rill-plugins/releases/tag/v0.10.0
[0.1.0]: https://github.com/rcrsr/rill-plugins/releases/tag/v0.1.0
