#!/usr/bin/env node
// Generates <package-dir>/.env containing only the variables actually
// referenced as ${VAR_NAME} in <package-dir>/rill-config.json.
//
// Strategy:
//   1. Scan rill-config.json for ${VAR_NAME} placeholders.
//   2. Read templates/env.template; the template carries commented
//      `# VAR=value` lines as defaults/hints.
//   3. For each referenced VAR, emit either the template's default line
//      (uncommented) or a bare `VAR=` if the template has no entry.
//   4. Preserve any user-populated values when .env already exists.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.dirname(SCRIPT_DIR);
const ENV_TEMPLATE = path.join(SKILL_DIR, "templates", "env.template");

const packageDir = process.argv[2];
if (!packageDir) {
  console.error("usage: scaffold-env.mjs <package-dir>");
  process.exit(2);
}

const configPath = path.join(packageDir, "rill-config.json");
const envPath = path.join(packageDir, ".env");

if (!fs.existsSync(configPath)) {
  console.error(`rill-config.json not found at ${configPath}`);
  console.error("Run after Phase 7b so ${VAR_NAME} placeholders exist.");
  process.exit(2);
}
if (!fs.existsSync(ENV_TEMPLATE)) {
  console.error(`template missing: ${ENV_TEMPLATE}`);
  process.exit(2);
}

const configRaw = fs.readFileSync(configPath, "utf8");
const referenced = new Set();
const re = /\$\{([A-Z_][A-Z0-9_]*)\}/g;
let m;
while ((m = re.exec(configRaw)) !== null) {
  referenced.add(m[1]);
}

if (referenced.size === 0) {
  console.log(
    "rill-config.json contains no ${VAR_NAME} references; .env not generated.",
  );
  process.exit(0);
}

// Parse template: collect default lines per VAR.
const templateRaw = fs.readFileSync(ENV_TEMPLATE, "utf8");
const templateDefaults = new Map(); // VAR -> "VAR=defaultvalue" (uncommented)
for (const rawLine of templateRaw.split("\n")) {
  const line = rawLine.replace(/^#\s*/, "").trim();
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match) templateDefaults.set(match[1], `${match[1]}=${match[2]}`);
}

// Parse existing .env: preserve populated values.
const existing = new Map(); // VAR -> raw line
if (fs.existsSync(envPath)) {
  for (const rawLine of fs.readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (match) existing.set(match[1], rawLine);
  }
}

// Emit.
const sorted = [...referenced].sort();
const lines = [
  "# Rill project environment variables",
  "# Populate every variable with a real value before running.",
  "",
];
const missingFromTemplate = [];
for (const v of sorted) {
  if (existing.has(v)) {
    lines.push(existing.get(v));
  } else if (templateDefaults.has(v)) {
    lines.push(templateDefaults.get(v));
  } else {
    lines.push(`${v}=`);
    missingFromTemplate.push(v);
  }
}
lines.push("");

fs.writeFileSync(envPath, lines.join("\n"));

console.log(`${envPath}: wrote ${sorted.length} variable(s)`);
console.log(`  referenced: ${sorted.join(", ")}`);
if (missingFromTemplate.length > 0) {
  console.log(
    `  not in template (added as bare): ${missingFromTemplate.join(", ")}`,
  );
}
