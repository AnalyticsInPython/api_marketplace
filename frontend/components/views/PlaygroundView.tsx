"use client";

import type { ActiveRequest, ConnectionMode, DashboardEvent } from "@/lib/types";
import { RequestSimulator } from "@/components/RequestSimulator";
import { FlowDiagram } from "@/components/FlowDiagram";
import { EventFeed } from "@/components/EventFeed";

export function PlaygroundView({
  request,
  busy,
  mode,
  events,
  onSubmit,
}: {
  request: ActiveRequest;
  busy: boolean;
  mode: ConnectionMode;
  events: DashboardEvent[];
  onSubmit: (p: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[19px] font-semibold text-ink">Playground</h1>
        <p className="mt-1 text-[13px] text-muted">
          Send a prompt through the live routing service and watch it travel the marketplace.
        </p>
      </div>

      {/* Full-width prompt bar */}
      <RequestSimulator request={request} busy={busy} mode={mode} onSubmit={onSubmit} />

      {/* Full-width routing */}
      <FlowDiagram request={request} />

      {/* Recent events for this run */}
      <section className="panel px-6 py-5">
        <div className="mb-2 flex items-center justify-between">
          <div className="eyebrow">Live events</div>
          <span className="text-[11.5px] text-dim">most recent</span>
        </div>
        <EventFeed events={events} max={8} className="max-h-56" />
      </section>
    </div>
  );
}
