import { stageLabel } from "./copy.js";

/** Trial id to the shortest setup label that is unique in this run. */
export type SetupLabels = ReadonlyMap<string, string>;

export type TimelineEvent = {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  at: string;
};

export type TimelineSpan = {
  key: string;
  stage: string;
  label: string;
  attempt: number;
  startMs: number;
  endMs: number;
  status: "complete" | "running" | "failed";
  latencyMs: number;
};

export type TimelineRow = {
  trialId: string;
  label: string;
  attempt: number;
  retries: number;
  status: "pending" | "running" | "complete" | "failed";
  /** Last public failure message from trial.failed events, if any. */
  failureReason?: string;
  spans: TimelineSpan[];
};

export type ExecutionTimeline = {
  startMs: number;
  endMs: number;
  durationMs: number;
  summarySpans: TimelineSpan[];
  rows: TimelineRow[];
};

type OpenSpan = {
  key: string;
  stage: string;
  attempt: number;
  startMs: number;
};

function eventMs(event: TimelineEvent): number {
  const value = new Date(event.at).getTime();
  return Number.isFinite(value) ? value : 0;
}

function eventAttempt(event: TimelineEvent, fallback: number): number {
  const value = Number(event.payload.attempt ?? fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function receiptLatency(event: TimelineEvent): number {
  const data = event.payload.data as { latencyMs?: unknown } | undefined;
  const value = Number(data?.latencyMs ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function uniqueRowLabels(setups: SetupLabels): Map<string, string> {
  const counts = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const [trialId, label] of setups) {
    const next = (counts.get(label) ?? 0) + 1;
    counts.set(label, next);
    labels.set(trialId, next === 1 ? label : `${label} · question ${next}`);
  }
  return labels;
}

const ACTIVE_PHASE_LABEL: Record<string, string> = {
  draft: "Starting",
  ingesting: "Prepare corpus",
  running: "Run setups",
  aggregating: "Aggregate",
};

function buildSummarySpans(
  events: TimelineEvent[],
  startMs: number,
  endMs: number,
  runStatus: string
): TimelineSpan[] {
  const statusEvents = events.filter((event) => event.type === "run.status");
  let phase = statusEvents.length > 0 ? "ingesting" : runStatus;
  let cursor = startMs;
  const spans: TimelineSpan[] = [];

  const closePhase = (at: number) => {
    const label = ACTIVE_PHASE_LABEL[phase];
    if (!label || at <= cursor) return;
    spans.push({
      key: `run:${phase}:${cursor}`,
      stage: `phase-${phase}`,
      label,
      attempt: 1,
      startMs: cursor,
      endMs: at,
      latencyMs: at - cursor,
      status: "complete",
    });
  };

  for (const event of statusEvents) {
    const next = String(event.payload.status ?? "");
    const at = Math.max(cursor, eventMs(event));
    if (next === phase) {
      cursor = at;
      continue;
    }
    closePhase(at);
    cursor = at;
    phase = next;
  }

  const active = ACTIVE_PHASE_LABEL[phase];
  if (active && endMs > cursor) {
    spans.push({
      key: `run:${phase}:${cursor}:current`,
      stage: `phase-${phase}`,
      label: active,
      attempt: 1,
      startMs: cursor,
      endMs,
      latencyMs: endMs - cursor,
      status: ["complete", "failed", "canceled", "budget_exceeded"].includes(
        runStatus
      )
        ? "complete"
        : "running",
    });
  }
  return spans;
}

/** Builds clock-time spans from durable run events, including a live active span. */
export function buildExecutionTimeline(args: {
  events: TimelineEvent[];
  setups: SetupLabels;
  nowMs: number;
  runStartedAt?: string | null;
  runFinishedAt?: string | null;
  runStatus: string;
}): ExecutionTimeline {
  const events = [...args.events].sort((a, b) => a.id - b.id);
  const labels = uniqueRowLabels(args.setups);
  const byTrial = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const trialId = String(event.payload.trialId ?? "");
    if (!trialId) continue;
    const list = byTrial.get(trialId) ?? [];
    list.push(event);
    byTrial.set(trialId, list);
  }

  const firstEventMs = events.map(eventMs).find((value) => value > 0);
  const configuredStart = args.runStartedAt
    ? new Date(args.runStartedAt).getTime()
    : Number.NaN;
  const startMs = Number.isFinite(configuredStart)
    ? configuredStart
    : firstEventMs ?? args.nowMs;
  const configuredEnd = args.runFinishedAt
    ? new Date(args.runFinishedAt).getTime()
    : Number.NaN;
  const endMs = Math.max(
    startMs + 1,
    Number.isFinite(configuredEnd) ? configuredEnd : args.nowMs
  );

  const rows: TimelineRow[] = [];
  for (const [trialId, label] of labels) {
    const trialEvents = byTrial.get(trialId) ?? [];
    const spans: TimelineSpan[] = [];
    const open = new Map<string, OpenSpan>();
    let attempt = 1;
    let retries = 0;
    let failed = false;
    let failureReason: string | undefined;

    for (const event of trialEvents) {
      const at = eventMs(event);
      if (event.type === "trial.retry") {
        attempt = eventAttempt(event, attempt + 1);
        retries = Math.max(retries, attempt - 1);
        continue;
      }

      const stage = String(event.payload.stage ?? "");
      if (event.type === "trial.stage.started" && stage) {
        const stageAttempt = eventAttempt(event, attempt);
        attempt = Math.max(attempt, stageAttempt);
        const key = `${stage}:${stageAttempt}`;
        open.set(key, { key, stage, attempt: stageAttempt, startMs: at });
        continue;
      }

      if (event.type === "trial.stage" && stage) {
        const stageAttempt = eventAttempt(event, attempt);
        attempt = Math.max(attempt, stageAttempt);
        const key = `${stage}:${stageAttempt}`;
        const pending = open.get(key);
        const latencyMs = receiptLatency(event);
        const spanStart = pending?.startMs ?? Math.max(startMs, at - latencyMs);
        spans.push({
          key: `${trialId}:${key}`,
          stage,
          label: stageLabel(stage),
          attempt: stageAttempt,
          startMs: spanStart,
          endMs: Math.max(spanStart, at),
          latencyMs: latencyMs || Math.max(0, at - spanStart),
          status: "complete",
        });
        open.delete(key);
        continue;
      }

      if (event.type === "trial.failed") {
        const failedAttempt = eventAttempt(event, attempt);
        const pending = [...open.values()]
          .filter((span) => span.attempt === failedAttempt)
          .sort((a, b) => b.startMs - a.startMs)[0];
        if (pending) {
          spans.push({
            key: `${trialId}:${pending.key}:failed`,
            stage: pending.stage,
            label: stageLabel(pending.stage),
            attempt: failedAttempt,
            startMs: pending.startMs,
            endMs: Math.max(pending.startMs, at),
            latencyMs: Math.max(0, at - pending.startMs),
            status: "failed",
          });
          open.delete(pending.key);
        }
        const message = event.payload.message;
        if (typeof message === "string" && message.trim() !== "") {
          failureReason = message.trim();
        }
        failed = true;
      }
    }

    const runIsActive = !["complete", "failed", "canceled", "budget_exceeded"].includes(
      args.runStatus
    );
    if (runIsActive) {
      for (const pending of open.values()) {
        spans.push({
          key: `${trialId}:${pending.key}:running`,
          stage: pending.stage,
          label: stageLabel(pending.stage),
          attempt: pending.attempt,
          startMs: pending.startMs,
          endMs,
          latencyMs: Math.max(0, endMs - pending.startMs),
          status: "running",
        });
      }
    }

    spans.sort((a, b) => a.startMs - b.startMs || a.attempt - b.attempt);
    const hasRunning = spans.some((span) => span.status === "running");
    const completedJudge = spans.some(
      (span) => span.stage === "judge" && span.status === "complete"
    );
    rows.push({
      trialId,
      label,
      attempt,
      retries,
      failureReason,
      status: hasRunning
        ? "running"
        : completedJudge
          ? "complete"
          : failed
            ? "failed"
            : spans.length > 0
              ? "running"
              : "pending",
      spans,
    });
  }

  return {
    startMs,
    endMs,
    durationMs: Math.max(1, endMs - startMs),
    summarySpans: buildSummarySpans(
      events,
      startMs,
      endMs,
      args.runStatus
    ),
    rows,
  };
}

export function spanPosition(
  span: TimelineSpan,
  timeline: Pick<ExecutionTimeline, "startMs" | "durationMs">
): { left: number; width: number } {
  const left = ((span.startMs - timeline.startMs) / timeline.durationMs) * 100;
  const width = ((span.endMs - span.startMs) / timeline.durationMs) * 100;
  return {
    left: Math.max(0, Math.min(100, left)),
    width: Math.max(0.8, Math.min(100 - left, width)),
  };
}

export function formatDuration(ms: number): string {
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1_000)}s`;
}
