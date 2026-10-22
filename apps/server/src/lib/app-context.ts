import type { Env } from "@tableos/config";
import type { TableOSDb } from "@tableos/db";
import type { EventBus } from "@tableos/events";
import type { SearchBackend } from "@tableos/search";
import type { TableOSStorage } from "@tableos/storage";
import type { Redis } from "ioredis";
import type { Logger } from "pino";

export interface AppContext {
  env: Env;
  db: TableOSDb;
  log: Logger;
  defaultShardId: string;
  redis: Redis | null;
  eventBus: EventBus;
  storage: TableOSStorage | null;
  search: SearchBackend;
}
