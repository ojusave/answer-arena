import { Badge, Group, Stack, Text } from "@mantine/core";
import type { ComboResult } from "@ragtime/core";
import { COPY } from "../../lib/copy";
import { setupStageProgress, type SetupStageProgress } from "../../lib/setup-ranking";
import type { GridCell } from "../../hooks/types";

type Props = {
  combos: ComboResult[];
  grid: GridCell[];
  selectedTrialId: string | null;
  onSelect: (trialId: string) => void;
};

function stageMark(state: SetupStageProgress[keyof SetupStageProgress]): string {
  if (state === "done") return "✓";
  if (state === "active") return "●";
  if (state === "failed") return "✕";
  if (state === "skipped") return "–";
  return "○";
}

function stageText(state: SetupStageProgress[keyof SetupStageProgress]): string {
  if (state === "done") return COPY.app.stageDone;
  if (state === "active") return COPY.app.stageActive;
  if (state === "failed") return COPY.app.stageFailed;
  if (state === "skipped") return COPY.app.stageSkipped;
  return COPY.app.stageWaiting;
}

/** One checklist row per setup while the comparison is live. */
export default function SetupProgressRows({
  combos,
  grid,
  selectedTrialId,
  onSelect,
}: Props) {
  const lookup = new Map(grid.map((cell) => [cell.comboId, cell]));

  const rows = combos.map((combo, index) => {
    const cell = lookup.get(combo.comboId);
    const progress = setupStageProgress({
      status: cell?.status ?? "pending",
      hasRerank: Boolean(combo.rerankModel),
      answer: cell?.answer ?? null,
      score: cell?.overallScore ?? null,
    });
    return { combo, cell, progress, label: `Setup ${index + 1}` };
  });

  return (
    <Stack gap="sm" className="setup-progress pg-arena-card">
      <Stack gap="xs">
        {rows.map(({ combo, cell, progress, label }) => {
          const selected = cell?.trialId === selectedTrialId;
          const stages: Array<[string, SetupStageProgress[keyof SetupStageProgress]]> = [
            [COPY.app.stageSearch, progress.search],
            [COPY.app.stageRerank, progress.rerank],
            [COPY.app.stageAnswer, progress.answer],
            [COPY.app.stageJudge, progress.judge],
          ];
          return (
            <button
              key={combo.comboId}
              type="button"
              className={`setup-progress__row${selected ? " setup-progress__row--selected" : ""}`}
              disabled={!cell}
              aria-pressed={selected}
              onClick={() => cell && onSelect(cell.trialId)}
            >
              <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Text size="sm" fw={650}>
                    {label}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {combo.genModel.split("/").pop()}
                  </Text>
                </Stack>
                <Badge
                  size="sm"
                  variant="light"
                  color={
                    cell?.status === "complete"
                      ? "green"
                      : cell?.status === "failed"
                        ? "red"
                        : cell?.status === "running"
                          ? "renderPurple"
                          : "gray"
                  }
                >
                  {cell?.status ?? "pending"}
                </Badge>
              </Group>
              <div className="setup-progress__stages" aria-label={`${label} stages`}>
                {stages.map(([name, state], i) => (
                  <span
                    key={name}
                    className={`setup-progress__stage setup-progress__stage--${state}`}
                  >
                    <span aria-hidden="true">{stageMark(state)}</span> {name}{" "}
                    <span className="setup-progress__stage-state">{stageText(state)}</span>
                    {i < stages.length - 1 ? (
                      <span className="setup-progress__arrow" aria-hidden="true">
                        →
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </Stack>
    </Stack>
  );
}
