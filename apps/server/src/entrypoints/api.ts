import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { runMigrations } from "@tabula/db";
import { createApp } from "../composition/create-app.js";

const rootEnv = resolve(process.cwd(), "../../.env");
const localEnv = resolve(process.cwd(), ".env");
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
} else if (existsSync(localEnv)) {
  process.loadEnvFile(localEnv);
}

// The code expects every migration in packages/db/migrations; apply any the database is missing
// before serving. Set MIGRATE_ON_START=false to manage migrations separately.
const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl && process.env["MIGRATE_ON_START"] !== "false") {
  try {
    const applied = await runMigrations(databaseUrl, (msg) => console.log(`[migrate] ${msg}`));
    console.log(applied.length ? `[migrate] ${applied.length} migration(s) applied` : "[migrate] database is up to date");
  } catch (err) {
    console.error("[migrate] failed; not starting the API", err);
    process.exit(1);
  }
}

const { app, ctx } = await createApp();

try {
  await app.listen({ port: ctx.env.PORT, host: "0.0.0.0" });
  ctx.log.info({ port: ctx.env.PORT }, "TableOS API listening");
} catch (err) {
  ctx.log.error({ err }, "Failed to start API");
  process.exit(1);
}
