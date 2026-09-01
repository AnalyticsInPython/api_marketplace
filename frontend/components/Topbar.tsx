"use client";

import type { ConnectionMode } from "@/lib/types";
import type { View } from "./Sidebar";
import { IconFolder, IconChevronDown, IconMenu, IconPlus } from "./icons";

const TITLES: Record<View, string> = {
  overview: "Overview",
  suppliers: "Suppliers",
  playground: "Playground",
  events: "Event log",
  apikeys: "API keys",
  settings: "Settings",
  docs: "Documentation",
};

function ConnectionPill({ mode }: { mode: ConnectionMode }) {
  if (mode === "live")
    return (
      <span className="badge badge-online">
        <span className="dot pulse" />
        Live
      </span>
    );
  if (mode === "mock")
    return (
      <span
        className="badge badge-busy"
        title="No central server reachable — showing simulated data"
      >
        <span className="dot" />
        <span className="connection-copy-full">Demo · mock data</span>
        <span className="connection-copy-short">Demo</span>
      </span>
    );
  return (
    <span className="badge badge-offline">
      <span className="dot pulse" />
      Connecting…
    </span>
  );
}

export function Topbar({
  view,
  mode,
  onOpenNav,
  onNewRequest,
}: {
  view: View;
  mode: ConnectionMode;
  onOpenNav: () => void;
  onNewRequest: () => void;
}) {
  return (
    <div className="topbar">
      <div className="flex min-w-0 items-center gap-2">
        <button className="btn-icon mobile-menu-button" onClick={onOpenNav} aria-label="Open navigation">
          <IconMenu size={17} />
        </button>
        <div className="crumb min-w-0">
        <span className="text-ink">{TITLES[view]}</span>
        <span className="sep">/</span>
        <span className="chip">
          <IconFolder size={13} />
          local-network
          <IconChevronDown size={13} />
        </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <ConnectionPill mode={mode} />
        <button className="btn btn-primary" onClick={onNewRequest} aria-label="New request">
          <IconPlus size={15} />
          <span className="new-request-label">New request</span>
        </button>
      </div>
    </div>
  );
}
