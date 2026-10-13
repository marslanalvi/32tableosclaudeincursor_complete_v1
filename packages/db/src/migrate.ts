import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

/** Arbitrary constant shared by every process that migrates this database. */
const MIGRATION_LOCK_KEY = 7_302_511_847;

export async function runMigrations(connectionString: string, log: (msg: string) => void = console.log): Promise<string[]> {
  const client = new Client({ connectionString });
  await client.connect();
  const appliedNow: string[] = [];

  try {
    // Several instances may start together on deploy; only one migrates at a time.
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      const applied = await client.query<{ version: string }>(
        "SELECT version FROM public.schema_migrations WHERE version = $1",
        [version],
      );
      if (applied.rowCount && applied.rowCount > 0) {
        continue;
      }

      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO public.schema_migrations (version) VALUES ($1)",
          [version],
        );
        await client.query("COMMIT");
        appliedNow.push(file);
        log(`Applied migration ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
    }
    return appliedNow;
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch(() => undefined);
    await client.end();
  }
}
