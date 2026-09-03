import type { Supplier } from "@/lib/types";
import { compactCount } from "@/lib/format";

export function SupplierLeaderboard({ suppliers }: { suppliers: Supplier[] }) {
  const ranked = [...suppliers]
    .sort((a, b) =>
      b.completedRequests - a.completedRequests ||
      b.tokensUsed - a.tokensUsed ||
      a.name.localeCompare(b.name),
    )
    .slice(0, 5);

  return (
    <section className="panel px-5 py-5">
      <div className="eyebrow">Session contribution</div>
      <div className="mt-1.5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Supplier leaderboard</h2>
          <p className="mt-1 text-[12px] text-muted">Real work completed since the router started.</p>
        </div>
        <span className="text-[11px] text-dim">live session</span>
      </div>

      <div className="mt-4 grid gap-2">
        {ranked.length === 0 ? (
          <div className="rounded-md border border-border px-4 py-5 text-center text-[12.5px] text-muted">
            Register a supplier to begin ranking contributions.
          </div>
        ) : ranked.map((supplier, index) => (
          <div className="grid grid-cols-[32px_minmax(0,1fr)_auto_auto_auto] items-center gap-3 rounded-md border border-border px-3 py-2.5" key={supplier.id}>
            <span className={`tnum text-[13px] font-semibold ${index === 0 && supplier.completedRequests > 0 ? "text-accent" : "text-muted"}`}>
              #{index + 1}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-medium text-ink">
                {supplier.name}{index === 0 && supplier.completedRequests > 0 ? " · Top contributor" : ""}
              </div>
              <div className="truncate text-[11px] text-dim">{supplier.model}</div>
            </div>
            <div className="text-right">
              <div className="tnum text-[12.5px] font-semibold text-ink">{supplier.completedRequests}</div>
              <div className="text-[10.5px] text-dim">jobs</div>
            </div>
            <div className="text-right">
              <div className="tnum text-[12.5px] font-semibold text-ink">{compactCount(supplier.tokensUsed)}</div>
              <div className="text-[10.5px] text-dim">tokens</div>
            </div>
            <div className="w-16 text-right">
              <div className="tnum text-[12.5px] font-semibold text-ink">
                {supplier.avgResponseMs == null ? "—" : `${supplier.avgResponseMs.toLocaleString()} ms`}
              </div>
              <div className="text-[10.5px] text-dim">average</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
