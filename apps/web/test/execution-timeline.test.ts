import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExecutionTimeline,
  formatDuration,
  spanPosition,
  type TimelineEvent,
} from "../src/client/lib/execution-timeline.js";

const START = Date.parse("2026-07-29T08:00:00.000Z");
const setups = new Map([["trial-1", "qwen3"]]);

function event(
  id: number,
  seconds: number,
  type: string,
  payload: Record<string, unknown>
): TimelineEvent {
  return {
    id,
    type,
    payload: { trialId: "trial-1", ...payload },
    at: new Date(START + seconds * 1_000).toISOString(),
  };
}

test("turns stage lifecycle events into clock-time spans", () => {
  const timeline = buildExecutionTimeline({
    setups,
    nowMs: START + 8_000,
    runStartedAt: new Date(START).toISOString(),
    runStatus: "running",
    events: [
      event(1, 1, "trial.stage.started", {
        stage: "retrieval",
        attempt: 1,
      }),
      event(2, 3, "trial.stage", {
        stage: "retrieval",
        attempt: 1,
        data: { latencyMs: 2_000 },
      }),
      event(3, 3, "trial.stage.started", {
        stage: "generation",
        attempt: 1,
      }),
    ],
  });

  const row = timeline.rows[0]!;
  assert.equal(row.status, "running");
  assert.deepEqual(
    row.spans.map((span) => ({
      stage: span.stage,
      status: span.status,
      start: span.startMs - START,
      end: span.endMs - START,
    })),
    [
      { stage: "retrieval", status: "complete", start: 1_000, end: 3_000 },
      { stage: "generation", status: "running", start: 3_000, end: 8_000 },
    ]
  );
});

test("shows the parent workflow phases above concurrent setup rows", () => {
  const timeline = buildExecutionTimeline({
    setups,
    nowMs: START + 10_000,
    runStartedAt: new Date(START).toISOString(),
    runStatus: "running",
    events: [
      {
        id: 1,
        type: "run.status",
        at: new Date(START).toISOString(),
        payload: { status: "ingesting" },
      },
      {
        id: 2,
        type: "run.status",
        at: new Date(START + 3_000).toISOString(),
        payload: { status: "running" },
      },
    ],
  });

  assert.deepEqual(
    timeline.summarySpans.map(({ label, status, startMs, endMs }) => ({
      label,
      status,
      start: startMs - START,
      end: endMs - START,
    })),
    [
      { label: "Prepare corpus", status: "complete", start: 0, end: 3_000 },
      { label: "Run setups", status: "running", start: 3_000, end: 10_000 },
    ]
  );
});

test("keeps failed attempts visible beside a successful retry", () => {
  const timeline = buildExecutionTimeline({
    setups,
    nowMs: START + 7_000,
    runStartedAt: new Date(START).toISOString(),
    runFinishedAt: new Date(START + 7_000).toISOString(),
    runStatus: "complete",
    events: [
      event(1, 1, "trial.stage.started", {
        stage: "generation",
        attempt: 1,
      }),
      event(2, 2, "trial.failed", { attempt: 1 }),
      event(3, 3, "trial.retry", { attempt: 2 }),
      event(4, 3, "trial.stage.started", {
        stage: "generation",
        attempt: 2,
      }),
      event(5, 5, "trial.stage", {
        stage: "generation",
        attempt: 2,
        data: { latencyMs: 2_000 },
      }),
      event(6, 5, "trial.stage.started", { stage: "judge", attempt: 2 }),
      event(7, 7, "trial.stage", {
        stage: "judge",
        attempt: 2,
        data: { latencyMs: 2_000 },
      }),
    ],
  });

  const row = timeline.rows[0]!;
  assert.equal(row.retries, 1);
  assert.equal(row.attempt, 2);
  assert.equal(row.status, "complete");
  assert.deepEqual(
    row.spans.map(({ stage, attempt, status }) => ({ stage, attempt, status })),
    [
      { stage: "generation", attempt: 1, status: "failed" },
      { stage: "generation", attempt: 2, status: "complete" },
      { stage: "judge", attempt: 2, status: "complete" },
    ]
  );
});

test("derives spans for older completion-only events from receipt latency", () => {
  const timeline = buildExecutionTimeline({
    setups,
    nowMs: START + 5_000,
    runStartedAt: new Date(START).toISOString(),
    runStatus: "running",
    events: [
      event(1, 4, "trial.stage", {
        stage: "retrieval",
        data: { latencyMs: 1_500 },
      }),
    ],
  });

  assert.equal(timeline.rows[0]!.spans[0]!.startMs, START + 2_500);
  assert.equal(timeline.rows[0]!.spans[0]!.endMs, START + 4_000);
});

test("positions spans on the shared run clock and formats durations", () => {
  assert.deepEqual(
    spanPosition(
      {
        key: "x",
        stage: "judge",
        label: "Judge",
        attempt: 1,
        startMs: START + 2_000,
        endMs: START + 4_000,
        latencyMs: 2_000,
        status: "complete",
      },
      { startMs: START, durationMs: 10_000 }
    ),
    { left: 20, width: 20 }
  );
  assert.equal(formatDuration(450), "450ms");
  assert.equal(formatDuration(5_250), "5.3s");
  assert.equal(formatDuration(65_000), "1m 5s");
});
