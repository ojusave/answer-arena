import { Alert, Button, Collapse, Group, Loader, Stack, Text, UnstyledButton } from "@mantine/core";
import { useMemo, useState } from "react";
import { COPY, runStatusLabel } from "../../lib/copy";
import { comboModels, shortModelName } from "../../lib/combo-display";
import type { SetupLabels } from "../../lib/execution-timeline";
import type { RunPayload } from "../../hooks/types";
import AnswerCards from "./AnswerCards";
import ComboProgressGrid from "./ComboProgressGrid";
import ComboRunSummary from "./ComboRunSummary";
import PlaygroundIdle from "./PlaygroundIdle";
import ResultsPanel from "./ResultsPanel";
import RunTimeline from "./RunTimeline";
import SetupProgressRows from "./SetupProgressRows";

type Props = {
  run: RunPayload | undefined;
  runId: string | null;
  runLoading: boolean;
  runError: boolean;
  selectedTrialId: string | null;
  onSelectTrial: (trialId: string) => void;
  onCancel: () => void;
  canceling: boolean;
  onRunAgain: () => void;
  totalQuestionCount: number;
  onEscalate: () => void;
  escalating: boolean;
};

export default function CanvasPanel({
  run,
  runId,
  runLoading,
  runError,
  selectedTrialId,
  onSelectTrial,
  onCancel,
  canceling,
  onRunAgain,
  totalQuestionCount,
  onEscalate,
  escalating,
}: Props) {
  const [timelineOpen, setTimelineOpen] = useState(false);
  const status = run?.run.status;
  const isActive = status === "ingesting" || status === "running" || status === "aggregating";
  const isComplete = status === "complete" || status === "budget_exceeded";
  const isMultiQuestion = (run?.questions?.length ?? 0) > 1;
  const canEscalate = isComplete && !isMultiQuestion && totalQuestionCount > 1;

  const setupLabels = useMemo((): SetupLabels => {
    const combos = run?.comboResults ?? [];
    const byCombo = new Map(
      combos.map((combo, index) => {
        const models = comboModels(combo);
        return [
          combo.comboId,
          {
            title: `Setup ${index + 1}`,
            detail: models.answer || shortModelName(combo.genModel),
          },
        ] as const;
      })
    );
    return new Map(
      (run?.grid ?? []).flatMap((cell) => {
        const label = byCombo.get(cell.comboId);
        return label ? [[cell.trialId, label] as const] : [];
      })
    );
  }, [run?.comboResults, run?.grid]);

  return (
    <Stack gap="md" className="canvas-panel">
      {!runId && <PlaygroundIdle />}

      {runId && runLoading && !run && (
        <Stack align="center" gap="sm" py="xl">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Loading run…
          </Text>
        </Stack>
      )}

      {runId && runError && !run && (
        <Alert color="red" title="Run load failed">
          Could not load run status. Refresh the page and try again.
        </Alert>
      )}

      {run && (
        <>
          <ComboRunSummary
            run={run}
            isActive={isActive}
            onCancel={isActive ? onCancel : undefined}
            canceling={canceling}
          />

          {run.run.status === "failed" && (
            <Alert color="red" title={runStatusLabel("failed")}>
              {run.run.error ?? "Run did not finish."}
            </Alert>
          )}

          {isActive && !isMultiQuestion && (
            <SetupProgressRows
              combos={run.comboResults ?? []}
              grid={run.grid ?? []}
              selectedTrialId={selectedTrialId}
              onSelect={onSelectTrial}
            />
          )}

          {isMultiQuestion ? (
            <ComboProgressGrid
              combos={run.comboResults ?? []}
              grid={run.grid ?? []}
              selectedTrialId={selectedTrialId}
              onSelect={onSelectTrial}
            />
          ) : (
            !isActive && (
              <AnswerCards
                combos={run.comboResults ?? []}
                grid={run.grid ?? []}
                runStatus={run.run.status}
                selectedTrialId={selectedTrialId}
                onSelect={onSelectTrial}
              />
            )
          )}

          {isComplete && (
            <ResultsPanel runName={run.run.name} combos={run.comboResults} />
          )}

          {runId && (
            <section className="technical-timeline pg-arena-card pg-arena-card--subtle">
              <UnstyledButton
                type="button"
                className="technical-timeline__toggle"
                onClick={() => setTimelineOpen((open) => !open)}
                aria-expanded={timelineOpen}
              >
                <Text fw={650} size="sm">
                  {COPY.app.technicalTimeline} {timelineOpen ? "▾" : "▸"}
                </Text>
                <Text size="xs" c="dimmed">
                  Exact stage timing for every setup
                </Text>
              </UnstyledButton>
              <Collapse in={timelineOpen} keepMounted={false}>
                <div className="technical-timeline__body">
                  <RunTimeline
                    runId={runId}
                    runStatus={run.run.status}
                    setups={setupLabels}
                    startedAt={run.run.startedAt}
                    finishedAt={run.run.finishedAt}
                    selectedTrialId={selectedTrialId}
                    onSelectTrial={onSelectTrial}
                  />
                </div>
              </Collapse>
            </section>
          )}
        </>
      )}

      {run && isComplete && (
        <Group gap="sm">
          {canEscalate && (
            <Button
              type="button"
              variant="filled"
              onClick={onEscalate}
              loading={escalating}
            >
              {COPY.app.escalateButton(totalQuestionCount)}
            </Button>
          )}
          <Button type="button" variant="light" onClick={onRunAgain} w="fit-content">
            {COPY.app.runAgain}
          </Button>
        </Group>
      )}
    </Stack>
  );
}
