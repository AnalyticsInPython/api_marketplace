"use client";

import { useMemo, useState } from "react";
import type { Completion, DashboardMetrics, LoadSample, Supplier } from "@/lib/types";
import { MetricsRow } from "@/components/MetricsRow";
import { ActivityChart } from "@/components/ActivityChart";
import { SuppliersTable } from "@/components/SuppliersTable";
import { IconSearch } from "@/components/icons";
import { SupplierLeaderboard } from "@/components/SupplierLeaderboard";

type Show = "active" | "latency" | "both";
const WINDOWS = [
  { label: "5m", sec: 300 },
  { label: "15m", sec: 900 },
  { label: "1h", sec: 3600 },
];

function Seg<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button
          key={String(o.value)}
          className={`seg-btn ${value === o.value ? "active" : ""}`}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function OverviewView({
  series,
  completions,
  metrics,
  suppliers,
  activeSupplierId,
}: {
  series: LoadSample[];
  completions: Completion[];
  metrics: DashboardMetrics;
  suppliers: Supplier[];
  activeSupplierId?: string;
}) {
  const [show, setShow] = useState<Show>("both");
  const [windowSec, setWindowSec] = useState(900);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => s.name.toLowerCase().includes(q) || s.model.toLowerCase().includes(q));
  }, [suppliers, query]);

  return (
    <div className="flex flex-col gap-4">
      <MetricsRow metrics={metrics} />

      <SupplierLeaderboard suppliers={suppliers} />

      {/* Activity chart */}
      <section className="panel px-5 pb-4 pt-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="eyebrow">Telemetry</div>
            <h2 className="mt-1.5 text-[15px] font-semibold text-ink">Network activity</h2>
          </div>
          <div className="flex items-center gap-2">
            <Seg
              value={show}
              onChange={setShow}
              options={[
                { label: "Active", value: "active" },
                { label: "Latency", value: "latency" },
                { label: "Both", value: "both" },
              ]}
            />
            <Seg value={windowSec} onChange={setWindowSec} options={WINDOWS.map((w) => ({ label: w.label, value: w.sec }))} />
          </div>
        </div>

        <ActivityChart series={series} completions={completions} totalNodes={metrics.totalNodes} windowSec={windowSec} show={show} />

        <div className="mt-2 flex items-center gap-5 px-1 text-[11.5px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-4" style={{ background: "var(--accent)" }} /> Active requests
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: "var(--accent-2)" }} /> Request latency
          </span>
        </div>
      </section>

      {/* Ollama endpoints table */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="input w-[260px] max-w-full">
            <IconSearch size={15} />
            <input aria-label="Search endpoints" placeholder="Search endpoints…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <span className="text-[12px] text-muted">
            {filtered.length} node{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
        <SuppliersTable suppliers={filtered} activeSupplierId={activeSupplierId} />
      </section>
    </div>
  );
}
