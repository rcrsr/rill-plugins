#!/usr/bin/env node
// Scaffolds the HTTP-serve surface for a rill package:
//   - copies templates/server.js to <package-dir>/server.js
//   - writes <package-dir>/package.json with @rcrsr/rill-agent + serve script
//   - runs `npm install` from the package root
//
// Idempotent. Refuses to overwrite an existing package.json that already has
// non-rill content; prints a diff hint instead.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.dirname(SCRIPT_DIR);
const SERVER_TEMPLATE = path.join(SKILL_DIR, "templates", "server.js");

const RILL_AGENT_VERSION = "^0.19";

const packageDir = process.argv[2];
if (!packageDir) {
  console.error("usage: scaffold-server.mjs <package-dir>");
  process.exit(2);
}
if (!fs.existsSync(packageDir)) {
  console.error(`package directory not found: ${packageDir}`);
  process.exit(2);
}
if (!fs.existsSync(SERVER_TEMPLATE)) {
  console.error(`template missing: ${SERVER_TEMPLATE}`);
  process.exit(2);
}

const serverPath = path.join(packageDir, "server.js");
const pkgPath = path.join(packageDir, "package.json");

// server.js
const templateBody = fs.readFileSync(SERVER_TEMPLATE, "utf8");
if (fs.existsSync(serverPath)) {
  const existing = fs.readFileSync(serverPath, "utf8");
  if (existing !== templateBody) {
    console.log(`${serverPath}: kept (differs from template; not overwriting)`);
  } else {
    console.log(`${serverPath}: already up to date`);
  }
} else {
  fs.writeFileSync(serverPath, templateBody);
  console.log(`${serverPath}: written`);
}

// package.json
const desiredPkg = {
  type: "module",
  private: true,
  dependencies: { "@rcrsr/rill-agent": RILL_AGENT_VERSION },
  scripts: { serve: "node server.js" },
};

let writePkg = true;
if (fs.existsSync(pkgPath)) {
  let existingPkg;
  try {
    existingPkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  } catch {
    console.error(`${pkgPath}: exists but is not valid JSON; refusing to overwrite`);
    process.exit(1);
  }
  // Merge: keep any user-added fields, ensure required fields present.
  const merged = {
    ...existingPkg,
    type: "module",
    dependencies: {
      ...(existingPkg.dependencies ?? {}),
      "@rcrsr/rill-agent": RILL_AGENT_VERSION,
    },
    scripts: { ...(existingPkg.scripts ?? {}), serve: "node server.js" },
  };
  if (JSON.stringify(merged) === JSON.stringify(existingPkg)) {
    writePkg = false;
    console.log(`${pkgPath}: already up to date`);
  } else {
    fs.writeFileSync(pkgPath, JSON.stringify(merged, null, 2) + "\n");
    console.log(`${pkgPath}: merged`);
  }
} else {
  fs.writeFileSync(pkgPath, JSON.stringify(desiredPkg, null, 2) + "\n");
  console.log(`${pkgPath}: written`);
}

// npm install
console.log(`running npm install in ${packageDir}...`);
try {
  execSync("npm install", { cwd: packageDir, stdio: "inherit" });
} catch (err) {
  console.error("npm install failed");
  process.exit(1);
}
console.log("scaffold-server: done");
