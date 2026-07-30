import { Badge, Group, Loader, Stack, Text, Tooltip } from "@mantine/core";
import { useMemo } from "react";
import TrialStagesPanel from "../TrialStagesPanel";
import { COPY, TEST_STATUS_LABEL } from "../../lib/copy";
import { scorePercent, scoreTone } from "../../lib/score-display";
import { comboLabel } from "@ragtime/core";
import type { TrialDetail } from "../../hooks/types";

/** Detail pane for the selected answer: score, stages, and retrieved passages. */
export default function ComboInspector({
  trial,
  loading,
}: {
  trial: TrialDetail | undefined;
  loading: boolean;
}) {
  const chunkMap = useMemo(() => {
    const m = new Map<string, { id: string; content: string; idx?: number }>();
    for (const c of trial?.chunks ?? []) {
      m.set(c.id, c);
    }
    return m;
  }, [trial]);

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="sm" />
      </Stack>
    );
  }

  if (!trial) {
    return (
      <Stack gap="sm" className="combo-inspector">
        <Text size="sm" c="dimmed">
          {COPY.app.inspectorEmpty}
        </Text>
      </Stack>
    );
  }

  const label = comboLabel(
    trial.combo.embeddingModel,
    trial.combo.rerankModel,
    trial.combo.genModel
  );
  const score = scorePercent(trial.trial.overallScore);
  const tone = scoreTone(score);
  const statusLabel = TEST_STATUS_LABEL[trial.trial.status] ?? trial.trial.status;

  return (
    <Stack gap="md" className="combo-inspector">
      <section className="inspector-setup-header" aria-label={COPY.app.selectedSetup}>
        <Text className="inspector-score-label">{COPY.app.selectedSetup}</Text>
        <Text fw={650} size="sm" className="inspector-setup-models">
          {label}
        </Text>
        <Text size="xs" c="dimmed" lineClamp={4}>
          {trial.question.text}
        </Text>
      </section>

      <section
        className={`inspector-score-card score-tone--${tone}`}
        aria-label={COPY.app.inspectorScoreAria}
      >
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={3}>
            <Tooltip label={COPY.app.judgeScoreTooltip} multiline w={240} withArrow>
              <Text className="inspector-score-label" style={{ cursor: "help" }}>
                {COPY.app.judgeScore}
              </Text>
            </Tooltip>
            <Group gap={4} align="baseline">
              <Text component="span" className="inspector-score-value">
                {score ?? "—"}
              </Text>
              <Text component="span" className="inspector-score-scale">
                /100
              </Text>
            </Group>
          </Stack>
          <Badge
            color={
              trial.trial.status === "complete"
                ? "green"
                : trial.trial.status === "failed"
                  ? "red"
                  : "gray"
            }
            variant="light"
          >
            {statusLabel}
          </Badge>
        </Group>
      </section>

      {trial.trial.status === "failed" && trial.trial.error && (
        <section aria-label={COPY.app.inspectorFailure}>
          <Text className="inspector-score-label">{COPY.app.inspectorFailure}</Text>
          <Text size="sm" c="red">
            {trial.trial.error}
          </Text>
        </section>
      )}

      <TrialStagesPanel
        stages={trial.trial.stages}
        answer={trial.trial.answer}
        chunks={chunkMap}
      />
    </Stack>
  );
}
