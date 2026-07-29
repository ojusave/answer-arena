import { Alert, Button, Collapse, Group, Loader, Stack, Text } from "@mantine/core";
import { useMemo, useState } from "react";
import { COPY, runStatusLabel } from "../../lib/copy";
import { comboShortLabels } from "../../lib/combo-display";
import type { RunPayload } from "../../hooks/types";
import AnswerCards from "./AnswerCards";
import ComboProgressGrid from "./ComboProgressGrid";
import ComboRunSummary from "./ComboRunSummary";
import PlaygroundIdle from "./PlaygroundIdle";
import ResultsPanel from "./ResultsPanel";
import RunTimeline from "./RunTimeline";

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
  const canEscalate =
    isComplete && !isMultiQuestion && totalQuestionCount > 1;

  // Event rows carry a trialId; the feed needs the setup name behind it.
  const setupLabels = useMemo(() => {
    const byCombo = comboShortLabels(run?.comboResults ?? []);
    return new Map(
      (run?.grid ?? []).flatMap((cell) => {
        const label = byCombo.get(cell.comboId);
        return label ? [[cell.trialId, label] as [string, string]] : [];
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
          {isActive && runId ? (
            <RunTimeline
              runId={runId}
              runStatus={run.run.status}
              setups={setupLabels}
              startedAt={run.run.startedAt}
              finishedAt={run.run.finishedAt}
            />
          ) : (
            <ComboRunSummary run={run} />
          )}

          {isActive && (
            <Button
              type="button"
              color="red"
              variant="subtle"
              size="compact-sm"
              onClick={onCancel}
              loading={canceling}
              w="fit-content"
            >
              {COPY.app.cancel}
            </Button>
          )}

          {run.run.status === "failed" && (
            <Alert color="red" title={runStatusLabel("failed")}>
              {run.run.error ?? "Run did not finish."}
            </Alert>
          )}

          {isMultiQuestion ? (
            <ComboProgressGrid
              combos={run.comboResults ?? []}
              grid={run.grid ?? []}
              selectedTrialId={selectedTrialId}
              onSelect={onSelectTrial}
            />
          ) : (
            <AnswerCards
              combos={run.comboResults ?? []}
              grid={run.grid ?? []}
              selectedTrialId={selectedTrialId}
              onSelect={onSelectTrial}
            />
          )}

          {isComplete && (
            <ResultsPanel runName={run.run.name} combos={run.comboResults} />
          )}

          {!isActive && runId && (
            <Stack gap="xs" align="flex-start">
              <Button
                type="button"
                variant="subtle"
                size="compact-sm"
                onClick={() => setTimelineOpen((open) => !open)}
                aria-expanded={timelineOpen}
              >
                {timelineOpen
                  ? COPY.app.hideExecutionTimeline
                  : COPY.app.showExecutionTimeline}
              </Button>
              <Collapse in={timelineOpen} keepMounted={false} w="100%">
                <RunTimeline
                  runId={runId}
                  runStatus={run.run.status}
                  setups={setupLabels}
                  startedAt={run.run.startedAt}
                  finishedAt={run.run.finishedAt}
                />
              </Collapse>
            </Stack>
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
