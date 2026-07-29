import type { ComboResult } from "@ragtime/core";
import { scoreOnTen, scorePercent } from "./score-display.js";
import type { GridCell } from "../hooks/types.js";

export type RankedSetup = {
  comboId: string;
  setupIndex: number;
  setupLabel: string;
  answerModel: string;
  score: number | null;
  scorePercent: number | null;
  costUsd: number | null;
  latencyMs: number | null;
  status: string;
  trialId: string | null;
  answer: string | null;
  rank: number;
};

export type SetupRanking = {
  ranked: RankedSetup[];
  top: RankedSetup | null;
  /** Final winner only when every setup has finished. */
  isFinal: boolean;
  /** At least one setup has a judge score. */
  hasScores: boolean;
  primaryReason: string | null;
  costDeltaUsd: number | null;
  latencyDeltaMs: number | null;
};

function shortModel(id: string): string {
  return id.split("/").pop() ?? id;
}

function cellStatus(cells: GridCell[]): string {
  if (cells.some((c) => c.status === "running")) return "running";
  if (cells.length > 0 && cells.every((c) => c.status === "complete")) return "complete";
  if (cells.some((c) => c.status === "failed") && cells.every((c) => c.status === "failed" || c.status === "complete"))
    return "failed";
  if (cells.some((c) => c.status === "failed")) return "failed";
  if (cells.some((c) => c.status === "pending")) return "pending";
  return cells[0]?.status ?? "pending";
}

/**
 * Ranks setups by judge score, then lower cost, then lower generation latency.
 * Partial runs never produce a final winner.
 */
export function rankSetups(args: {
  combos: ComboResult[];
  grid: GridCell[];
  runStatus: string;
}): SetupRanking {
  const byCombo = new Map<string, GridCell[]>();
  for (const cell of args.grid) {
    const list = byCombo.get(cell.comboId) ?? [];
    list.push(cell);
    byCombo.set(cell.comboId, list);
  }

  const allTerminal = ["complete", "failed", "canceled", "budget_exceeded"].includes(
    args.runStatus
  );
  const everySetupDone = args.combos.every((combo) => {
    const cells = byCombo.get(combo.comboId) ?? [];
    return (
      cells.length > 0 &&
      cells.every((c) => c.status === "complete" || c.status === "failed" || c.status === "skipped")
    );
  });

  const ranked: RankedSetup[] = args.combos.map((combo, index) => {
    const cells = byCombo.get(combo.comboId) ?? [];
    const primary =
      cells.find((c) => c.status === "complete") ??
      cells.find((c) => c.status === "running") ??
      cells[0] ??
      null;
    const score = scoreOnTen(combo.avgScore ?? primary?.overallScore);
    return {
      comboId: combo.comboId,
      setupIndex: index + 1,
      setupLabel: `Setup ${index + 1}`,
      answerModel: shortModel(combo.genModel),
      score,
      scorePercent: scorePercent(combo.avgScore ?? primary?.overallScore),
      costUsd: combo.avgCostPerQuestion ?? combo.totalCostUsd,
      latencyMs: combo.p50GenerationLatencyMs,
      status: cellStatus(cells),
      trialId: primary?.trialId ?? null,
      answer: primary?.answer ?? null,
      rank: 0,
    };
  });

  ranked.sort((a, b) => {
    const aScore = a.score ?? -1;
    const bScore = b.score ?? -1;
    if (bScore !== aScore) return bScore - aScore;
    const aCost = a.costUsd ?? Number.POSITIVE_INFINITY;
    const bCost = b.costUsd ?? Number.POSITIVE_INFINITY;
    if (aCost !== bCost) return aCost - bCost;
    const aLat = a.latencyMs ?? Number.POSITIVE_INFINITY;
    const bLat = b.latencyMs ?? Number.POSITIVE_INFINITY;
    if (aLat !== bLat) return aLat - bLat;
    return a.setupIndex - b.setupIndex;
  });

  ranked.forEach((row, i) => {
    row.rank = i + 1;
  });

  const hasScores = ranked.some((row) => row.score != null);
  const top = hasScores ? ranked[0]! : null;
  const runner = hasScores && ranked.length > 1 ? ranked[1]! : null;
  const isFinal = allTerminal && everySetupDone && hasScores;

  let primaryReason: string | null = null;
  if (top?.scorePercent != null) {
    primaryReason = `Highest judge score: ${top.scorePercent}/100`;
  }

  const costDeltaUsd =
    top?.costUsd != null && runner?.costUsd != null
      ? top.costUsd - runner.costUsd
      : null;
  const latencyDeltaMs =
    top?.latencyMs != null && runner?.latencyMs != null
      ? top.latencyMs - runner.latencyMs
      : null;

  return {
    ranked,
    top,
    isFinal,
    hasScores,
    primaryReason,
    costDeltaUsd,
    latencyDeltaMs,
  };
}

/** Compact stage checklist for one setup during a live run. */
export type SetupStageProgress = {
  search: "done" | "active" | "waiting" | "skipped" | "failed";
  rerank: "done" | "active" | "waiting" | "skipped" | "failed";
  answer: "done" | "active" | "waiting" | "skipped" | "failed";
  judge: "done" | "active" | "waiting" | "skipped" | "failed";
};

export function setupStageProgress(args: {
  status: string;
  hasRerank: boolean;
  answer: string | null;
  score: string | null;
}): SetupStageProgress {
  const { status, hasRerank, answer, score } = args;
  if (status === "failed") {
    return {
      search: answer || score ? "done" : "failed",
      rerank: hasRerank ? (answer || score ? "done" : "failed") : "skipped",
      answer: answer ? "done" : "failed",
      judge: score ? "done" : "failed",
    };
  }
  if (status === "complete" || score) {
    return {
      search: "done",
      rerank: hasRerank ? "done" : "skipped",
      answer: "done",
      judge: "done",
    };
  }
  if (status === "running") {
    if (answer) {
      return {
        search: "done",
        rerank: hasRerank ? "done" : "skipped",
        answer: "done",
        judge: "active",
      };
    }
    return {
      search: "done",
      rerank: hasRerank ? "done" : "skipped",
      answer: "active",
      judge: "waiting",
    };
  }
  return {
    search: "waiting",
    rerank: hasRerank ? "waiting" : "skipped",
    answer: "waiting",
    judge: "waiting",
  };
}

export function describeSetupProgress(args: {
  setupLabel: string;
  progress: SetupStageProgress;
}): string {
  const { setupLabel, progress } = args;
  if (progress.judge === "active") return `${setupLabel} is being scored`;
  if (progress.answer === "active") return `${setupLabel} is writing an answer`;
  if (progress.rerank === "active") return `${setupLabel} is reranking passages`;
  if (progress.search === "active") return `${setupLabel} is searching`;
  if (progress.judge === "done") return `${setupLabel} is complete`;
  if (progress.judge === "failed" || progress.answer === "failed") {
    return `${setupLabel} failed`;
  }
  return `${setupLabel} is waiting`;
}
