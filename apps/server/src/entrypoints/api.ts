import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { runMigrations } from "@tabula/db";
import { createApp } from "../composition/create-app.js";
import { startAutomationEngine } from "../modules/automations/consumer.js";
import { mfaKey } from "../modules/auth/mfa-pending.js";
import { startSyncScheduler } from "../modules/sync/scheduler.js";
import { attachRealtimeGateway } from "../modules/realtime/gateway.js";

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

// Live changes and presence: production only runs this process, so the API serves the realtime
// WebSocket (/v1/ws) on its own port. Set REALTIME_IN_API=false when a separate gateway runs.
if (process.env["REALTIME_IN_API"] !== "false") {
  const gateway = attachRealtimeGateway({ httpServer: app.server, db: ctx.db, redis: ctx.redis, env: ctx.env, log: ctx.log });
  process.once("SIGTERM", () => gateway.close());
  ctx.log.info("Realtime WebSocket served by the API at /v1/ws");
}

// Automations must fire even when no separate worker is deployed. The engine takes a Postgres
// advisory lock and claims runs with SKIP LOCKED, so it is safe next to a worker or other API
// instances. Set AUTOMATIONS_IN_API=false when a dedicated worker runs it instead.
if (process.env["AUTOMATIONS_IN_API"] !== "false") {
  const engine = startAutomationEngine({
    db: ctx.db,
    env: { ...ctx.env, API_URL: `http://127.0.0.1:${ctx.env.PORT}` },
    log: ctx.log,
  });
  const stop = () => engine.stop();
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}

// Synced tables refresh on their interval even without a worker. Each run claims the sync's
// lock first (`locked_until`), so an API and a worker never run the same sync twice. Source
// edits only trigger an immediate run in the worker (domain events); here the sweep catches up.
if (process.env["SYNC_IN_API"] !== "false") {
  const scheduler = startSyncScheduler({ db: ctx.db, redis: ctx.redis, storage: ctx.storage, secretKey: mfaKey(ctx.env), google: ctx.env }, ctx.log);
  const stop = () => scheduler.stop();
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
