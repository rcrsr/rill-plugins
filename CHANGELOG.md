# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/rcrsr/rill-plugins/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/rcrsr/rill-plugins/releases/tag/v0.1.0
