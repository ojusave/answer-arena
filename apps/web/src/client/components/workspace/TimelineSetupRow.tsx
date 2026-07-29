import { Badge, Group, Text } from "@mantine/core";
import type { TimelineRow } from "../../lib/execution-timeline";
import TimelineSpanBar from "./TimelineSpanBar";

function statusColor(status: string): string {
  if (status === "complete") return "green";
  if (status === "failed") return "red";
  if (status === "running") return "renderPurple";
  return "gray";
}

/** One setup row in the live timeline; click selects the matching answer. */
export default function TimelineSetupRow({
  row,
  selected,
  interactive,
  onSelect,
  timeline,
}: {
  row: TimelineRow;
  selected: boolean;
  interactive: boolean;
  onSelect?: (trialId: string) => void;
  timeline: { startMs: number; durationMs: number };
}) {
  const rowClass = [
    "execution-row",
    selected ? "execution-row--selected" : "",
    interactive ? "execution-row--interactive" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rowClass}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      onClick={() => onSelect?.(row.trialId)}
      onKeyDown={(event) => {
        if (!interactive) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.(row.trialId);
        }
      }}
    >
      <div className="execution-row__label">
        <Text size="xs" fw={600} lineClamp={1} title={row.label}>
          {row.label}
        </Text>
        {row.detail && (
          <Text size="xs" c="dimmed" lineClamp={1} title={row.detail}>
            {row.detail}
          </Text>
        )}
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
        {row.spans.map((span) => (
          <TimelineSpanBar key={span.key} span={span} timeline={timeline} />
        ))}
      </div>
    </div>
  );
}
