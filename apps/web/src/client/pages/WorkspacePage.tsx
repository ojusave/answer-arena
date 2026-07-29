import { Alert, Button, Center, Group, Loader, Modal, Stack, Tabs, Text } from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { COPY } from "../lib/copy";
import { useDemoBootstrap } from "../hooks/useDemoBootstrap";
import { useModelMatrix } from "../hooks/useModelMatrix";
import { useWorkspaceRun } from "../hooks/useWorkspaceRun";
import CanvasPanel from "../components/workspace/CanvasPanel";
import ComboInspector from "../components/workspace/ComboInspector";
import ControlsPanel from "../components/workspace/ControlsPanel";
import DemoSetupPanel from "../components/workspace/DemoSetupPanel";
import ResizableWorkspace, {
  type WorkspacePhase,
} from "../components/workspace/ResizableWorkspace";

export default function WorkspacePage() {
  const mobile = useMediaQuery("(max-width: 70em)");
  const {
    demo,
    samples,
    isLoading,
    isBootstrapping,
    seedDemo,
    seeding,
    seedFailed,
    seedError,
    isError,
    refetch,
  } = useDemoBootstrap();
  const matrix = useModelMatrix(1);
  const workspace = useWorkspaceRun();

  const [prompt, setPrompt] = useState("");
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<string | null>("inputs");
  const [inspectOpen, setInspectOpen] = useState(false);
  const [escalateOpen, { open: openEscalate, close: closeEscalate }] =
    useDisclosure(false);

  const runStatus = workspace.run?.run.status;
  const isActive =
    runStatus === "ingesting" ||
    runStatus === "running" ||
    runStatus === "aggregating";
  const isComplete =
    runStatus === "complete" ||
    runStatus === "budget_exceeded" ||
    runStatus === "failed" ||
    runStatus === "canceled";

  const phase: WorkspacePhase = !workspace.runId
    ? "configure"
    : isActive
      ? "running"
      : "results";

  const showInspector =
    phase === "results" &&
    inspectOpen &&
    Boolean(workspace.selectedTrialId);

  useEffect(() => {
    if (workspace.runId) setMobileTab(phase === "running" ? "arena" : "arena");
  }, [workspace.runId, phase]);

  useEffect(() => {
    if (phase === "configure") setInspectOpen(false);
    if (phase === "running") setInspectOpen(false);
  }, [phase]);

  useEffect(() => {
    if (samples.length && !selectedSampleId) {
      setSelectedSampleId(samples[0]!.id);
      setPrompt(samples[0]!.text);
    }
  }, [samples, selectedSampleId]);

  useEffect(() => {
    if (matrix.catalog && !matrix.presetApplied && matrix.setups.length === 0) {
      matrix.applyStarterPreset();
      matrix.setPresetApplied(true);
    }
  }, [matrix.catalog, matrix.presetApplied, matrix.setups.length, matrix]);

  const selectedSample = useMemo(
    () => samples.find((s) => s.id === selectedSampleId) ?? null,
    [samples, selectedSampleId]
  );

  function handleSampleChange(id: string | null) {
    setSelectedSampleId(id);
    const sample = samples.find((s) => s.id === id);
    if (sample) setPrompt(sample.text);
  }

  function handleTrialSelect(trialId: string) {
    workspace.setSelectedTrialId(trialId);
    if (phase !== "results") return;
    setInspectOpen(true);
    if (mobile) setMobileTab("details");
  }

  async function handleRun() {
    if (!demo?.corpusId || !prompt.trim()) return;

    let questionId = selectedSampleId;
    const usingCustom =
      !selectedSample || prompt.trim() !== selectedSample.text.trim();

    if (usingCustom) {
      const created = await api<{ id: string }>("/api/questions", {
        method: "POST",
        body: JSON.stringify({
          text: prompt.trim(),
          referenceAnswer: selectedSample?.referenceAnswer ?? null,
        }),
      });
      questionId = created.id;
    }

    if (!questionId) return;

    workspace.start.mutate({
      corpusId: demo.corpusId,
      questionId,
      name: `Comparison ${new Date().toLocaleTimeString()}`,
      setups: matrix.setups.map((setup) => ({
        embeddingModel: setup.embeddingModel,
        rerankModel: setup.rerankModel,
        genModel: setup.genModel,
      })),
      retrieveK: matrix.retrieveK,
      finalK: matrix.finalK,
      budgetUsd: Number(matrix.budget) || 5,
      judgeModel: matrix.judgeModel,
    });
  }

  function confirmEscalate() {
    if (!demo?.corpusId) return;
    closeEscalate();
    workspace.start.mutate({
      corpusId: demo.corpusId,
      name: `Full comparison ${new Date().toLocaleTimeString()}`,
      setups: matrix.setups.map((setup) => ({
        embeddingModel: setup.embeddingModel,
        rerankModel: setup.rerankModel,
        genModel: setup.genModel,
      })),
      allQuestions: true,
      retrieveK: matrix.retrieveK,
      finalK: matrix.finalK,
      budgetUsd: Number(matrix.budget) || 5,
      judgeModel: matrix.judgeModel,
    });
  }

  if (isLoading || isBootstrapping) {
    return (
      <Center className="pg-setup">
        <Stack align="center" gap="sm">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            {isBootstrapping ? COPY.app.loadingDemo : COPY.common.loading}
          </Text>
        </Stack>
      </Center>
    );
  }

  if (isError) {
    return (
      <Center className="pg-setup">
        <Alert color="red" title="Load failed" maw={480}>
          <Button size="compact-sm" variant="light" onClick={() => refetch()}>
            {COPY.common.tryAgain}
          </Button>
        </Alert>
      </Center>
    );
  }

  if (!demo?.ready || !demo.corpusId) {
    return (
      <DemoSetupPanel
        loading={seeding}
        failed={seedFailed}
        errorMessage={seedError}
        onRetry={() => seedDemo()}
      />
    );
  }

  const controls = (
    <Stack gap="md">
      {(phase === "running" || phase === "results") && (
        <Alert color="gray" variant="light">
          <Group justify="space-between" align="center" gap="sm" wrap="wrap">
            <Text size="sm">
              {phase === "running"
                ? COPY.app.configureWhileRunning
                : COPY.app.backToConfigure}
            </Text>
            {phase === "results" && (
              <Button size="compact-sm" variant="light" onClick={workspace.reset}>
                {COPY.app.backToConfigure}
              </Button>
            )}
          </Group>
        </Alert>
      )}
      <ControlsPanel
        samples={samples}
        prompt={prompt}
        onPromptChange={setPrompt}
        selectedSampleId={selectedSampleId}
        onSampleChange={handleSampleChange}
        matrix={matrix}
        onRun={() => void handleRun()}
        running={workspace.running || workspace.start.isPending || phase === "running"}
        canRun={matrix.canRun && Boolean(prompt.trim()) && phase === "configure"}
      />
    </Stack>
  );

  const canvas = (
    <CanvasPanel
      run={workspace.run}
      runId={workspace.runId}
      runLoading={workspace.isLoadingRun}
      runError={workspace.runError}
      onCancel={() => workspace.cancel.mutate()}
      canceling={workspace.cancel.isPending}
      onRunAgain={workspace.reset}
      onSelectTrial={handleTrialSelect}
      selectedTrialId={workspace.selectedTrialId}
      totalQuestionCount={demo.questionCount}
      onEscalate={openEscalate}
      escalating={workspace.start.isPending}
    />
  );

  const escalateTrialCount = matrix.setups.length * (demo.questionCount ?? 0);
  const escalateBudget = (Number(matrix.budget) || 5).toFixed(2);
  const escalateModal = (
    <Modal
      opened={escalateOpen}
      onClose={closeEscalate}
      title={COPY.app.escalateConfirmTitle}
      centered
    >
      <Stack gap="md">
        <Text size="sm">
          {COPY.app.escalateConfirmBody(escalateTrialCount, escalateBudget)}
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={closeEscalate}>
            {COPY.app.escalateCancel}
          </Button>
          <Button onClick={confirmEscalate}>{COPY.app.escalateConfirm}</Button>
        </Group>
      </Stack>
    </Modal>
  );

  const inspector = (
    <Stack gap="sm">
      {showInspector && (
        <Button
          type="button"
          variant="subtle"
          size="compact-sm"
          w="fit-content"
          onClick={() => setInspectOpen(false)}
        >
          {COPY.app.closeEvidence}
        </Button>
      )}
      <ComboInspector trial={workspace.trial} loading={workspace.trialLoading} />
    </Stack>
  );

  if (mobile) {
    const tabs =
      phase === "configure"
        ? [{ value: "inputs", label: COPY.app.phaseConfigure }]
        : phase === "running"
          ? [
              { value: "arena", label: COPY.app.phaseRunning },
              { value: "inputs", label: COPY.app.phaseConfigure },
            ]
          : [
              { value: "arena", label: COPY.app.phaseResults },
              { value: "details", label: COPY.app.zones.detail },
              { value: "inputs", label: COPY.app.phaseConfigure },
            ];

    return (
      <div className="workspace-page">
        {escalateModal}
        <Tabs
          value={mobileTab}
          onChange={setMobileTab}
          defaultValue={phase === "configure" ? "inputs" : "arena"}
          className="mobile-panes"
        >
          <Tabs.List grow>
            {tabs.map((tab) => (
              <Tabs.Tab key={tab.value} value={tab.value}>
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          <Tabs.Panel value="inputs" className="mobile-pane">
            {controls}
          </Tabs.Panel>
          <Tabs.Panel value="arena" className="mobile-pane">
            {canvas}
          </Tabs.Panel>
          <Tabs.Panel value="details" className="mobile-pane">
            {inspector}
          </Tabs.Panel>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      {escalateModal}
      {phase === "configure" ? (
        <ResizableWorkspace
          phase="configure"
          controls={controls}
          canvas={<div />}
          inspector={<div />}
          showInspector={false}
        />
      ) : (
        <ResizableWorkspace
          phase={phase}
          controls={<div />}
          canvas={canvas}
          inspector={inspector}
          showInspector={showInspector}
        />
      )}
    </div>
  );
}
