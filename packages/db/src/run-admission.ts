import { sql } from "drizzle-orm";
import type { ActiveRunCounts } from "@ragtime/core";
import type { Db } from "./client.js";

/** Accepts a connection or an open transaction. */
type Executor = Pick<Db, "execute">;

const ADMISSION_LOCK_KEY = "ragtime:run-admission";

/**
 * Serializes admission decisions across every web instance for the rest of the
 * transaction. Without it, simultaneous requests each read a stale count and
 * both pass the limit check.
 */
export async function lockRunAdmission(db: Executor): Promise<void> {
  await db.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${ADMISSION_LOCK_KEY}::text)::bigint)`
  );
}

/** Runs currently holding provider quota and budget, deployment-wide and for one session. */
export async function countActiveRuns(
  db: Executor,
  sessionId: string,
  draftGraceSeconds: number
): Promise<ActiveRunCounts> {
  const rows = await db.execute<{ total: string; session: string }>(sql`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE session_id = ${sessionId}) AS session
    FROM runs
    WHERE status IN ('ingesting', 'running', 'aggregating')
       OR (
         status = 'draft'
         AND created_at > now() - (${draftGraceSeconds} * INTERVAL '1 second')
       )
  `);
  return {
    total: Number(rows[0]?.total ?? 0),
    session: Number(rows[0]?.session ?? 0),
  };
}
