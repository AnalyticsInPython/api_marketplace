import type { DashboardEvent } from "@/lib/types";
import { clockTime } from "@/lib/format";
import { DOT, detailOf } from "./EventFeed";

export function EventLogTable({ events }: { events: DashboardEvent[] }) {
  return (
    <div className="panel overflow-hidden">
      <div className="scroll-thin max-h-[620px] overflow-auto">
        <table className="dtable min-w-[720px]">
          <thead className="sticky top-0 z-10 bg-panel">
            <tr>
              <th style={{ width: 96 }}>Time</th>
              <th>Event</th>
              <th>Request</th>
              <th>Supplier</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: "center", padding: "34px" }}>
                  No events yet this session.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="fade-up">
                  <td className="muted font-mono tnum text-[12px]">{clockTime(e.timestamp)}</td>
                  <td>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-[6px] w-[6px] rounded-full" style={{ background: DOT[e.event] }} />
                      <span className="font-mono text-[12px] text-ink">{e.event}</span>
                    </span>
                  </td>
                  <td className="muted font-mono text-[12px]">{e.requestId ?? "—"}</td>
                  <td className="muted">{e.supplierName ?? "—"}</td>
                  <td className="muted">{detailOf(e)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
