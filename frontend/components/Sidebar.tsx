"use client";

import { Logo } from "./Logo";
import {
  IconOverview,
  IconSuppliers,
  IconPlay,
  IconEvents,
  IconKey,
  IconSettings,
  IconDocs,
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown,
  IconClose,
} from "./icons";

export type View =
  | "overview"
  | "suppliers"
  | "playground"
  | "events"
  | "apikeys"
  | "settings"
  | "docs";

type Item = { id: View; label: string; icon: React.ComponentType<{ size?: number }> };

const GROUPS: { label?: string; items: Item[] }[] = [
  { items: [{ id: "overview", label: "Overview", icon: IconOverview }] },
  {
    label: "Marketplace",
    items: [
      { id: "playground", label: "Playground", icon: IconPlay },
      { id: "suppliers", label: "Endpoints", icon: IconSuppliers },
      { id: "events", label: "Event log", icon: IconEvents },
    ],
  },
  {
    label: "Configuration",
    items: [
      { id: "apikeys", label: "API keys", icon: IconKey },
      { id: "settings", label: "Settings", icon: IconSettings },
    ],
  },
  {
    label: "Support",
    items: [{ id: "docs", label: "Documentation", icon: IconDocs }],
  },
];

export function Sidebar({
  view,
  onSelect,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: {
  view: View;
  onSelect: (v: View) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  return (
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`} aria-label="Primary navigation">
      {/* Brand */}
      <div className="sidebar-brand flex h-[52px] items-center justify-between border-b border-line px-4">
        {!collapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <Logo size={18} />
            <span className="whitespace-nowrap text-[13px] font-semibold tracking-[0.14em] text-ink">
              MARKETPLACE
            </span>
          </div>
        )}
        <button
          className="btn-icon desktop-collapse"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
        </button>
        <button className="btn-icon mobile-close" onClick={onCloseMobile} aria-label="Close navigation">
          <IconClose size={16} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {GROUPS.map((g, gi) => (
          <div key={gi} className="mb-1">
            {g.label && !collapsed && <div className="nav-group-label">{g.label}</div>}
            {g.label && collapsed && <div className="mx-3 my-2 h-px bg-line" />}
            {g.items.map((it) => {
              const Icon = it.icon;
              return (
                <button
                  key={it.id}
                  className={`nav-item w-[calc(100%-16px)] ${view === it.id ? "active" : ""}`}
                  onClick={() => onSelect(it.id)}
                  title={collapsed ? it.label : undefined}
                  aria-current={view === it.id ? "page" : undefined}
                >
                  <Icon size={16} />
                  <span className="nav-label">{it.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Local POC identity */}
      <div className="border-t border-line p-2">
        <div className="nav-item w-[calc(100%-16px)] cursor-default" title="Local operator">
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-panel-3 text-[11px] font-semibold text-ink">
            L
          </span>
          {!collapsed && (
            <>
              <span className="nav-label flex-1 truncate text-left">Local operator</span>
              <IconChevronDown size={14} className="text-dim" />
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
