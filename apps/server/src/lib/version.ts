import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Release version (apps/server/package.json, kept in step by `scripts/version.mjs`) and the git commit. */
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
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
