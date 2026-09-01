import type { DashboardMetrics } from "@/lib/types";

function StatTile({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
}) {
  return (
    <div className="panel px-4 py-3.5">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="tnum text-[26px] font-semibold leading-none text-ink">{value}</span>
        {unit ? <span className="text-[12px] text-dim">{unit}</span> : null}
      </div>
      {sub ? <div className="mt-1.5 text-[11.5px] text-muted">{sub}</div> : null}
    </div>
  );
}

export function MetricsRow({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="Nodes online"
        value={String(metrics.onlineCount)}
        sub={`${metrics.busyCount} busy · ${metrics.totalNodes} total`}
      />
      <StatTile
        label="Network load"
        value={String(metrics.busyCount)}
        unit={`/ ${metrics.totalNodes || 0}`}
        sub="active requests"
      />
      <StatTile
        label="Requests"
        value={String(metrics.requestsThisSession)}
        sub="this session"
      />
      <StatTile
        label="Avg latency"
        value={metrics.avgLatencyMs != null ? (metrics.avgLatencyMs / 1000).toFixed(1) : "-"}
        unit={metrics.avgLatencyMs != null ? "s" : undefined}
        sub="received to completed"
      />
    </div>
  );
}
