/**
 * Admission control for run creation. A deployment is shared: several people
 * can be testing at once, and every active run holds Postgres connections,
 * provider quota, and up to MAX_RUN_BUDGET_USD of spend. These limits bound
 * that without queueing, so a rejected caller can simply retry.
 */

/**
 * A run stays in `draft` from the moment its row lands until the workflow task
 * actually starts, which can be a while when tasks are queued. Drafts count
 * toward the limits so a double-click cannot pass the check twice and so queued
 * work is not admitted twice over.
 *
 * A dispatch failure marks the run failed, so a draft older than this only
 * happens when the process died between committing the row and dispatching it.
 * Those are failed on the next admission check rather than blocking a session
 * forever.
 */
export const STRANDED_DRAFT_SECONDS = 600;

/**
 * Ceiling for a run that started but never reached a terminal state, which
 * happens when the workflow process disappears mid-run. Nothing else will move
 * it, so without this it would hold one of the deployment's slots forever.
 *
 * Kept well past the `run_bakeoff` task timeout (1h) plus its one retry, so a
 * slow-but-alive comparison is never mistaken for an abandoned one.
 */
export const ABANDONED_RUN_SECONDS = 10_800;

export type ActiveRunCounts = {
  /** Active runs across every session on this deployment. */
  total: number;
  /** Active runs belonging to the requesting session. */
  session: number;
};

export type RunAdmissionLimits = {
  /** Concurrent runs allowed per session. Values below 1 disable the limit. */
  maxActiveRunsPerSession: number;
  /** Concurrent runs allowed deployment-wide. Values below 1 disable the limit. */
  maxActiveRunsTotal: number;
};

export type RunAdmissionErrorCode = "session_run_limit" | "global_run_limit";

/** Run creation refused because too much is already in flight. */
export class RunAdmissionError extends Error {
  override readonly name = "RunAdmissionError";
  readonly statusCode = 429;

  constructor(
    readonly code: RunAdmissionErrorCode,
    message: string,
    readonly retryAfterSeconds: number
  ) {
    super(message);
  }
}

/** Returns the reason a run may not start, or null when it may. */
export function checkRunAdmission(
  counts: ActiveRunCounts,
  limits: RunAdmissionLimits
): RunAdmissionError | null {
  const perSession = limits.maxActiveRunsPerSession;
  if (perSession >= 1 && counts.session >= perSession) {
    return new RunAdmissionError(
      "session_run_limit",
      perSession === 1
        ? "You already have a run in progress. Wait for it to finish, or cancel it and start again."
        : `You already have ${perSession} runs in progress. Wait for one to finish, or cancel it and start again.`,
      10
    );
  }

  const total = limits.maxActiveRunsTotal;
  if (total >= 1 && counts.total >= total) {
    return new RunAdmissionError(
      "global_run_limit",
      `This deployment is running ${total} comparisons already. Try again in a moment.`,
      20
    );
  }

  return null;
}
