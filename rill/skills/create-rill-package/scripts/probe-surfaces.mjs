#!/usr/bin/env node
// Captures the call surface of every installed mount via
//   `rill describe project --stubs --mount <mount>`
// and aggregates the per-mount JSON into a markdown digest at
//   <package-dir>/.rill-design/extension-surfaces.md
//
// Mounts come from <package-dir>/rill-config.json (extensions.mounts), so
// this script must run after `rill install` has populated that section.
//
// On any probe failure the script writes a partial digest, prints the
// failed mount + stderr, and exits 1.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const packageDir = process.argv[2];
if (!packageDir) {
  console.error("usage: probe-surfaces.mjs <package-dir>");
  process.exit(2);
}

const configPath = path.join(packageDir, "rill-config.json");
const designDir = path.join(packageDir, ".rill-design");
const digestPath = path.join(designDir, "extension-surfaces.md");

if (!fs.existsSync(configPath)) {
  console.error(`rill-config.json not found at ${configPath}`);
  process.exit(2);
}
fs.mkdirSync(designDir, { recursive: true });

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (err) {
  console.error(`failed to parse rill-config.json: ${err.message}`);
  process.exit(1);
}

const mounts = Object.keys(config?.extensions?.mounts ?? {});
if (mounts.length === 0) {
  console.error("no mounts found in rill-config.json extensions.mounts");
  process.exit(1);
}

const surfaces = [];
const failures = [];

for (const mount of mounts) {
  const outPath = path.join(designDir, `${mount}.surface.json`);
  try {
    const stdout = execSync(
      `rill describe project --stubs --mount ${mount}`,
      { cwd: packageDir, stdio: ["ignore", "pipe", "pipe"] },
    ).toString();
    fs.writeFileSync(outPath, stdout);
    let parsed;
    try {
      parsed = JSON.parse(stdout);
    } catch (err) {
      failures.push({ mount, reason: `non-JSON output: ${err.message}` });
      continue;
    }
    surfaces.push({ mount, parsed });
    console.log(`${mount}: probed`);
  } catch (err) {
    const stderr = err.stderr?.toString().trim() || err.message;
    failures.push({ mount, reason: stderr });
    console.error(`${mount}: probe failed`);
    console.error(`  ${stderr.split("\n").join("\n  ")}`);
  }
}

// Aggregate.
const captured = new Date().toISOString().replace(/\.\d+Z$/, "Z");
const rillVersion =
  surfaces.find((s) => s.parsed?.rillVersion)?.parsed?.rillVersion ?? "unknown";

const lines = [
  "# Extension Surface Inventory",
  `Captured: ${captured}`,
  `rill version: ${rillVersion}`,
  "",
];

for (const { mount, parsed } of surfaces) {
  const pkg = parsed?.package ?? "unknown";
  const ver = parsed?.version ?? "unknown";
  lines.push(`## ${mount} (${pkg}@${ver})`);
  lines.push("");
  const callables = Array.isArray(parsed?.callables) ? parsed.callables : [];
  if (callables.length === 0) {
    lines.push("_(no callables reported)_");
    lines.push("");
    continue;
  }
  for (const c of callables) {
    if (c?.isProperty) continue;
    const params = Array.isArray(c?.params)
      ? c.params
          .map((p) => `${p?.name ?? "?"}: ${p?.typeDisplay ?? "unknown"}`)
          .join(", ")
      : "";
    const ret = c?.returnTypeDisplay ?? "unknown";
    lines.push(`### ${c?.name ?? "?"}(${params}) -> ${ret}`);
    const desc = c?.annotations?.description?.trim();
    if (desc) lines.push(desc);
    lines.push("");
  }
}

if (failures.length > 0) {
  lines.push("## Probe Failures");
  lines.push("");
  for (const f of failures) {
    lines.push(`- ${f.mount}: ${f.reason.split("\n")[0]}`);
  }
  lines.push("");
}

fs.writeFileSync(digestPath, lines.join("\n"));
console.log(
  `${digestPath}: aggregated ${surfaces.length} mount(s)` +
    (failures.length ? `, ${failures.length} failure(s)` : ""),
);

process.exit(failures.length > 0 ? 1 : 0);
