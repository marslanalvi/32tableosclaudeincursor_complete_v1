import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { loadEnv } from "@tableos/config";
import { createDb } from "@tableos/db";
import { createLogger } from "@tableos/observability";
import { connectRedis } from "../lib/redis.js";
import { attachRealtimeGateway } from "../modules/realtime/gateway.js";

const rootEnv = resolve(process.cwd(), "../../.env");
const localEnv = resolve(process.cwd(), ".env");
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
} else if (existsSync(localEnv)) {
  process.loadEnvFile(localEnv);
}

/** Standalone realtime gateway (the API also runs one on its own port unless REALTIME_IN_API=false). */
async function main(): Promise<void> {
  const env = loadEnv();
  const log = createLogger({ name: "tableos-realtime", role: "realtime" });
  const db = createDb(env.DATABASE_URL);
  const redis = await connectRedis(env, log);
  const httpServer = createServer((_req, res) => {
    res.writeHead(404);
    res.end();
  });
  attachRealtimeGateway({ httpServer, db, redis, env, log });
  const port = env.REALTIME_PORT;
  httpServer.listen(port, "0.0.0.0", () => {
    log.info({ port }, "TableOS realtime WebSocket listening");
  });
}

void main();
