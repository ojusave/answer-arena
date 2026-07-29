import { Collapse, Stack, Text, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { COPY } from "../../lib/copy";
import { eventTone, formatActivityLine, type SetupLabels } from "../../lib/format-event";

type EventRow = {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  at: string;
};

const TERMINAL = new Set(["complete", "failed", "canceled", "budget_exceeded"]);
const VISIBLE_LINES = 20;

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function RunTimeline({
  runId,
  runStatus,
  setups,
}: {
  runId: string | null;
  runStatus: string;
  setups: SetupLabels;
}) {
  const [open, { toggle }] = useDisclosure(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const cursorRef = useRef(0);

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
    refetchInterval: TERMINAL.has(runStatus) ? false : 2000,
  });

  const lines = useMemo(
    () =>
      [...events]
        .reverse()
        .slice(0, VISIBLE_LINES)
        .map((e) => ({
          id: e.id,
          time: formatTime(e.at),
          text: formatActivityLine(e, setups),
          tone: eventTone(e),
        })),
    [events, setups]
  );

  return (
    <Stack gap="sm" className="run-timeline pg-arena-card pg-arena-card--subtle">
      <UnstyledButton className="arena-feed-toggle" onClick={toggle} aria-expanded={open}>
        <Text className="pg-section-title">{COPY.app.eventLog}</Text>
        <Text size="xs" c="dimmed">
          {open ? "Hide" : "Show"} ({COPY.events.count(lines.length, events.length)})
        </Text>
      </UnstyledButton>

      <Collapse in={open}>
        {!runId ? (
          <Text size="sm" c="dimmed">
            No run yet.
          </Text>
        ) : lines.length === 0 ? (
          <Text size="sm" c="dimmed">
            Waiting for updates…
          </Text>
        ) : (
          <Stack gap={6}>
            <Text size="xs" c="dimmed">
              {COPY.app.eventLogHint}
            </Text>
            <Stack gap={6} className="arena-feed">
              {lines.map((line) => (
                <div key={line.id} className={`arena-feed-row arena-feed-row--${line.tone}`}>
                  <span className="arena-feed-dot" aria-hidden="true" />
                  <Stack gap={2} className="arena-feed-copy">
                    <Text size="sm" fw={500} lh={1.35}>
                      {line.text}
                    </Text>
                    <Text size="xs" c="dimmed" ff="monospace">
                      {line.time}
                    </Text>
                  </Stack>
                </div>
              ))}
            </Stack>
          </Stack>
        )}
      </Collapse>
    </Stack>
  );
}
