/** Human-readable activity feed lines. */

import { COPY, runStatusLabel, stageLabel } from "./copy.js";

type EventRow = {
  type: string;
  payload: Record<string, unknown>;
};

/** Trial id to setup name, so per-setup events say which setup they describe. */
export type SetupLabels = ReadonlyMap<string, string>;

/** Visual weight of a feed line. Maps to arena-feed-row--* dot colors. */
export type EventTone = "done" | "active" | "warn" | "failed" | "idle";

export function formatActivityLine(e: EventRow, setups?: SetupLabels): string {
  const p = e.payload;
  const setup = setups?.get(String(p.trialId ?? ""));
  const suffix = setup ? COPY.events.setupSuffix(setup) : "";

  switch (e.type) {
    case "embed.batch": {
      const r = p.receipt as { costUsd?: number; costUnknown?: boolean } | undefined;
      const cost = r?.costUnknown ? "cost unknown" : `$${Number(r?.costUsd ?? 0).toFixed(4)}`;
      const model = String(p.model ?? "").split("/").pop() ?? "model";
      return COPY.events.indexed(Number(p.embedded ?? 0), model, cost);
    }
    case "trial.stage":
      return COPY.events.stageFinished(stageLabel(String(p.stage ?? ""))) + suffix;
    case "trial.retry":
      return COPY.events.retry(Number(p.attempt ?? 1)) + suffix;
    case "trial.failed":
      return (
        COPY.events.answerFailed(String(p.message ?? COPY.events.seeLogs)) + suffix
      );
    case "embed.failed":
      return COPY.events.indexFailed(String(p.message ?? COPY.events.seeLogs));
    case "chaos.injected":
      return COPY.events.chaos + suffix;
    case "budget.tripped":
      return COPY.events.budgetTripped;
    case "run.status":
      return COPY.events.runStatus(runStatusLabel(String(p.status ?? "")));
    case "run.partial":
      return COPY.events.partial(
        Number(p.scored ?? 0),
        Number(p.failed ?? 0),
        Number(p.stuck ?? 0)
      );
    case "doc.ingested":
      return COPY.events.documentIndexed(Number(p.chunkCount ?? 1));
    default:
      return COPY.events.unknown;
  }
}

export function eventTone(e: EventRow): EventTone {
  if (e.type === "run.status") {
    const status = String(e.payload.status ?? "");
    if (status === "failed") return "failed";
    if (status === "complete") return "done";
    if (status === "canceled" || status === "budget_exceeded") return "warn";
    return "active";
  }
  if (e.type.endsWith(".failed") || e.type === "budget.tripped") return "failed";
  if (e.type === "trial.retry" || e.type === "chaos.injected") return "warn";
  if (e.type === "run.partial") return "warn";
  if (e.type === "trial.stage") return "done";
  if (e.type === "doc.ingested" || e.type === "embed.batch") return "active";
  return "idle";
}
