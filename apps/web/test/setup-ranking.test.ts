import assert from "node:assert/strict";
import test from "node:test";
import type { ComboResult } from "@ragtime/core";
import type { GridCell } from "../src/client/hooks/types.js";
import {
  describeSetupProgress,
  rankSetups,
  setupStageProgress,
} from "../src/client/lib/setup-ranking.js";

function combo(
  partial: Partial<ComboResult> & Pick<ComboResult, "comboId" | "genModel">
): ComboResult {
  return {
    embeddingModel: "openai/text-embedding-3-small",
    rerankModel: null,
    avgScore: null,
    avgCostPerQuestion: null,
    p50GenerationLatencyMs: null,
    p95GenerationLatencyMs: null,
    totalCostUsd: null,
    completeCount: 0,
    failedCount: 0,
    selfJudged: false,
    ...partial,
  };
}

function cell(
  partial: Partial<GridCell> & Pick<GridCell, "trialId" | "comboId">
): GridCell {
  return {
    questionId: "q1",
    status: "pending",
    overallScore: null,
    attempts: 1,
    answer: null,
    ...partial,
  };
}

test("ranks by judge score, then lower cost, then lower latency", () => {
  const ranking = rankSetups({
    runStatus: "complete",
    combos: [
      combo({
        comboId: "a",
        genModel: "openai/gpt-a",
        avgScore: 8,
        avgCostPerQuestion: 0.02,
        p50GenerationLatencyMs: 900,
      }),
      combo({
        comboId: "b",
        genModel: "openai/gpt-b",
        avgScore: 9.2,
        avgCostPerQuestion: 0.03,
        p50GenerationLatencyMs: 1200,
      }),
      combo({
        comboId: "c",
        genModel: "openai/gpt-c",
        avgScore: 9.2,
        avgCostPerQuestion: 0.01,
        p50GenerationLatencyMs: 800,
      }),
    ],
    grid: [
      cell({ trialId: "t1", comboId: "a", status: "complete", overallScore: "8" }),
      cell({ trialId: "t2", comboId: "b", status: "complete", overallScore: "9.2" }),
      cell({ trialId: "t3", comboId: "c", status: "complete", overallScore: "9.2" }),
    ],
  });

  assert.equal(ranking.isFinal, true);
  assert.equal(ranking.hasScores, true);
  assert.equal(ranking.top?.comboId, "c");
  assert.deepEqual(
    ranking.ranked.map((row) => row.comboId),
    ["c", "b", "a"]
  );
  assert.equal(ranking.primaryReason, "Highest judge score: 92/100");
});

test("breaks equal score and equal cost with lower latency", () => {
  const ranking = rankSetups({
    runStatus: "complete",
    combos: [
      combo({
        comboId: "slow",
        genModel: "openai/slow",
        avgScore: 8,
        avgCostPerQuestion: 0.01,
        p50GenerationLatencyMs: 2000,
      }),
      combo({
        comboId: "fast",
        genModel: "openai/fast",
        avgScore: 8,
        avgCostPerQuestion: 0.01,
        p50GenerationLatencyMs: 500,
      }),
    ],
    grid: [
      cell({ trialId: "t1", comboId: "slow", status: "complete", overallScore: "8" }),
      cell({ trialId: "t2", comboId: "fast", status: "complete", overallScore: "8" }),
    ],
  });

  assert.equal(ranking.top?.comboId, "fast");
  assert.equal(ranking.isFinal, true);
});

test("never marks a partial run as final even when scores exist", () => {
  const ranking = rankSetups({
    runStatus: "running",
    combos: [
      combo({
        comboId: "a",
        genModel: "openai/a",
        avgScore: 9,
        avgCostPerQuestion: 0.02,
        p50GenerationLatencyMs: 700,
      }),
      combo({
        comboId: "b",
        genModel: "openai/b",
        avgScore: null,
        avgCostPerQuestion: null,
        p50GenerationLatencyMs: null,
      }),
    ],
    grid: [
      cell({
        trialId: "t1",
        comboId: "a",
        status: "complete",
        overallScore: "9",
        answer: "done",
      }),
      cell({ trialId: "t2", comboId: "b", status: "running", answer: null }),
    ],
  });

  assert.equal(ranking.hasScores, true);
  assert.equal(ranking.isFinal, false);
  assert.equal(ranking.top?.comboId, "a");
});

test("reports no winner when nothing is scored yet", () => {
  const ranking = rankSetups({
    runStatus: "running",
    combos: [
      combo({ comboId: "a", genModel: "openai/a" }),
      combo({ comboId: "b", genModel: "openai/b" }),
    ],
    grid: [
      cell({ trialId: "t1", comboId: "a", status: "running" }),
      cell({ trialId: "t2", comboId: "b", status: "pending" }),
    ],
  });

  assert.equal(ranking.hasScores, false);
  assert.equal(ranking.top, null);
  assert.equal(ranking.primaryReason, null);
  assert.equal(ranking.isFinal, false);
});

test("describes setup stage progress in plain language", () => {
  const writing = setupStageProgress({
    status: "running",
    hasRerank: false,
    answer: null,
    score: null,
  });
  assert.equal(writing.answer, "active");
  assert.equal(writing.rerank, "skipped");
  assert.equal(
    describeSetupProgress({ setupLabel: "Setup 1", progress: writing }),
    "Setup 1 is writing an answer"
  );

  const scoring = setupStageProgress({
    status: "running",
    hasRerank: true,
    answer: "hello",
    score: null,
  });
  assert.equal(scoring.judge, "active");
  assert.equal(
    describeSetupProgress({ setupLabel: "Setup 2", progress: scoring }),
    "Setup 2 is being scored"
  );
});
