#!/usr/bin/env node
// Prepares a package directory to load a local TypeScript extension.
//
// Usage: scaffold-custom-ext.mjs <package-dir> <ext-file>
//
// 1. Scans <ext-file> for bare-specifier `import` statements.
// 2. Filters out specifiers that are already resolvable from .rill/npm/node_modules/
//    (these were installed by `rill install` of vendor extensions).
// 3. Runs `npm install <missing>` inside .rill/npm/ for any unresolved bare specifiers,
//    deduped. Skips @rcrsr/* names (they ship as part of vendor extension installs).
//    Always installs corresponding @types/<pkg> when published.
// 4. Symlinks <package-dir>/node_modules -> .rill/npm/node_modules (idempotent),
//    so Node's import resolver can find bare imports relative to the .ts file.
//
// Idempotent. Exits 0 on success; 1 on npm failure.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const packageDir = process.argv[2];
const extFile = process.argv[3];
if (!packageDir || !extFile) {
  console.error("usage: scaffold-custom-ext.mjs <package-dir> <ext-file>");
  process.exit(2);
}

const extPath = path.isAbsolute(extFile)
  ? extFile
  : path.resolve(packageDir, extFile);
if (!fs.existsSync(extPath)) {
  console.error(`extension file not found: ${extPath}`);
  process.exit(2);
}

const npmDir = path.join(packageDir, ".rill", "npm");
const npmModules = path.join(npmDir, "node_modules");
if (!fs.existsSync(npmDir)) {
  console.error(`.rill/npm not found under ${packageDir} — run 'rill bootstrap' first`);
  process.exit(2);
}

// 1. Parse bare-specifier imports.
const src = fs.readFileSync(extPath, "utf8");
const importRe = /(?:^|\n)\s*import\s+(?:[\s\S]*?\sfrom\s+)?["']([^"']+)["']/g;
const specifiers = new Set();
for (const m of src.matchAll(importRe)) {
  const spec = m[1];
  if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("node:")) {
    continue;
  }
  specifiers.add(spec);
}

// 2. Reduce a deep specifier (`pkg/sub/path`) to its package root.
function packageRoot(spec) {
  if (spec.startsWith("@")) {
    const parts = spec.split("/");
    return parts.slice(0, 2).join("/");
  }
  return spec.split("/")[0];
}

const wantedPackages = new Set();
for (const spec of specifiers) {
  wantedPackages.add(packageRoot(spec));
}

// 3. Skip ones already resolvable under .rill/npm/node_modules/ and skip @rcrsr/*
//    (vendor extensions and rill itself install them as a transitive dep).
const toInstall = [];
for (const pkg of wantedPackages) {
  if (pkg.startsWith("@rcrsr/")) continue;
  const pkgPath = path.join(npmModules, ...pkg.split("/"));
  if (fs.existsSync(pkgPath)) continue;
  toInstall.push(pkg);
}

if (toInstall.length > 0) {
  // Add @types/<pkg> when present on registry.
  const withTypes = [];
  for (const pkg of toInstall) {
    withTypes.push(pkg);
    if (pkg.startsWith("@")) continue; // skip @types lookup for scoped packages
    const probe = (() => {
      try {
        execSync(`npm view @types/${pkg} version`, {
          stdio: ["ignore", "pipe", "ignore"],
        });
        return true;
      } catch {
        return false;
      }
    })();
    if (probe) withTypes.push(`@types/${pkg}`);
  }
  console.log(`installing under .rill/npm: ${withTypes.join(", ")}`);
  try {
    execSync(`npm install ${withTypes.join(" ")}`, {
      cwd: npmDir,
      stdio: "inherit",
    });
  } catch (err) {
    console.error(`npm install failed: ${err.message}`);
    process.exit(1);
  }
} else if (specifiers.size > 0) {
  console.log("all imports already resolvable under .rill/npm/node_modules/");
}

// 4. Symlink node_modules at package root, idempotent.
const linkPath = path.join(packageDir, "node_modules");
const target = path.join(".rill", "npm", "node_modules");
let needLink = true;
try {
  const stat = fs.lstatSync(linkPath);
  if (stat.isSymbolicLink()) {
    const current = fs.readlinkSync(linkPath);
    if (current === target) needLink = false;
    else fs.unlinkSync(linkPath);
  } else {
    console.error(
      `cannot create symlink: ${linkPath} exists and is not a symlink`,
    );
    process.exit(1);
  }
} catch {
  // ENOENT — link does not exist
}
if (needLink) {
  fs.symlinkSync(target, linkPath, "dir");
  console.log(`symlinked node_modules -> ${target}`);
}

process.exit(0);
