# Rill Plugins

Claude Code plugins for the [rill](https://github.com/rcrsr/rill) scripting language and its extension ecosystem.

## Installation

```bash
# Add the marketplace
/plugin marketplace add rcrsr/rill-plugins

# Install the plugin
/plugin install rill@rill-plugins
```

## Available Plugins

### [rill](./rill)

**Author and debug rill packages.**

Ships two components:

- **`/rill:create-rill-package`** — Skill that walks a specification through an 8-phase workflow: doc fetch, requirements gathering, clarifying questions, extension identification, data-flow design, custom-extension design, implementation, and validation. Produces a complete rill package with `rill-config.json`, scripts, and optional TypeScript extensions.
- **`rill-engineer`** — Subagent that writes, reviews, and debugs rill scripts and `rill-ext` configurations. Always consults upstream docs before generating code to stay current with the language.

```bash
/plugin install rill@rill-plugins
```

## License

[MIT](./LICENSE) © Andre Bremer

## User Responsibility

The `create-rill-package` skill references external vendor credentials via `${VAR_NAME}` placeholders and produces a provisioning checklist. It does not create vendor accounts, fetch API keys, or provision remote resources (buckets, vector collections, webhook endpoints). The user owns all accounts, credentials, quotas, and billing.

