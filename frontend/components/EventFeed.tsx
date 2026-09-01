import type { DashboardEvent, DashboardEventType } from "@/lib/types";
import { clockTime } from "@/lib/format";

export const DOT: Record<DashboardEventType, string> = {
  "supplier.online": "var(--online)",
  "supplier.busy": "var(--busy)",
  "supplier.offline": "var(--offline)",
  "endpoint.online": "var(--online)",
  "endpoint.busy": "var(--busy)",
  "endpoint.offline": "var(--offline)",
  "request.received": "var(--text-muted)",
  "request.assigned": "var(--busy)",
  "request.processing": "var(--busy)",
  "request.completed": "var(--online)",
  "request.failed": "var(--error)",
};

export function detailOf(e: DashboardEvent): string {
  const who = e.supplierName ?? e.supplierId ?? "";
  switch (e.event) {
    case "request.received":
      return e.clientLabel ? `from ${e.clientLabel}` : "";
    case "request.assigned":
      return who ? `→ ${who}` : "";
    case "request.processing":
      return who ? `on ${who}` : "";
    case "request.completed":
      return who ? `from ${who}` : "done";
    case "request.failed":
      return e.message ?? "request failed";
    default:
      return e.message ?? who;
  }
}

export function EventFeed({
  events,
  max = 40,
  className = "",
}: {
  events: DashboardEvent[];
  max?: number;
  className?: string;
}) {
  const rows = events.slice(0, max);
  return (
    <div className={`scroll-thin overflow-y-auto ${className}`}>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted">Waiting for events…</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((e) => (
            <li
              key={e.id}
              className="fade-up flex items-baseline gap-3 border-b border-line/60 py-2 last:border-0"
            >
              <span className="tnum shrink-0 font-mono text-[11px] text-dim">
                {clockTime(e.timestamp)}
              </span>
              <span className="mt-[5px] h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: DOT[e.event] }} />
              <span className="min-w-0 flex-1">
                <span className="font-mono text-[11.5px] text-muted">{e.event}</span>{" "}
                <span className="text-[12px] text-dim">{detailOf(e)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
