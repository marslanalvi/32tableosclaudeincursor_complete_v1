import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Release version (apps/server/package.json, kept in step by `scripts/version.mjs`) and the git commit.
 * The file sits two levels up from src/lib/ but one level up from the bundled dist/api.js.
 */
function readVersion(): string {
  for (const rel of ["../../package.json", "../package.json"]) {
    try {
      const pkg = JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8")) as { name?: string; version?: string };
      if (pkg.name === "@tabula/server" && pkg.version) return pkg.version;
    } catch {
      // Not at this location; try the next.
    }
  }
  return "0.0.0";
}

function readCommit(): string | null {
  if (process.env["GIT_COMMIT"]) return process.env["GIT_COMMIT"].slice(0, 12);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null;
  } catch {
    return null;
  }
}

export const APP_VERSION = readVersion();
export const APP_COMMIT = readCommit();
export const STARTED_AT = new Date().toISOString();
