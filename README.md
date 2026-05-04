# rill-make

Claude Code plugin for authoring [rill](https://github.com/rcrsr/rill) packages.

This repository is the plugin source. It is distributed through the [`rcrsr/claude-plugins`](https://github.com/rcrsr/claude-plugins) marketplace.

## Installation

If you previously installed the plugin from the old `rcrsr/rill-plugins` marketplace, remove it first so the new `rill-make` plugin resolves cleanly:

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

## What it ships

- **`/rill-make:create-rill-package`** — Skill that walks a specification through an 8-phase workflow: doc fetch, requirements gathering, clarifying questions, extension identification, data-flow design, custom-extension design, implementation, and validation. Produces a complete rill package with `rill-config.json`, scripts, and optional TypeScript extensions.
- **`rill-architect`**, **`rill-engineer`**, **`rill-reviewer`** — Subagents that own design, implementation, and validation respectively. Invoked by the skill against a frozen blueprint at `<package>/.rill-design/blueprint.md`.

See [`GUIDE.md`](./GUIDE.md) for end-to-end usage and [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the agent split and blueprint schema.

## License

[MIT](./LICENSE) © Andre Bremer

## User Responsibility

The `create-rill-package` skill references external vendor credentials via `${VAR_NAME}` placeholders and produces a provisioning checklist. It does not create vendor accounts, fetch API keys, or provision remote resources (buckets, vector collections, webhook endpoints). The user owns all accounts, credentials, quotas, and billing.
