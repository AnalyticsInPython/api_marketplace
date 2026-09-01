"use client";

import { useEffect, useState } from "react";
import { useDashboard } from "@/lib/useDashboard";
import { Sidebar, type View } from "@/components/Sidebar";
import { Banner } from "@/components/Banner";
import { Topbar } from "@/components/Topbar";
import { OverviewView } from "@/components/views/OverviewView";
import { SuppliersView } from "@/components/views/SuppliersView";
import { PlaygroundView } from "@/components/views/PlaygroundView";
import { EventsView } from "@/components/views/EventsView";
import { ApiKeysView } from "@/components/views/ApiKeysView";
import { SettingsView } from "@/components/views/SettingsView";
import { DocsView } from "@/components/views/DocsView";

export default function Console() {
  const dash = useDashboard();
  const [view, setView] = useState<View>("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  const activeSupplierId =
    dash.request.status === "assigned" || dash.request.status === "processing"
      ? dash.request.supplierId
      : undefined;

  return (
    <div className={`app ${collapsed ? "collapsed" : ""}`}>
      <Sidebar
        view={view}
        onSelect={(nextView) => {
          setView(nextView);
          setMobileNavOpen(false);
        }}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {mobileNavOpen ? (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <div className="flex min-w-0 flex-col">
        <Banner />
        <div className="sticky top-0 z-20 bg-bg">
          <Topbar
            view={view}
            mode={dash.mode}
            onOpenNav={() => setMobileNavOpen(true)}
            onNewRequest={() => setView("playground")}
          />
        </div>

        <main className="px-3 py-4 sm:px-6 sm:py-6">
          <div className="mx-auto max-w-[1500px]">
            {view === "overview" && (
              <OverviewView
                series={dash.series}
                completions={dash.completions}
                metrics={dash.metrics}
                mode={dash.mode}
                suppliers={dash.suppliers}
                activeSupplierId={activeSupplierId}
              />
            )}
            {view === "suppliers" && (
              <SuppliersView
                suppliers={dash.suppliers}
                activeSupplierId={activeSupplierId}
                onRegister={dash.registerEndpoint}
              />
            )}
            {view === "playground" && (
              <PlaygroundView
                request={dash.request}
                busy={dash.busy}
                mode={dash.mode}
                events={dash.events}
                onSubmit={dash.submitPrompt}
              />
            )}
            {view === "events" && <EventsView events={dash.events} />}
            {view === "apikeys" && <ApiKeysView />}
            {view === "settings" && <SettingsView mode={dash.mode} />}
            {view === "docs" && <DocsView />}
          </div>
        </main>
      </div>
    </div>
  );
}
