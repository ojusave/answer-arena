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

/**
 * Releases slots held by runs nothing will finish: a row committed whose
 * workflow task was never dispatched, and a run whose workflow disappeared
 * mid-flight. Without this, a crash permanently consumes deployment capacity.
 */
export async function reapAbandonedRuns(
  db: Executor,
  limits: { strandedDraftSeconds: number; abandonedRunSeconds: number }
): Promise<void> {
  await db.execute(sql`
    UPDATE runs
    SET status = 'failed',
        error = CASE
          WHEN status = 'draft'
            THEN 'Run never started: the workflow task was not dispatched.'
          ELSE 'Run was abandoned: the workflow stopped reporting progress.'
        END,
        finished_at = now()
    WHERE (
        status = 'draft'
        AND created_at < now() - (${limits.strandedDraftSeconds} * INTERVAL '1 second')
      )
      OR (
        status IN ('ingesting', 'running', 'aggregating')
        AND COALESCE(started_at, created_at)
            < now() - (${limits.abandonedRunSeconds} * INTERVAL '1 second')
      )
  `);
}

/** The run a session should reattach to after a reload, if it still has one. */
export async function getActiveRunForSession(
  db: Executor,
  sessionId: string
): Promise<{ runId: string; status: string } | null> {
  const rows = await db.execute<{ id: string; status: string }>(sql`
    SELECT id, status
    FROM runs
    WHERE session_id = ${sessionId}
      AND status IN ('draft', 'ingesting', 'running', 'aggregating')
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const row = rows[0];
  return row ? { runId: row.id, status: row.status } : null;
}

/**
 * Runs holding provider quota and budget, deployment-wide and for one session.
 * Drafts count: the task may be queued rather than finished.
 */
export async function countActiveRuns(
  db: Executor,
  sessionId: string
): Promise<ActiveRunCounts> {
  const rows = await db.execute<{ total: string; session: string }>(sql`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE session_id = ${sessionId}) AS session
    FROM runs
    WHERE status IN ('draft', 'ingesting', 'running', 'aggregating')
  `);
  return {
    total: Number(rows[0]?.total ?? 0),
    session: Number(rows[0]?.session ?? 0),
  };
}
