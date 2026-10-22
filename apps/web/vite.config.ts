import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const appVersion = (JSON.parse(readFileSync(path.join(appDir, "package.json"), "utf8")) as { version?: string }).version ?? "0.0.0";
const appCommit = (() => {
  if (process.env["GIT_COMMIT"]) return process.env["GIT_COMMIT"].slice(0, 12);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
})();

// Dev-server ports/targets are overridable so several checkouts can run side by side.
const apiTarget = process.env["TABLEOS_API_PROXY"] ?? "http://localhost:3000";
const realtimeTarget = process.env["TABLEOS_REALTIME_PROXY"] ?? "ws://localhost:3002";
const devPort = Number(process.env["TABLEOS_WEB_PORT"] ?? 5173);

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_COMMIT__: JSON.stringify(appCommit),
  },
  resolve: {
    alias: [
      {
        find: "@tableos/ui/tokens.css",
        replacement: path.resolve(appDir, "../../packages/ui/src/tokens.css"),
      },
      {
        find: "@tableos/ui",
        replacement: path.resolve(appDir, "../../packages/ui/src/index.ts"),
      },
    ],
  },
  server: {
    port: devPort,
    strictPort: true,
    proxy: {
      "/v1": {
        target: apiTarget,
        changeOrigin: true,
        timeout: 10 * 60 * 1000,
        proxyTimeout: 10 * 60 * 1000,
      },
      "/health": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/ws": {
        target: realtimeTarget,
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ws/, "/v1/ws"),
      },
    },
  },
});
