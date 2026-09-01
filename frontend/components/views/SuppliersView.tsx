"use client";

import { useMemo, useState } from "react";
import type { Supplier, SupplierStatus } from "@/lib/types";
import { SuppliersTable } from "@/components/SuppliersTable";
import { IconSearch } from "@/components/icons";

type Filter = "all" | SupplierStatus;

export function SuppliersView({
  suppliers,
  activeSupplierId,
}: {
  suppliers: Supplier[];
  activeSupplierId?: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (filter !== "all" && s.status !== filter) return false;
      if (q && !(s.name.toLowerCase().includes(q) || s.model.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [suppliers, query, filter]);

  const opts: { label: string; value: Filter }[] = [
    { label: "All", value: "all" },
    { label: "Online", value: "online" },
    { label: "Busy", value: "busy" },
    { label: "Offline", value: "offline" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[19px] font-semibold text-ink">Supplier nodes</h1>
        <p className="mt-1 text-[13px] text-muted">
          Every Mac that connected a supplier agent to the central server. Status and load are live;
          the registry persists across restarts.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div className="input min-w-[190px] flex-1 sm:max-w-[280px]">
            <IconSearch size={15} />
            <input aria-label="Search supplier nodes" placeholder="Search by node or model…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="seg scroll-thin max-w-full overflow-x-auto" role="group" aria-label="Filter suppliers by status">
            {opts.map((o) => (
              <button key={o.value} className={`seg-btn ${filter === o.value ? "active" : ""}`} onClick={() => setFilter(o.value)} aria-pressed={filter === o.value}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <span className="text-[12px] text-muted">
          {filtered.length} of {suppliers.length}
        </span>
      </div>

      <SuppliersTable suppliers={filtered} activeSupplierId={activeSupplierId} />
    </div>
  );
}
