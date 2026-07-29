import assert from "node:assert/strict";
import test from "node:test";
import {
  eventTone,
  formatActivityLine,
} from "../src/client/lib/format-event.js";
import { comboShortLabels } from "../src/client/lib/combo-display.js";
import type { ComboResult } from "@ragtime/core";

function combo(overrides: Partial<ComboResult> & { comboId: string }): ComboResult {
  return {
    embeddingModel: "nvidia/llama-nemotron-embed-v1-1b",
    rerankModel: null,
    genModel: "qwen/qwen3-235b-a22b",
    avgScore: null,
    avgCostPerQuestion: null,
    p50GenerationLatencyMs: null,
    p95GenerationLatencyMs: null,
    totalCostUsd: null,
    completeCount: 0,
    failedCount: 0,
    selfJudged: false,
    ...overrides,
  };
}

test("labels every trial stage emitted by the pipeline", () => {
  const stages = ["retrieval", "rerank", "generation", "judge"];
  const lines = stages.map((stage) =>
    formatActivityLine({ type: "trial.stage", payload: { stage } })
  );

  assert.deepEqual(lines, [
    "Retrieval finished",
    "Rerank finished",
    "Generation finished",
    "Judge finished",
  ]);
});

test("names the setup behind a per-setup event", () => {
  const setups = new Map([["t1", "north-mini-code"]]);

  assert.equal(
    formatActivityLine(
      { type: "trial.stage", payload: { stage: "generation", trialId: "t1" } },
      setups
    ),
    "Generation finished · north-mini-code"
  );
  assert.equal(
    formatActivityLine(
      { type: "trial.retry", payload: { attempt: 2, trialId: "t1" } },
      setups
    ),
    "Retrying (attempt 2) · north-mini-code"
  );
  // An unknown trial still produces a readable line rather than a dangling separator.
  assert.equal(
    formatActivityLine(
      { type: "trial.stage", payload: { stage: "judge", trialId: "t9" } },
      setups
    ),
    "Judge finished"
  );
});

test("explains a partially scored run instead of falling back to a generic update", () => {
  assert.equal(
    formatActivityLine({
      type: "run.partial",
      payload: { scored: 4, failed: 2, stuck: 1 },
    }),
    "Finished with gaps: 4 scored, 2 failed, 1 unfinished"
  );
});

test("reuses run status labels so the feed matches the run summary", () => {
  assert.equal(
    formatActivityLine({ type: "run.status", payload: { status: "running" } }),
    "Status: Running"
  );
  assert.equal(
    formatActivityLine({ type: "run.status", payload: { status: "ingesting" } }),
    "Status: Indexing documents"
  );
});

test("tones a run status by its payload, not just the event type", () => {
  assert.equal(eventTone({ type: "run.status", payload: { status: "complete" } }), "done");
  assert.equal(eventTone({ type: "run.status", payload: { status: "failed" } }), "failed");
  assert.equal(eventTone({ type: "run.status", payload: { status: "running" } }), "active");
  assert.equal(eventTone({ type: "trial.retry", payload: {} }), "warn");
  assert.equal(eventTone({ type: "trial.stage", payload: {} }), "done");
});

test("shortens setup names only while they stay unique", () => {
  const unique = comboShortLabels([
    combo({ comboId: "a", genModel: "qwen/qwen3-235b-a22b" }),
    combo({ comboId: "b", genModel: "north/north-mini-code" }),
  ]);
  assert.deepEqual([...unique.values()], ["qwen3-235b-a22b", "north-mini-code"]);

  const shared = comboShortLabels([
    combo({ comboId: "a", embeddingModel: "openai/text-embedding-3-small" }),
    combo({ comboId: "b", rerankModel: "cohere/rerank-v3" }),
  ]);
  assert.deepEqual(
    [...shared.values()],
    [
      "text-embedding-3-small / no rerank / qwen3-235b-a22b",
      "llama-nemotron-embed-v1-1b / rerank / qwen3-235b-a22b",
    ]
  );
});
