import type { ActiveRequest, FlowStage } from "@/lib/types";

/* Icons ------------------------------------------------------------------- */
function IconClient() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 21h10M9 17v4M15 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7.5 9l2 2-2 2M12 13h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconServer() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="4" width="17" height="6.5" rx="1.6" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3.5" y="13.5" width="17" height="6.5" rx="1.6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="7.2" r="1" fill="currentColor" />
      <circle cx="7" cy="16.7" r="1" fill="currentColor" />
    </svg>
  );
}
function IconSupplier() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6.5" y="6.5" width="11" height="11" rx="1.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.5 3v2.5M12 3v2.5M14.5 3v2.5M9.5 18.5V21M12 18.5V21M14.5 18.5V21M3 9.5h2.5M3 12h2.5M3 14.5h2.5M18.5 9.5H21M18.5 12H21M18.5 14.5H21" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/* Stage → visual state ---------------------------------------------------- */
type LinkState = { active: boolean; dir: "fwd" | "rev" };
function link1State(s: FlowStage): LinkState {
  if (s === "toServer") return { active: true, dir: "fwd" };
  if (s === "toClient") return { active: true, dir: "rev" };
  return { active: false, dir: "fwd" };
}
function link2State(s: FlowStage): LinkState {
  if (s === "toSupplier") return { active: true, dir: "fwd" };
  if (s === "backToServer") return { active: true, dir: "rev" };
  return { active: false, dir: "fwd" };
}
const clientLit = (s: FlowStage) => s === "toServer" || s === "done";
const serverLit = (s: FlowStage) => s === "atServer" || s === "toSupplier" || s === "toClient";
const supplierLit = (s: FlowStage) => s === "atSupplier" || s === "backToServer";

function Connector({ state }: { state: LinkState }) {
  return (
    <div className={`track flex-1 ${state.active ? "track-active" : ""}`}>
      {state.active ? <div className={`comet ${state.dir === "fwd" ? "comet-fwd" : "comet-rev"}`} /> : null}
    </div>
  );
}

function Node({
  icon,
  label,
  sub,
  lit,
  error,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  lit: boolean;
  error?: boolean;
}) {
  return (
    <div
      className={[
        "flow-node flex w-[130px] flex-col items-center gap-2 px-3 py-4 text-center sm:w-[170px]",
        error ? "flow-node-error" : lit ? "flow-node-active" : "",
      ].join(" ")}
    >
      <span className={lit && !error ? "text-ink" : "text-muted"}>{icon}</span>
      <div>
        <div className={`text-[13px] font-medium ${lit && !error ? "text-ink" : "text-muted"}`}>{label}</div>
        <div className="mt-0.5 max-w-[150px] truncate text-[11px] text-dim">{sub}</div>
      </div>
    </div>
  );
}

const STATUS_CHIP: Record<ActiveRequest["status"], { label: string; cls: string }> = {
  idle: { label: "Idle", cls: "badge-offline" },
  received: { label: "Received", cls: "badge-busy" },
  assigned: { label: "Assigned", cls: "badge-busy" },
  processing: { label: "Processing", cls: "badge-busy" },
  completed: { label: "Completed", cls: "badge-online" },
  failed: { label: "Failed", cls: "badge-danger" },
};

export function FlowDiagram({ request }: { request: ActiveRequest }) {
  const stage = request.stage;
  const failed = stage === "failed";
  const l1 = link1State(stage);
  const l2 = link2State(stage);
  const chip = STATUS_CHIP[request.status];
  const running = request.status !== "idle" && request.status !== "completed" && request.status !== "failed";

  return (
    <section className="panel px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="eyebrow">Request lifecycle</div>
          <h2 className="mt-1.5 text-[15px] font-semibold text-ink">Live routing</h2>
        </div>
        <span className={`badge ${chip.cls}`}>
          <span className={`dot ${running ? "pulse" : ""}`} />
          {chip.label}
        </span>
      </div>

      <div className="flow-route mx-auto flex max-w-3xl items-center justify-center gap-2 sm:gap-4">
        <Node icon={<IconClient />} label="Client" sub={request.clientLabel || "OpenCode / Dashboard"} lit={clientLit(stage)} error={failed && request.status === "failed" && !request.supplierName} />
        <Connector state={l1} />
        <Node icon={<IconServer />} label="Central Server" sub="FastAPI router" lit={serverLit(stage)} />
        <Connector state={l2} />
        <Node icon={<IconSupplier />} label="Supplier" sub={request.supplierName || "least-busy node"} lit={supplierLit(stage)} error={failed} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-line pt-4 text-[12px]">
        <Meta label="Request"><span className="font-mono text-muted">{request.id ?? "—"}</span></Meta>
        <Meta label="Client"><span className="text-muted">{request.clientLabel}</span></Meta>
        <Meta label="Supplier"><span className="text-muted">{request.supplierName ?? "—"}</span></Meta>
      </div>
    </section>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="eyebrow">{label}</span>
      {children}
    </div>
  );
}
