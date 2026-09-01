/* ---------------------------------------------------------------------------
   Mock engine
   Drives the entire request lifecycle client-side so the dashboard is fully
   alive without a running FastAPI backend. It mirrors the real routing rules:
     - one active request per Ollama endpoint
     - least-busy + round-robin selection (spec §9.4)
     - client affinity for the session (spec §9.3)
     - immediate availability error when nothing is online (spec §9.5)
   The hook swaps this out for the real WebSocket/API the moment a backend
   is reachable — components never know the difference.
   --------------------------------------------------------------------------- */

import type {
  ActiveRequest,
  DashboardEvent,
  DashboardEventType,
  Supplier,
} from "./types";

interface MockHandlers {
  onSuppliers: (suppliers: Supplier[]) => void;
  onEvent: (event: DashboardEvent) => void;
  onRequest: (request: ActiveRequest) => void;
}

let seq = 0;
const uid = (prefix: string) =>
  `${prefix}-${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const nowIso = () => new Date().toISOString();

function initialSuppliers(): Supplier[] {
  const t = Date.now();
  return [
    { id: "team-mac-1", name: "team-mac-1", baseUrl: "http://192.168.1.21:11434", model: "tinyllama", status: "online", activeRequests: 0, lastSeen: new Date(t).toISOString() },
    { id: "team-mac-2", name: "team-mac-2", baseUrl: "http://192.168.1.22:11434", model: "tinyllama", status: "online", activeRequests: 0, lastSeen: new Date(t).toISOString() },
    { id: "team-mac-3", name: "team-mac-3", baseUrl: "http://192.168.1.23:11434", model: "tinyllama", status: "online", activeRequests: 0, lastSeen: new Date(t).toISOString() },
    { id: "studio-mac", name: "studio-mac", baseUrl: "http://192.168.1.24:11434", model: "tinyllama", status: "offline", activeRequests: 0, lastSeen: new Date(t - 1000 * 60 * 4).toISOString() },
  ];
}

const CANNED: Record<string, string> = {
  recursion:
    "Recursion is when a function calls itself to solve a smaller piece of the same problem, stopping at a simple base case. Think of nested boxes: you open one, find a smaller one inside, and repeat until a box is empty.",
  default:
    "Here's a short answer from the local model running on this Ollama endpoint. In a real deployment TinyLlama generates this text on the endpoint Mac and returns it through the central router.",
};

function fakeAnswer(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("recursion")) return CANNED.recursion;
  if (p.includes("hello") || p.includes("hi ") || p.trim() === "hi")
    return "Hello! I'm TinyLlama running locally on this Ollama endpoint. Ask me anything and the marketplace will route it here.";
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  const topic = trimmed.length > 60 ? trimmed.slice(0, 57) + "…" : trimmed;
  return `On "${topic}" — ${CANNED.default}`;
}

export class MockEngine {
  private suppliers: Supplier[] = initialSuppliers();
  private handlers: MockHandlers;
  private affinity = new Map<string, string>(); // clientLabel -> supplierId
  private rrIndex = 0;
  private inFlight = new Set<string>(); // clientLabels currently processing
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private started = false;

  constructor(handlers: MockHandlers) {
    this.handlers = handlers;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.emitSuppliers();
    // Seed the feed so a freshly opened dashboard shows recent state.
    for (const s of this.suppliers) {
      this.emit(s.status === "offline" ? "endpoint.offline" : "endpoint.online", {
        supplierId: s.id,
        supplierName: s.name,
        message: `${s.name} · ${s.model}`,
      });
    }
  }

  stop() {
    this.started = false;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  getSuppliers(): Supplier[] {
    return this.suppliers.map((s) => ({ ...s }));
  }

  private later(fn: () => void, ms: number) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  private emitSuppliers() {
    this.handlers.onSuppliers(this.getSuppliers());
  }

  private emit(
    event: DashboardEventType,
    extra: Partial<DashboardEvent> = {},
  ) {
    this.handlers.onEvent({
      id: uid("evt"),
      event,
      timestamp: nowIso(),
      ...extra,
    });
  }

  private setSupplier(id: string, patch: Partial<Supplier>) {
    this.suppliers = this.suppliers.map((s) =>
      s.id === id ? { ...s, ...patch, lastSeen: nowIso() } : s,
    );
    this.emitSuppliers();
  }

  private selectSupplier(clientLabel: string): Supplier | null {
    // Affinity: keep the client on its supplier if it is still connected.
    const pinned = this.affinity.get(clientLabel);
    if (pinned) {
      const s = this.suppliers.find((x) => x.id === pinned);
      if (s && s.status !== "offline") return s;
      this.affinity.delete(clientLabel); // stale — supplier went offline
    }
    const online = this.suppliers.filter((s) => s.status === "online");
    if (online.length === 0) return null;
    // Least-busy, round-robin tie-break.
    const minLoad = Math.min(...online.map((s) => s.activeRequests));
    const eligible = online.filter((s) => s.activeRequests === minLoad);
    const chosen = eligible[this.rrIndex % eligible.length];
    this.rrIndex = (this.rrIndex + 1) % Math.max(eligible.length, 1);
    this.affinity.set(clientLabel, chosen.id);
    return chosen;
  }

  /** Kick off a simulated request. Drives events + supplier state + request UI. */
  simulate(prompt: string, clientLabel: string) {
    const requestId = uid("chatcmpl");
    const base: ActiveRequest = {
      id: requestId,
      prompt,
      clientLabel,
      status: "received",
      stage: "toServer",
    };

    // Reject a second concurrent request from the same client (spec §9.3).
    if (this.inFlight.has(clientLabel)) {
      this.handlers.onRequest({
        ...base,
        status: "failed",
        stage: "failed",
        error:
          "This client already has a request in flight. One active request per client (spec §9.3).",
      });
      this.emit("request.failed", {
        requestId,
        clientLabel,
        message: "Rejected: client already has an active request",
      });
      return;
    }

    this.emit("request.received", { requestId, clientLabel });
    this.handlers.onRequest(base);

    this.later(() => {
      const supplier = this.selectSupplier(clientLabel);
      if (!supplier) {
        this.handlers.onRequest({
          ...base,
          status: "failed",
          stage: "failed",
          error: "No endpoint available. All nodes are offline or busy.",
        });
        this.emit("request.failed", {
          requestId,
          clientLabel,
          message: "503 — no eligible endpoint",
        });
        return;
      }

      this.inFlight.add(clientLabel);
      this.setSupplier(supplier.id, { status: "busy", activeRequests: 1 });
      this.emit("endpoint.busy", {
        supplierId: supplier.id,
        supplierName: supplier.name,
        requestId,
      });
      this.emit("request.assigned", {
        requestId,
        clientLabel,
        supplierId: supplier.id,
        supplierName: supplier.name,
      });
      this.handlers.onRequest({
        ...base,
        status: "assigned",
        stage: "toSupplier",
        supplierId: supplier.id,
        supplierName: supplier.name,
      });

      this.later(() => {
        this.emit("request.processing", {
          requestId,
          clientLabel,
          supplierId: supplier.id,
          supplierName: supplier.name,
        });
        this.handlers.onRequest({
          ...base,
          status: "processing",
          stage: "atSupplier",
          supplierId: supplier.id,
          supplierName: supplier.name,
        });

        const inferMs = 1400 + Math.round(Math.random() * 900);
        this.later(() => {
          const response = fakeAnswer(prompt);
          // return trip: supplier -> server
          this.handlers.onRequest({
            ...base,
            status: "processing",
            stage: "backToServer",
            supplierId: supplier.id,
            supplierName: supplier.name,
          });
          this.inFlight.delete(clientLabel);
          this.setSupplier(supplier.id, { status: "online", activeRequests: 0 });
          this.emit("endpoint.online", {
            supplierId: supplier.id,
            supplierName: supplier.name,
          });

          this.later(() => {
            // server -> client
            this.handlers.onRequest({
              ...base,
              status: "processing",
              stage: "toClient",
              supplierId: supplier.id,
              supplierName: supplier.name,
              response,
            });
            this.later(() => {
              this.emit("request.completed", {
                requestId,
                clientLabel,
                supplierId: supplier.id,
                supplierName: supplier.name,
              });
              this.handlers.onRequest({
                ...base,
                status: "completed",
                stage: "done",
                supplierId: supplier.id,
                supplierName: supplier.name,
                response,
                finishedAt: Date.now(),
              });
            }, 320);
          }, 340);
        }, inferMs);
      }, 320);
    }, 340);
  }
}
