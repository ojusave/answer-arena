import { Tooltip } from "@mantine/core";
import {
  formatDuration,
  spanPosition,
  type TimelineSpan,
} from "../../lib/execution-timeline";

/** Colored stage bar with a beginner-friendly tooltip. */
export default function TimelineSpanBar({
  span,
  timeline,
}: {
  span: TimelineSpan;
  timeline: { startMs: number; durationMs: number };
}) {
  const position = spanPosition(span, timeline);
  const title = `${span.label} · ${formatDuration(span.latencyMs)} · ${span.status}${
    span.attempt > 1 ? ` · attempt ${span.attempt}` : ""
  }`;
  const showLabel = position.width >= 8;
  return (
    <Tooltip label={title} withArrow position="top" openDelay={200}>
      <span
        className={`execution-span execution-span--${span.stage} execution-span--${span.status}`}
        style={{ left: `${position.left}%`, width: `${position.width}%` }}
        aria-label={title}
      >
        {showLabel ? span.label : span.label.slice(0, 1)}
      </span>
    </Tooltip>
  );
}
