import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { COPY, friendlyError } from "../lib/copy";
import { notifyError, notifySuccess } from "../lib/notify";
import type { RunPayload, TrialDetail } from "./types";

const ACTIVE = new Set(["ingesting", "running", "aggregating", "draft"]);

type SetupInput = {
  embeddingModel: string;
  rerankModel: string | null;
  genModel: string;
};

type StartArgs = {
  corpusId: string;
  name: string;
  setups: SetupInput[];
  retrieveK: number;
  finalK: number;
  budgetUsd: number;
  /** Chat model that scores every answer in the run. */
  judgeModel: string;
  /** Single-question run: the question to answer. */
  questionId?: string;
  /** Escalation: run every setup against all corpus questions. */
  allQuestions?: boolean;
};

export function useWorkspaceRun() {
  const qc = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null);

  const runQuery = useQuery({
    queryKey: ["workspace-run", runId],
    queryFn: () => api<RunPayload>(`/api/runs/${runId}`),
    enabled: Boolean(runId),
    refetchInterval: (q) =>
      ACTIVE.has(q.state.data?.run.status ?? "") ? 2000 : false,
  });

  // A reload loses the run id, but the run keeps going and still counts against
  // this session's limit. Reattach once on load so it stays watchable and
  // cancelable instead of blocking the next run with nothing on screen.
  const [reattach, setReattach] = useState(true);

  const activeRunQuery = useQuery({
    queryKey: ["workspace-active-run"],
    queryFn: () => api<{ runId: string; status: string } | null>("/api/runs/active"),
    enabled: reattach && runId === null,
    // Whether a run is in flight changes constantly, and a cached "none" here
    // would leave the workspace idle while the session still holds a slot.
    staleTime: 0,
  });

  useEffect(() => {
    const adopted = activeRunQuery.data?.runId;
    if (!reattach || !adopted) return;
    setRunId(adopted);
    setReattach(false);
  }, [activeRunQuery.data?.runId, reattach]);

  const trialQuery = useQuery({
    queryKey: ["workspace-trial", selectedTrialId],
    queryFn: () => api<TrialDetail>(`/api/trials/${selectedTrialId}`),
    enabled: Boolean(selectedTrialId),
  });

  useEffect(() => {
    if (selectedTrialId || !runQuery.data?.grid.length) return;
    const firstUseful =
      runQuery.data.grid.find((cell) => cell.status === "complete") ??
      runQuery.data.grid.find((cell) => cell.status === "running") ??
      runQuery.data.grid[0];
    if (firstUseful?.trialId) setSelectedTrialId(firstUseful.trialId);
  }, [runQuery.data?.grid, selectedTrialId]);

  const start = useMutation({
    mutationFn: async (args: StartArgs) => {
      // The schema still requires the model arrays; derive them from the setups
      // so callers only compose explicit pipelines. The server re-normalizes.
      const embeddingModels = [
        ...new Set(args.setups.map((s) => s.embeddingModel)),
      ];
      const rerankModels = [...new Set(args.setups.map((s) => s.rerankModel))];
      const genModels = [...new Set(args.setups.map((s) => s.genModel))];
      const questionIds = args.allQuestions
        ? "all"
        : args.questionId
          ? [args.questionId]
          : [];
      return api<{ runId: string }>("/api/runs", {
        method: "POST",
        body: JSON.stringify({
          corpusId: args.corpusId,
          name: args.name,
          embeddingModels,
          rerankModels,
          genModels,
          setups: args.setups,
          questionIds,
          retrieveK: args.retrieveK,
          finalK: args.finalK,
          budgetUsd: args.budgetUsd,
          judgeModel: args.judgeModel || undefined,
        }),
      });
    },
    onSuccess: (data) => {
      setRunId(data.runId);
      setSelectedTrialId(null);
      setReattach(false);
      notifySuccess(COPY.notify.comparisonStarted);
      qc.invalidateQueries({ queryKey: ["workspace-run", data.runId] });
    },
    onError: (e) => {
      // The session already has a run this tab lost track of. Pull it back so
      // the message about cancelling it refers to something on screen.
      if (e instanceof Error && (e as Error & { code?: string }).code === "session_run_limit") {
        setReattach(true);
        qc.invalidateQueries({ queryKey: ["workspace-active-run"] });
      }
      notifyError(
        "Could not start comparison",
        e instanceof Error ? friendlyError(e.message) : undefined
      );
    },
  });

  const cancel = useMutation({
    mutationFn: () => api(`/api/runs/${runId}/cancel`, { method: "POST" }),
    onSuccess: () => {
      notifySuccess(COPY.notify.comparisonStopped);
      qc.invalidateQueries({ queryKey: ["workspace-run", runId] });
    },
    onError: (e) =>
      notifyError(
        "Could not stop run",
        e instanceof Error ? friendlyError(e.message) : undefined
      ),
  });

  const reset = useCallback(() => {
    setRunId(null);
    setSelectedTrialId(null);
    setReattach(false);
  }, []);

  const running = Boolean(runId && ACTIVE.has(runQuery.data?.run.status ?? ""));

  return {
    runId,
    run: runQuery.data,
    isLoadingRun: runQuery.isLoading,
    runError: runQuery.isError,
    running,
    start,
    cancel,
    reset,
    selectedTrialId,
    setSelectedTrialId,
    trial: trialQuery.data,
    trialLoading: trialQuery.isLoading,
  };
}
