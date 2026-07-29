import { Group, Stack, Text } from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { COPY, stageLabel } from "../../lib/copy";
import {
  buildExecutionTimeline,
  describeTimelineFocus,
  formatDuration,
  type SetupLabels,
} from "../../lib/execution-timeline";
import TimelineSetupRow from "./TimelineSetupRow";
import TimelineSpanBar from "./TimelineSpanBar";

type EventRow = {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  at: string;
};

const TERMINAL = new Set(["complete", "failed", "canceled", "budget_exceeded"]);
const LEGEND_STAGES = ["retrieval", "rerank", "generation", "judge"] as const;

function useLiveNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

export default function RunTimeline({
  runId,
  runStatus,
  setups,
  startedAt,
  finishedAt,
  selectedTrialId,
  onSelectTrial,
}: {
  runId: string | null;
  runStatus: string;
  setups: SetupLabels;
  startedAt?: string | null;
  finishedAt?: string | null;
  selectedTrialId?: string | null;
  onSelectTrial?: (trialId: string) => void;
}) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const cursorRef = useRef(0);
  const active = !TERMINAL.has(runStatus);
  const nowMs = useLiveNow(active);

  useEffect(() => {
    setEvents([]);
    cursorRef.current = 0;
  }, [runId]);

  useQuery({
    queryKey: ["run-events", runId],
    queryFn: async () => {
      if (!runId) return [];
      const rows = await api<EventRow[]>(`/api/runs/${runId}/events?after=${cursorRef.current}`);
      if (rows.length > 0) {
        cursorRef.current = Math.max(cursorRef.current, rows[rows.length - 1]!.id);
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => e.id));
          const fresh = rows.filter((row) => !seen.has(row.id));
          return fresh.length > 0 ? [...prev, ...fresh].slice(-500) : prev;
        });
      }
      return rows;
    },
    enabled: Boolean(runId),
    refetchInterval: active ? 2000 : false,
  });

  const timeline = useMemo(
    () =>
      buildExecutionTimeline({
        events,
        setups,
        nowMs,
        runStartedAt: startedAt,
        runFinishedAt: finishedAt,
        runStatus,
      }),
    [events, setups, nowMs, startedAt, finishedAt, runStatus]
  );

  const focusLine = useMemo(() => describeTimelineFocus(timeline), [timeline]);

  return (
    <Stack gap="md" className="execution-timeline pg-arena-card pg-arena-card--subtle">
      <Group justify="space-between" align="flex-start" gap="sm">
        <Stack gap={4}>
          <Text className="pg-section-title">{COPY.app.executionTimeline}</Text>
          <Text size="sm">{focusLine}</Text>
          <Text size="xs" c="dimmed">
            {COPY.app.executionTimelineHint}
          </Text>
        </Stack>
        <Text size="xs" ff="monospace" c="dimmed">
          {active ? `${COPY.app.executionTimelineLive} · ` : ""}
          {formatDuration(timeline.durationMs)}
        </Text>
      </Group>

      <Group gap="md" className="execution-timeline__legend" aria-label="Stage legend">
        {LEGEND_STAGES.map((stage) => (
          <span key={stage} className={`execution-legend execution-legend--${stage}`}>
            <span aria-hidden="true" />
            {stageLabel(stage)}
          </span>
        ))}
      </Group>

      <div className="execution-timeline__chart">
        <div className="execution-timeline__axis" aria-hidden="true">
          {[0, 25, 50, 75, 100].map((tick) => (
            <span
              key={tick}
              style={{
                left: `calc(var(--execution-label-w) + 0.8rem + (100% - var(--execution-label-w) - 0.8rem) * ${tick / 100})`,
              }}
            >
              {formatDuration((timeline.durationMs * tick) / 100)}
            </span>
          ))}
        </div>

        <div className="execution-row execution-row--summary">
          <div className="execution-row__label">
            <Text size="xs" fw={600}>
              {COPY.app.executionTimelineOverall}
            </Text>
            <Text size="xs" c="dimmed">
              all setups
            </Text>
          </div>
          <div
            className="execution-row__track"
            role="img"
            aria-label={`Overall progress: ${runStatus}`}
          >
            {[0, 25, 50, 75, 100].map((tick) => (
              <span
                key={tick}
                className="execution-row__gridline"
                style={{ left: `${tick}%` }}
                aria-hidden="true"
              />
            ))}
            {timeline.summarySpans.map((span) => (
              <TimelineSpanBar key={span.key} span={span} timeline={timeline} />
            ))}
          </div>
        </div>

        {timeline.rows.map((row) => (
          <TimelineSetupRow
            key={row.trialId}
            row={row}
            selected={row.trialId === selectedTrialId}
            interactive={Boolean(onSelectTrial)}
            onSelect={onSelectTrial}
            timeline={timeline}
          />
        ))}

        {timeline.rows.length === 0 && (
          <Text size="sm" c="dimmed" py="sm">
            {COPY.app.executionTimelineWaiting}
          </Text>
        )}
      </div>
    </Stack>
  );
}
