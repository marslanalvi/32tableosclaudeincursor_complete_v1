import { Redis } from "ioredis";
import type { Env } from "@tabula/config";
import type { Logger } from "pino";

const CONNECT_TIMEOUT_MS = 3000;

/** Redis, or null (in-memory fallbacks) when it can't be reached within a few seconds. */
export async function connectRedis(env: Env, log: Logger): Promise<Redis | null> {
  const client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true, connectTimeout: CONNECT_TIMEOUT_MS });
  // Errors before we decide are reported once below, not as "unhandled error event" spam.
  const swallow = () => undefined;
  client.on("error", swallow);
  try {
    await Promise.race([
      client.connect().then(() => client.ping()),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Redis connect timed out")), CONNECT_TIMEOUT_MS)),
    ]);
    client.off("error", swallow);
    client.on("error", (err) => log.warn({ err }, "Redis error"));
    log.info("Redis connected");
    return client;
  } catch (err) {
    client.disconnect();
    log.warn({ err }, "Redis unavailable; using in-memory event bus");
    return null;
  }
}
