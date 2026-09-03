"use client";

import { useState } from "react";

import type { ActiveRequest, BurstResult, DashboardEvent } from "@/lib/types";
import { RequestSimulator } from "@/components/RequestSimulator";
import { FlowDiagram } from "@/components/FlowDiagram";
import { EventFeed } from "@/components/EventFeed";
import { UserSetupGuide } from "@/components/UserSetupGuide";
import { PrivatePromptHistory } from "@/components/PrivatePromptHistory";

export function PlaygroundView({
  request,
  busy,
  events,
  onlineSupplierCount,
  onSubmit,
  onTrafficBurst,
}: {
  request: ActiveRequest;
  busy: boolean;
  events: DashboardEvent[];
  onlineSupplierCount: number;
  onSubmit: (p: string) => void;
  onTrafficBurst: (count: number) => Promise<BurstResult[]>;
}) {
  const [burstRunning, setBurstRunning] = useState(false);
  const [burstResults, setBurstResults] = useState<BurstResult[]>([]);

  const launchBurst = async () => {
    const count = Math.min(8, Math.max(4, onlineSupplierCount * 2));
    setBurstRunning(true);
    setBurstResults([]);
    try {
      setBurstResults(await onTrafficBurst(count));
    } finally {
      setBurstRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[19px] font-semibold text-ink">Playground</h1>
        <p className="mt-1 text-[13px] text-muted">
          Send a prompt through the live routing service and watch it travel the marketplace.
        </p>
      </div>

      <UserSetupGuide onlineSupplierCount={onlineSupplierCount} />

      <section className="panel px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="eyebrow">Live demo</div>
            <h2 className="mt-1.5 text-[15px] font-semibold text-ink">Traffic burst</h2>
            <p className="mt-1 text-[12.5px] text-muted">
              Send several real prompts in waves and watch them spread across the available Macs.
            </p>
          </div>
          <button
            className="btn btn-primary"
            disabled={burstRunning || onlineSupplierCount === 0}
            onClick={launchBurst}
          >
            {burstRunning ? "Burst running…" : "Launch traffic burst"}
          </button>
        </div>
        {burstResults.length > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {burstResults.map((result, index) => (
              <div className="rounded-md border border-border px-3 py-2" key={`${result.clientLabel}-${index}`}>
                <div className={`text-[11px] font-semibold uppercase ${result.status === "completed" ? "text-online" : "text-danger"}`}>
                  {result.status}
                </div>
                <div className="mt-1 truncate text-[12.5px] font-medium text-ink">
                  {result.supplierName ?? result.error ?? "Unassigned"}
                </div>
                <div className="mt-0.5 tnum text-[11.5px] text-muted">{result.latencyMs.toLocaleString()} ms</div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* Full-width prompt bar */}
      <div id="prompt-submission" className="scroll-mt-24">
        <RequestSimulator request={request} busy={busy} onSubmit={onSubmit} />
      </div>

      <PrivatePromptHistory request={request} />

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
