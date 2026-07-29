import type { ComboResult } from "@ragtime/core";

export type ComboModels = {
  search: string;
  rerank: string | null;
  answer: string;
};

/** Short display name from a "provider/model" style id (slash is optional). */
export function shortModelName(id: string): string {
  const slug = id.split("/").pop() ?? id;
  return slug
    .replace(/-instruct.*$/i, "")
    .replace(/:free$/i, "")
    .replace(/-v\d+(\.\d+)?$/i, "");
}

export function comboModels(combo: ComboResult): ComboModels {
  return {
    search: shortModelName(combo.embeddingModel),
    rerank: combo.rerankModel ? shortModelName(combo.rerankModel) : null,
    answer: shortModelName(combo.genModel),
  };
}

/**
 * Shortest name that still identifies each setup within one run: the answer
 * model alone when it is unique, otherwise the full three-model label.
 */
export function comboShortLabels(combos: ComboResult[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const combo of combos) {
    const answer = shortModelName(combo.genModel);
    counts.set(answer, (counts.get(answer) ?? 0) + 1);
  }
  return new Map(
    combos.map((combo) => {
      const answer = shortModelName(combo.genModel);
      if (counts.get(answer) === 1) return [combo.comboId, answer];
      const models = comboModels(combo);
      return [
        combo.comboId,
        `${models.search} / ${models.rerank ?? "no rerank"} / ${answer}`,
      ];
    })
  );
}

export function comboDurationMs(
  combo: ComboResult,
  status: string
): number {
  if (status === "pending") return 0;
  if (status === "running") return combo.p50GenerationLatencyMs ?? 3000;
  return combo.p50GenerationLatencyMs ?? 6000;
}
