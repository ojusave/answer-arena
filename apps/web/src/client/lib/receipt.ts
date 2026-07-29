export function formatReceipt(r: {
  latencyMs?: number | null;
  costUsd?: number | null;
  costUnknown?: boolean;
  provider?: string;
}): string {
  const latency =
    r.latencyMs == null || Number.isNaN(Number(r.latencyMs))
      ? "—"
      : `${r.latencyMs}ms`;
  const cost =
    r.costUnknown || r.costUsd == null || Number.isNaN(Number(r.costUsd))
      ? "n/a"
      : `$${Number(r.costUsd).toFixed(4)}`;
  const provider = r.provider ? ` via ${r.provider}` : "";
  return `${latency}, ${cost}${provider}`;
}
