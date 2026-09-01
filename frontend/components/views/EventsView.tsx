"use client";

import { useMemo, useState } from "react";
import type { DashboardEvent } from "@/lib/types";
import { EventLogTable } from "@/components/EventLogTable";
import { IconSearch } from "@/components/icons";

type Filter = "all" | "supplier" | "request";

export function EventsView({ events }: { events: DashboardEvent[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (filter === "supplier" && !e.event.startsWith("supplier.")) return false;
      if (filter === "request" && !e.event.startsWith("request.")) return false;
      if (q) {
        const hay = `${e.event} ${e.supplierName ?? ""} ${e.clientLabel ?? ""} ${e.requestId ?? ""} ${e.message ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, query, filter]);

  const opts: { label: string; value: Filter }[] = [
    { label: "All", value: "all" },
    { label: "Suppliers", value: "supplier" },
    { label: "Requests", value: "request" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[19px] font-semibold text-ink">Event log</h1>
        <p className="mt-1 text-[13px] text-muted">
          Session-only telemetry broadcast over the dashboard WebSocket. Cleared when the central server restarts.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div className="input min-w-[190px] flex-1 sm:max-w-[280px]">
            <IconSearch size={15} />
            <input aria-label="Search event log" placeholder="Filter events…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="seg" role="group" aria-label="Filter event type">
            {opts.map((o) => (
              <button key={o.value} className={`seg-btn ${filter === o.value ? "active" : ""}`} onClick={() => setFilter(o.value)} aria-pressed={filter === o.value}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <span className="text-[12px] text-muted">{filtered.length} events</span>
      </div>

      <EventLogTable events={filtered} />
    </div>
  );
}
