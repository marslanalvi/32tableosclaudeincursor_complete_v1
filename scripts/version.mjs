#!/usr/bin/env node
// Sets the TableOS release version in the root and every app package.json.
// Usage: node scripts/version.mjs 0.8.0   (or: major | minor | patch)
// Then add the release to CHANGELOG.md, commit, and tag: git tag -a v0.8.0 -m "TableOS 0.8.0"
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "package.json",
  ...readdirSync(path.join(root, "apps")).map((d) => `apps/${d}/package.json`).filter((f) => existsSync(path.join(root, f))),
];

const current = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version ?? "0.0.0";
const arg = process.argv[2];
if (!arg) {
  console.log(current);
  process.exit(0);
}

function bump(v, part) {
  const [maj, min, pat] = v.split(".").map(Number);
  if (part === "major") return `${maj + 1}.0.0`;
  if (part === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}
const next = ["major", "minor", "patch"].includes(arg) ? bump(current, arg) : arg;
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(next)) {
  console.error(`Not a semantic version: ${next}`);
  process.exit(1);
}

for (const f of files) {
  const p = path.join(root, f);
  const raw = readFileSync(p, "utf8");
  const json = JSON.parse(raw);
  const out = {};
  // Keep "version" right after "name" so diffs stay small.
  for (const [k, v] of Object.entries(json)) {
    if (k === "version") continue;
    out[k] = v;
    if (k === "name") out.version = next;
  }
  if (!("version" in out)) out.version = next;
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  writeFileSync(p, JSON.stringify(out, null, 2).replace(/\n/g, eol) + eol);
  console.log(`${f}: ${json.version ?? "(none)"} -> ${next}`);
}
