import { Badge, Collapse, Group, Loader, Stack, Text, UnstyledButton } from "@mantine/core";
import { useState } from "react";
import type { ComboResult } from "@ragtime/core";
import { COPY, TEST_STATUS_LABEL } from "../../lib/copy";
import { comboModels } from "../../lib/combo-display";
import { scorePercent, scoreTone } from "../../lib/score-display";
import { rankSetups } from "../../lib/setup-ranking";
import type { GridCell } from "../../hooks/types";

type Props = {
  combos: ComboResult[];
  grid: GridCell[];
  runStatus: string;
  selectedTrialId: string | null;
  onSelect: (trialId: string) => void;
};

function statusColor(status: string): string {
  if (status === "complete") return "green";
  if (status === "failed") return "red";
  if (status === "running") return "renderPurple";
  return "gray";
}

/** Decision-oriented answer cards: score, preview, cost, latency, evidence CTA. */
export default function AnswerCards({
  combos,
  grid,
  runStatus,
  selectedTrialId,
  onSelect,
}: Props) {
  const [openDetails, setOpenDetails] = useState<string | null>(null);
  const lookup = new Map(grid.map((g) => [g.comboId, g]));
  const ranking = rankSetups({ combos, grid, runStatus });
  const rankByCombo = new Map(ranking.ranked.map((row) => [row.comboId, row]));

  return (
    <Stack gap="sm" className="answer-cards pg-arena-card">
      <Stack gap={0}>
        <Text className="pg-section-title">{COPY.app.answersTitle}</Text>
        <Text size="xs" c="dimmed">
          {COPY.app.answersHint}
        </Text>
      </Stack>

      <div className="answer-cards-grid">
        {combos.map((combo, index) => {
          const cell = lookup.get(combo.comboId);
          const ranked = rankByCombo.get(combo.comboId);
          const status = cell?.status ?? "pending";
          const statusLabel = TEST_STATUS_LABEL[status] ?? "Pending";
          const selected = cell?.trialId === selectedTrialId;
          const models = comboModels(combo);
          const score = ranked?.scorePercent ?? scorePercent(cell?.overallScore);
          const tone = scoreTone(score);
          const answer = cell?.answer?.trim();
          const detailsOpen = openDetails === combo.comboId;
          const badge =
            ranking.hasScores && ranked?.rank === 1
              ? ranking.isFinal
                ? COPY.app.topSetup
                : COPY.app.leadingSoFar
              : ranking.hasScores && ranked?.rank === 2
                ? COPY.app.runnerUp
                : null;

          return (
            <div
              key={combo.comboId}
              className={`answer-card${selected ? " answer-card--selected" : ""}`}
            >
              <Group justify="space-between" align="flex-start" gap="sm" mb={6}>
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Text size="sm" fw={700}>
                    Setup {index + 1}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {models.answer}
                  </Text>
                </Stack>
                <Group gap={6}>
                  {badge && (
                    <Badge color="renderPurple" variant="light" size="sm">
                      {badge}
                    </Badge>
                  )}
                  <Badge color={statusColor(status)} variant="light" size="sm">
                    {statusLabel}
                  </Badge>
                </Group>
              </Group>

              <div className={`answer-card-score-block score-tone--${tone}`}>
                <Text size="xs" tt="uppercase" fw={600}>
                  {COPY.app.judgeScore}
                </Text>
                <Group gap={4} align="baseline">
                  <Text className="answer-card-score-number">{score ?? "—"}</Text>
                  <Text size="sm" c="dimmed">
                    /100
                  </Text>
                </Group>
              </div>

              <div className="answer-card-body">
                {status === "running" && !answer ? (
                  <Group gap="xs">
                    <Loader size="xs" />
                    <Text size="sm" c="dimmed">
                      {COPY.app.answerRunning}
                    </Text>
                  </Group>
                ) : status === "pending" ? (
                  <Text size="sm" c="dimmed">
                    {COPY.app.answerPending}
                  </Text>
                ) : status === "failed" && !answer ? (
                  <Text size="sm" c="red">
                    {COPY.app.answerFailed}
                  </Text>
                ) : answer ? (
                  <Text size="sm" className="answer-card-text" lineClamp={5}>
                    {answer}
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    {COPY.app.answerEmpty}
                  </Text>
                )}
              </div>

              <Group gap="md" mt="sm" wrap="wrap">
                <Text size="xs" c="dimmed">
                  {COPY.app.answerCost}: $
                  {ranked?.costUsd != null ? ranked.costUsd.toFixed(4) : "—"}
                </Text>
                <Text size="xs" c="dimmed">
                  {COPY.app.answerLatency}:{" "}
                  {ranked?.latencyMs != null
                    ? `${Math.round(ranked.latencyMs)}ms`
                    : "—"}
                </Text>
              </Group>

              <Group gap="sm" mt="sm" wrap="wrap">
                <button
                  type="button"
                  className="answer-card__cta"
                  disabled={!cell}
                  onClick={() => cell && onSelect(cell.trialId)}
                >
                  {COPY.app.seeAnswerAndEvidence}
                </button>
                <UnstyledButton
                  type="button"
                  className="answer-card__details-toggle"
                  onClick={() =>
                    setOpenDetails((current) =>
                      current === combo.comboId ? null : combo.comboId
                    )
                  }
                  aria-expanded={detailsOpen}
                >
                  {COPY.app.setupDetails} {detailsOpen ? "▾" : "▸"}
                </UnstyledButton>
              </Group>

              <Collapse in={detailsOpen} keepMounted={false}>
                <Stack gap={4} mt="xs" className="answer-card__details">
                  <Text size="xs">
                    {COPY.app.stageSearch}: {models.search}
                  </Text>
                  <Text size="xs">
                    {COPY.app.stageRerank}: {models.rerank ?? COPY.stages.none}
                  </Text>
                  <Text size="xs">
                    {COPY.app.stageAnswer}: {models.answer}
                  </Text>
                </Stack>
              </Collapse>
            </div>
          );
        })}
      </div>
    </Stack>
  );
}
