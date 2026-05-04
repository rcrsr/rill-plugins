#!/usr/bin/env node
// Verifies environment prerequisites for the create-rill-package skill.
// Exits 0 on pass, 1 on any failure. --allow-non-linux downgrades the
// platform check from FAIL to WARN.

import { execSync } from "node:child_process";
import os from "node:os";

const NODE_FLOOR = [22, 16, 0];
const RILL_FLOOR = [0, 19, 4];
const allowNonLinux = process.argv.includes("--allow-non-linux");

function tryExec(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function parseSemver(s) {
  if (!s) return null;
  const m = s.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function gte(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

const results = [];
function record(label, value, status, note = "") {
  results.push({ label, value, status, note });
}

// Platform
const platform = os.platform();
const release = os.release().toLowerCase();
let platformLabel = "other";
let platformStatus = "FAIL";
if (platform === "linux") {
  platformLabel = release.includes("microsoft") ? "WSL2" : "Linux";
  platformStatus = "PASS";
} else if (allowNonLinux) {
  platformStatus = "WARN";
}
record("Platform", platformLabel, platformStatus, `kernel=${os.release()}`);

// Node
const nodeVersion = parseSemver(process.version);
const nodeStatus = nodeVersion && gte(nodeVersion, NODE_FLOOR) ? "PASS" : "FAIL";
record("Node.js", process.version, nodeStatus, `>= ${NODE_FLOOR.join(".")}`);

// npm
const npmVersion = tryExec("npm --version");
record("npm", npmVersion ?? "missing", npmVersion ? "PASS" : "FAIL");

// rill-cli
const rillRaw = tryExec("rill --version");
const rillVersion = parseSemver(rillRaw);
const rillStatus =
  rillVersion && gte(rillVersion, RILL_FLOOR) ? "PASS" : "FAIL";
record(
  "@rcrsr/rill-cli",
  rillRaw ?? "missing",
  rillStatus,
  `>= ${RILL_FLOOR.join(".")}`,
);

const labelWidth = Math.max(...results.map((r) => r.label.length));
const valueWidth = Math.max(...results.map((r) => String(r.value).length));

console.log("PREREQUISITE CHECKS");
console.log("-------------------");
for (const r of results) {
  const label = (r.label + ":").padEnd(labelWidth + 2);
  const value = String(r.value).padEnd(valueWidth);
  const note = r.note ? `  (${r.note})` : "";
  console.log(`${label} ${value}  -> ${r.status}${note}`);
}

const failed = results.some((r) => r.status === "FAIL");
if (failed) {
  console.error("");
  console.error("Preflight failed. Resolve the FAIL items before continuing.");
  if (rillStatus === "FAIL") {
    console.error("  Install/upgrade rill: npm install -g @rcrsr/rill-cli@latest");
  }
  if (nodeStatus === "FAIL") {
    console.error(
      `  Install Node.js >= ${NODE_FLOOR.join(".")} (https://nodejs.org/)`,
    );
  }
  process.exit(1);
}

const warned = results.some((r) => r.status === "WARN");
if (warned) {
  console.warn("");
  console.warn(
    "Preflight passed with warnings. rill is not officially supported on this platform.",
  );
}

process.exit(0);
