import { CompiledQuery } from "kysely";
import type { TableOSDb } from "@tableos/db";

export async function executeRawQuery<T>(
  db: TableOSDb,
  sqlText: string,
  parameters: unknown[],
): Promise<T[]> {
  const result = await db.executeQuery<T>(
    CompiledQuery.raw(sqlText, parameters),
  );
  return result.rows;
}
