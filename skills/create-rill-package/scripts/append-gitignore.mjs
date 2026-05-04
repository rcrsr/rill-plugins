#!/usr/bin/env node
// Appends canonical entries to <package-dir>/.gitignore.
// Idempotent: skips entries already present.

import fs from "node:fs";
import path from "node:path";

const ENTRIES = [".env", "build/", "transcript/", "dist/"];

const packageDir = process.argv[2];
if (!packageDir) {
  console.error("usage: append-gitignore.mjs <package-dir>");
  process.exit(2);
}

const gitignorePath = path.join(packageDir, ".gitignore");

let current = "";
if (fs.existsSync(gitignorePath)) {
  current = fs.readFileSync(gitignorePath, "utf8");
}

const present = new Set(
  current
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean),
);

const toAdd = ENTRIES.filter((e) => !present.has(e));

if (toAdd.length === 0) {
  console.log(`${gitignorePath}: already up to date`);
  process.exit(0);
}

const needsTrailingNewline = current.length > 0 && !current.endsWith("\n");
const block = (needsTrailingNewline ? "\n" : "") + toAdd.join("\n") + "\n";

fs.appendFileSync(gitignorePath, block);
console.log(`${gitignorePath}: added ${toAdd.join(", ")}`);
