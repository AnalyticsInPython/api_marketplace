"use client";

import { config } from "@/lib/config";
import type { ConnectionMode } from "@/lib/types";

function Row({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line px-5 py-3.5 first:border-t-0">
      <div>
        <div className="text-[13px] text-ink">{label}</div>
        {note ? <div className="mt-0.5 text-[11.5px] text-dim">{note}</div> : null}
      </div>
      <div className="text-right">{value}</div>
    </div>
  );
}

export function SettingsView({ mode }: { mode: ConnectionMode }) {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-[19px] font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-[13px] text-muted">
          Read-only view of the console configuration. Everything here is driven by environment variables
          (see <span className="font-mono text-[12px] text-muted">.env.local</span>).
        </p>
      </div>

      <div className="panel overflow-hidden">
        <Row
          label="Connection"
          note="How the console is sourcing data right now"
          value={
            mode === "live" ? (
              <span className="badge badge-online"><span className="dot pulse" />Live</span>
            ) : mode === "mock" ? (
              <span className="badge badge-busy"><span className="dot" />Demo · mock</span>
            ) : (
              <span className="badge badge-offline"><span className="dot pulse" />Connecting</span>
            )
          }
        />
        <Row label="Central server" value={<code className="font-mono text-[12px] text-muted">{config.apiBaseUrl}</code>} note="NEXT_PUBLIC_API_BASE_URL" />
        <Row label="Events WebSocket" value={<code className="font-mono text-[12px] text-muted">{config.wsUrl}</code>} note="NEXT_PUBLIC_WS_URL" />
        <Row label="Force mock data" value={<span className="text-[13px] text-muted">{config.forceMock ? "on" : "off"}</span>} note="NEXT_PUBLIC_USE_MOCK" />
        <Row label="Request timeout" value={<span className="tnum text-[13px] text-muted">120 s</span>} note="CPU inference can be slow (spec §9.5)" />
        <Row label="Live connect timeout" value={<span className="tnum text-[13px] text-muted">{(config.liveConnectTimeoutMs / 1000).toFixed(1)} s</span>} note="Before falling back to mock" />
      </div>
    </div>
  );
}
