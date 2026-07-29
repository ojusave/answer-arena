import { Button, Group, Stack, Text } from "@mantine/core";
import { COPY } from "../../lib/copy";
import {
  describeSetupProgress,
  rankSetups,
  setupStageProgress,
} from "../../lib/setup-ranking";
import type { RunPayload } from "../../hooks/types";

function elapsedMs(run: RunPayload["run"] | undefined): number {
  if (!run?.startedAt && !run?.createdAt) return 0;
  const start = Date.parse(run.startedAt ?? run.createdAt);
  const end =
    run.status === "complete" ||
    run.status === "failed" ||
    run.status === "canceled" ||
    run.status === "budget_exceeded"
      ? Date.parse(run.finishedAt ?? run.createdAt)
      : Date.now();
  return Math.max(0, end - start);
}

type Props = {
  run: RunPayload | undefined;
  isActive: boolean;
  onCancel?: () => void;
  canceling?: boolean;
};

/** Compact run header: progress while live, top setup when finished. */
export default function ComboRunSummary({
  run,
  isActive,
  onCancel,
  canceling,
}: Props) {
  if (!run) return null;

  const ranking = rankSetups({
    combos: run.comboResults ?? [],
    grid: run.grid ?? [],
    runStatus: run.run.status,
  });
  const setupCount = run.comboResults?.length ?? 0;
  const readyCount = (run.grid ?? []).filter(
    (cell) => cell.status === "complete" || Boolean(cell.answer?.trim())
  ).length;
  const elapsed = COPY.app.elapsed(elapsedMs(run.run) / 1000);
  const spend = COPY.app.spendLimit(
    Number(run.run.totalCostUsd).toFixed(2),
    Number(run.run.budgetUsd).toFixed(2)
  );

  if (isActive) {
    const byCombo = new Map((run.grid ?? []).map((cell) => [cell.comboId, cell]));
    const focus = (run.comboResults ?? [])
      .map((combo, index) => {
        const cell = byCombo.get(combo.comboId);
        const progress = setupStageProgress({
          status: cell?.status ?? "pending",
          hasRerank: Boolean(combo.rerankModel),
          answer: cell?.answer ?? null,
          score: cell?.overallScore ?? null,
        });
        return describeSetupProgress({
          setupLabel: `Setup ${index + 1}`,
          progress,
        });
      })
      .slice(0, 3)
      .join(". ");

    return (
      <section className="run-summary run-summary--live pg-arena-card" aria-label="Run progress">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start" gap="sm">
            <Stack gap={4}>
              <Text className="pg-section-title">{COPY.app.phaseRunning}</Text>
              <Text fw={650} size="lg">
                {COPY.app.runningSetupsHeading(setupCount)}
              </Text>
            </Stack>
            {onCancel && (
              <Button
                type="button"
                color="red"
                variant="subtle"
                size="compact-sm"
                onClick={onCancel}
                loading={canceling}
              >
                {COPY.app.cancel}
              </Button>
            )}
          </Group>
          {focus && (
            <Text size="sm" className="setup-progress__focus">
              {focus}.
            </Text>
          )}
          <Group gap="md" wrap="wrap">
            <Text size="sm">{COPY.app.answersReady(readyCount, setupCount)}</Text>
            <Text size="sm" c="dimmed">
              {elapsed}
            </Text>
            <Text size="sm" c="dimmed">
              {spend}
            </Text>
          </Group>
        </Stack>
      </section>
    );
  }

  const top = ranking.top;
  const title = !ranking.hasScores
    ? COPY.app.noWinnerYet
    : ranking.isFinal
      ? `${COPY.app.topSetup}: ${top?.setupLabel ?? ""}`
      : `${COPY.app.leadingSoFar}: ${top?.setupLabel ?? ""}`;

  return (
    <section className="run-summary run-summary--done pg-arena-card" aria-label="Comparison result">
      <Stack gap="sm">
        <Text className="pg-section-title">{COPY.app.phaseResults}</Text>
        <Text fw={650} size="lg">
          {title}
        </Text>
        {ranking.primaryReason && (
          <Text size="sm">
            <Text span fw={600}>
              {COPY.app.whyItLeads}:{" "}
            </Text>
            {ranking.primaryReason}
          </Text>
        )}
        {(ranking.costDeltaUsd != null || ranking.latencyDeltaMs != null) && (
          <Group gap="md" wrap="wrap">
            {ranking.costDeltaUsd != null && (
              <Text size="sm" c="dimmed">
                {COPY.app.costVsNext(
                  `${ranking.costDeltaUsd >= 0 ? "" : "-"}$${Math.abs(ranking.costDeltaUsd).toFixed(4)}`
                )}
              </Text>
            )}
            {ranking.latencyDeltaMs != null && (
              <Text size="sm" c="dimmed">
                {COPY.app.latencyVsNext(
                  `${ranking.latencyDeltaMs >= 0 ? "" : "-"}${Math.abs(Math.round(ranking.latencyDeltaMs))}ms`
                )}
              </Text>
            )}
          </Group>
        )}
        <Text size="xs" c="dimmed">
          {COPY.app.rankingBasis}
        </Text>
        <Group gap="md" wrap="wrap">
          <Text size="sm" c="dimmed">
            {COPY.app.answersReady(readyCount, setupCount)}
          </Text>
          <Text size="sm" c="dimmed">
            {elapsed}
          </Text>
          <Text size="sm" c="dimmed">
            {spend}
          </Text>
        </Group>
      </Stack>
    </section>
  );
}
