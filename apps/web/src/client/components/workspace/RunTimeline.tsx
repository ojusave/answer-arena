import { Badge, Group, Stack, Text } from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { COPY } from "../../lib/copy";
import {
  buildExecutionTimeline,
  formatDuration,
  spanPosition,
  type SetupLabels,
} from "../../lib/execution-timeline";

type EventRow = {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  at: string;
};

const TERMINAL = new Set(["complete", "failed", "canceled", "budget_exceeded"]);
function statusColor(status: string): string {
  if (status === "complete") return "green";
  if (status === "failed") return "red";
  if (status === "running") return "renderPurple";
  return "gray";
}

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
}: {
  runId: string | null;
  runStatus: string;
  setups: SetupLabels;
  startedAt?: string | null;
  finishedAt?: string | null;
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
        // Deduplicate by event id: overlapping polls can return the same rows,
        // but two setups finishing the same stage are distinct events.
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

  return (
    <Stack gap="md" className="execution-timeline pg-arena-card pg-arena-card--subtle">
      <Group justify="space-between" align="flex-start" gap="sm">
        <Stack gap={2}>
          <Text className="pg-section-title">{COPY.app.executionTimeline}</Text>
          <Text size="xs" c="dimmed">
            {COPY.app.executionTimelineHint}
          </Text>
        </Stack>
        <Text size="xs" ff="monospace" c="dimmed">
          {active ? "LIVE · " : ""}
          {formatDuration(timeline.durationMs)}
        </Text>
      </Group>

      <Group gap="md" className="execution-timeline__legend" aria-label="Stage legend">
        {["retrieval", "rerank", "generation", "judge"].map((stage) => (
          <span key={stage} className={`execution-legend execution-legend--${stage}`}>
            <span aria-hidden="true" />
            {stage === "retrieval" ? "Retrieve" : stage[0]!.toUpperCase() + stage.slice(1)}
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
              Comparison
            </Text>
            <Text size="xs" c="dimmed" ff="monospace">
              workflow
            </Text>
          </div>
          <div
            className="execution-row__track"
            role="img"
            aria-label={`Comparison workflow: ${runStatus}`}
          >
            {[0, 25, 50, 75, 100].map((tick) => (
              <span
                key={tick}
                className="execution-row__gridline"
                style={{ left: `${tick}%` }}
                aria-hidden="true"
              />
            ))}
            {timeline.summarySpans.map((span) => {
              const position = spanPosition(span, timeline);
              const title = `${span.label} · ${formatDuration(span.latencyMs)} · ${span.status}`;
              return (
                <span
                  key={span.key}
                  className={`execution-span execution-span--${span.stage} execution-span--${span.status}`}
                  style={{ left: `${position.left}%`, width: `${position.width}%` }}
                  title={title}
                  aria-label={title}
                >
                  {position.width >= 12 ? span.label : ""}
                </span>
              );
            })}
          </div>
        </div>

        {timeline.rows.map((row) => (
          <div className="execution-row" key={row.trialId}>
            <div className="execution-row__label">
              <Text size="xs" fw={600} lineClamp={1} title={row.label}>
                {row.label}
              </Text>
              <Group gap={5} wrap="nowrap">
                <Badge color={statusColor(row.status)} variant="light" size="xs">
                  {row.status}
                </Badge>
                {row.retries > 0 && (
                  <Text size="xs" c="orange" ff="monospace">
                    retry {row.retries}
                  </Text>
                )}
              </Group>
            </div>

            <div
              className="execution-row__track"
              role="img"
              aria-label={`${row.label}: ${row.status}, attempt ${row.attempt}`}
            >
              {[0, 25, 50, 75, 100].map((tick) => (
                <span
                  key={tick}
                  className="execution-row__gridline"
                  style={{ left: `${tick}%` }}
                  aria-hidden="true"
                />
              ))}
              {row.spans.map((span) => {
                const position = spanPosition(span, timeline);
                const title = `${span.label} · attempt ${span.attempt} · ${formatDuration(span.latencyMs)} · ${span.status}`;
                return (
                  <span
                    key={span.key}
                    className={`execution-span execution-span--${span.stage} execution-span--${span.status}`}
                    style={{ left: `${position.left}%`, width: `${position.width}%` }}
                    title={title}
                    aria-label={title}
                  >
                    {position.width >= 12 ? span.label : ""}
                  </span>
                );
              })}
            </div>
          </div>
        ))}

        {timeline.rows.length === 0 && (
          <Text size="sm" c="dimmed" py="sm">
            Waiting for setup tasks…
          </Text>
        )}
      </div>
    </Stack>
  );
}
