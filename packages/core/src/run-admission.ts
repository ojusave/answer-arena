/**
 * Admission control for run creation. A deployment is shared: several people
 * can be testing at once, and every active run holds Postgres connections,
 * provider quota, and up to MAX_RUN_BUDGET_USD of spend. These limits bound
 * that without queueing, so a rejected caller can simply retry.
 */

/**
 * A run sits in `draft` for the moment between its row landing and the
 * workflow accepting it. Counting drafts is what stops a double-click from
 * passing the check twice, and the grace window keeps a run stranded by a
 * crashed dispatch from blocking the session forever.
 */
export const DRAFT_ADMISSION_GRACE_SECONDS = 120;

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
