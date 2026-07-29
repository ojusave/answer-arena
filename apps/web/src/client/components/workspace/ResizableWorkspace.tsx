import type { ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { COPY } from "../../lib/copy";

export type WorkspacePhase = "configure" | "running" | "results";

function ZoneLabel({
  dotClass,
  label,
}: {
  dotClass: string;
  label: string;
}) {
  return (
    <div className="pg-zone-label">
      <span className={`pg-zone-dot ${dotClass}`} aria-hidden="true" />
      {label}
    </div>
  );
}

/**
 * Phase-based workspace shell.
 * Configure is single-pane; Running is full-width progress;
 * Results pairs the decision view with optional Inspect.
 */
export default function ResizableWorkspace({
  phase,
  controls,
  canvas,
  inspector,
  showInspector,
}: {
  phase: WorkspacePhase;
  controls: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
  showInspector: boolean;
}) {
  if (phase === "configure") {
    return (
      <div className="workspace-phase workspace-phase--configure">
        <aside className="workspace-pane workspace-pane--controls workspace-pane--solo">
          <ZoneLabel dotClass="" label={COPY.app.phaseConfigure} />
          <div className="pane-scroll">{controls}</div>
        </aside>
      </div>
    );
  }

  if (phase === "running" || !showInspector) {
    return (
      <div
        className={`workspace-phase workspace-phase--${phase === "running" ? "running" : "results"}`}
      >
        <main className="workspace-pane workspace-pane--canvas workspace-pane--solo">
          <ZoneLabel
            dotClass="pg-zone-dot--arena"
            label={phase === "running" ? COPY.app.phaseRunning : COPY.app.phaseResults}
          />
          <div className="pane-scroll">{canvas}</div>
        </main>
      </div>
    );
  }

  return (
    <Group
      orientation="horizontal"
      className="workspace-resizable workspace-phase workspace-phase--results"
      style={{ height: "100%" }}
    >
      <Panel id="canvas" defaultSize="62%" minSize={420}>
        <main className="workspace-pane workspace-pane--canvas">
          <ZoneLabel dotClass="pg-zone-dot--arena" label={COPY.app.phaseResults} />
          <div className="pane-scroll">{canvas}</div>
        </main>
      </Panel>

      <Separator className="resize-handle" aria-label={COPY.app.resizeAria}>
        <span />
      </Separator>

      <Panel
        id="inspector"
        defaultSize="38%"
        minSize={280}
        maxSize={560}
        groupResizeBehavior="preserve-pixel-size"
      >
        <aside className="workspace-pane workspace-pane--inspector">
          <ZoneLabel dotClass="pg-zone-dot--peek" label={COPY.app.zones.detail} />
          <div className="pane-scroll">{inspector}</div>
        </aside>
      </Panel>
    </Group>
  );
}
