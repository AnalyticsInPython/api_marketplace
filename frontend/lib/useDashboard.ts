"use client";

/* ---------------------------------------------------------------------------
   useDashboard — single source of truth for the console.

   Tries to connect to the FastAPI central server's dashboard WebSocket
   (spec §10.4, WS /ws/dashboard). If it can't reach a backend within a short
   window, it transparently falls back to the built-in MockEngine, so the
   console is fully interactive on its own. It also maintains a rolling
   time-series (network load + request latency) that powers the activity chart.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { config } from "./config";
import { MockEngine } from "./mockEngine";
import type {
  ActiveRequest,
  Completion,
  ConnectionMode,
  DashboardEvent,
  DashboardEventType,
  DashboardMetrics,
  FlowStage,
  LoadSample,
  Supplier,
  SupplierStatus,
} from "./types";

const EVENT_LIMIT = 60;
const DASHBOARD_CLIENT = "dashboard-simulator";
const SAMPLE_MS = 1500; // cadence of the load sampler
const SERIES_LIMIT = 800; // ~20 min of samples

/* ------------------------------ normalizers ------------------------------- */

function normalizeSupplier(raw: any): Supplier {
  const status = (raw.status ?? "offline") as SupplierStatus;
  return {
    id: String(raw.id ?? raw.supplier_id ?? raw.name),
    name: String(raw.name ?? raw.supplier_name ?? raw.id),
    baseUrl: String(raw.base_url ?? raw.baseUrl ?? ""),
    model: String(raw.model ?? raw.model_name ?? "tinyllama"),
    status: ["online", "busy", "offline"].includes(status) ? status : "offline",
    activeRequests: Number(raw.active_requests ?? raw.activeRequests ?? 0),
    lastSeen: raw.last_seen_at ?? raw.last_seen ?? raw.lastSeen ?? null,
  };
}

let liveSeq = 0;
function normalizeEvent(raw: any): DashboardEvent {
  return {
    id: `live-${liveSeq++}`,
    event: raw.event as DashboardEventType,
    timestamp: raw.timestamp ?? new Date().toISOString(),
    requestId: raw.request_id ?? raw.requestId,
    clientLabel: raw.client_label ?? raw.clientLabel,
    supplierId: raw.supplier_id ?? raw.supplierId ?? raw.endpoint_id ?? raw.endpointId,
    supplierName: raw.supplier_name ?? raw.supplierName ?? raw.endpoint_name ?? raw.endpointName,
    message: raw.message,
  };
}

function stageForEvent(type: DashboardEventType): FlowStage {
  switch (type) {
    case "request.received":
      return "toServer";
    case "request.assigned":
      return "toSupplier";
    case "request.processing":
      return "atSupplier";
    case "request.completed":
      return "done";
    case "request.failed":
      return "failed";
    default:
      return "idle";
  }
}

/* Synthetic history so the activity chart has shape on first load (mock only). */
function buildSeed(totalNodes: number): { samples: LoadSample[]; comps: Completion[] } {
  const now = Date.now();
  const step = 3000;
  const n = 200; // 10 minutes @ 3s
  const samples: LoadSample[] = [];
  const comps: Completion[] = [];
  let load = 0;
  let burstLeft = 0;
  for (let i = 0; i < n; i++) {
    const t = now - (n - i) * step;
    if (burstLeft > 0) {
      burstLeft -= 1;
      if (burstLeft === 0) {
        comps.push({ t, latencyMs: 1200 + Math.random() * 2300 });
        load = 0;
      }
    } else if (Math.random() < 0.1) {
      load = Math.min(totalNodes || 3, 1 + (Math.random() < 0.28 ? 1 : 0));
      burstLeft = 1 + Math.floor(Math.random() * 3);
    }
    samples.push({ t, load });
  }
  return { samples, comps };
}

const IDLE_REQUEST: ActiveRequest = {
  id: null,
  prompt: "",
  clientLabel: DASHBOARD_CLIENT,
  status: "idle",
  stage: "idle",
};

export function useDashboard() {
  const [mode, setMode] = useState<ConnectionMode>("connecting");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [request, setRequest] = useState<ActiveRequest>(IDLE_REQUEST);
  const [stats, setStats] = useState({ completed: 0, failed: 0, latencies: [] as number[] });
  const [series, setSeries] = useState<LoadSample[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);

  const engineRef = useRef<MockEngine | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const modeRef = useRef<ConnectionMode>("connecting");
  const receivedAt = useRef<Map<string, number>>(new Map());
  const suppliersRef = useRef<Supplier[]>([]);
  const seededRef = useRef(false);

  const setModeBoth = (m: ConnectionMode) => {
    modeRef.current = m;
    setMode(m);
  };

  useEffect(() => {
    suppliersRef.current = suppliers;
  }, [suppliers]);

  const ingestEvent = useCallback((e: DashboardEvent) => {
    setEvents((prev) => [e, ...prev].slice(0, EVENT_LIMIT));
    if (e.event === "request.received" && e.requestId) {
      receivedAt.current.set(e.requestId, Date.parse(e.timestamp));
    }
    if (e.event === "request.completed") {
      const started = e.requestId ? receivedAt.current.get(e.requestId) : undefined;
      const latency = started ? Date.parse(e.timestamp) - started : undefined;
      setStats((s) => ({
        ...s,
        completed: s.completed + 1,
        latencies: latency ? [...s.latencies, latency].slice(-20) : s.latencies,
      }));
      if (latency) {
        setCompletions((c) => [...c, { t: Date.parse(e.timestamp), latencyMs: latency }].slice(-80));
      }
    }
    if (e.event === "request.failed") {
      setStats((s) => ({ ...s, failed: s.failed + 1 }));
    }
  }, []);

  /* ------------------------- connection lifecycle ------------------------- */

  useEffect(() => {
    let disposed = false;
    let connectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const seedIfMock = () => {
      if (seededRef.current) return;
      seededRef.current = true;
      const { samples, comps } = buildSeed(4);
      setSeries(samples);
      setCompletions(comps);
    };

    const startMock = () => {
      if (disposed || engineRef.current) return;
      const engine = new MockEngine({
        onSuppliers: (s) => !disposed && setSuppliers(s),
        onEvent: (e) => !disposed && ingestEvent(e),
        onRequest: (r) => !disposed && setRequest(r),
      });
      engineRef.current = engine;
      engine.start();
      setModeBoth("mock");
      seedIfMock();
    };

    const stopMock = () => {
      engineRef.current?.stop();
      engineRef.current = null;
    };

    const fetchSuppliers = async () => {
      try {
        const res = await fetch(`${config.apiBaseUrl}/api/endpoints`, {
          headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.suppliers ?? data.data ?? [];
        if (!disposed) setSuppliers(list.map(normalizeSupplier));
      } catch {
        /* ignore — WS is the primary channel */
      }
    };

    const scheduleReconnect = () => {
      if (disposed || config.forceMock || reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        tryLive();
      }, 5000);
    };

    const tryLive = () => {
      if (disposed) return;
      let ws: WebSocket;
      try {
        ws = new WebSocket(config.wsUrl);
      } catch {
        startMock();
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      connectTimer = setTimeout(() => {
        if (modeRef.current !== "live" && !disposed) {
          try {
            ws.close();
          } catch {
            /* noop */
          }
          startMock();
        }
      }, config.liveConnectTimeoutMs);

      ws.onopen = () => {
        if (disposed || wsRef.current !== ws) return;
        if (connectTimer) clearTimeout(connectTimer);
        connectTimer = null;
        const wasMock = modeRef.current === "mock";
        stopMock();
        if (wasMock) {
          setSuppliers([]);
          setEvents([]);
          setRequest(IDLE_REQUEST);
          setStats({ completed: 0, failed: 0, latencies: [] });
          setSeries([]);
          setCompletions([]);
          seededRef.current = false;
        }
        setModeBoth("live");
        void fetchSuppliers();
      };

      ws.onmessage = (msg) => {
        if (disposed) return;
        let payload: any;
        try {
          payload = JSON.parse(msg.data);
        } catch {
          return;
        }
        if (Array.isArray(payload?.suppliers)) {
          setSuppliers(payload.suppliers.map(normalizeSupplier));
          return;
        }
        if (payload?.event) {
          const e = normalizeEvent(payload);
          ingestEvent(e);
          if (e.event.startsWith("supplier.") || e.event.startsWith("endpoint.")) void fetchSuppliers();
          if (e.event.startsWith("request.")) {
            setRequest((prev) => ({
              ...prev,
              id: e.requestId ?? prev.id,
              status:
                e.event === "request.completed"
                  ? "completed"
                  : e.event === "request.failed"
                    ? "failed"
                    : e.event === "request.processing"
                      ? "processing"
                      : e.event === "request.assigned"
                        ? "assigned"
                        : "received",
              stage: stageForEvent(e.event),
              supplierName: e.supplierName ?? prev.supplierName,
              supplierId: e.supplierId ?? prev.supplierId,
              error: e.event === "request.failed" ? e.message ?? "Request failed" : prev.error,
            }));
          }
        }
      };

      ws.onerror = () => {
        if (wsRef.current !== ws) return;
        if (modeRef.current !== "live" && !disposed) {
          if (connectTimer) clearTimeout(connectTimer);
          connectTimer = null;
          startMock();
          scheduleReconnect();
        }
      };
      ws.onclose = () => {
        if (disposed || wsRef.current !== ws) return;
        wsRef.current = null;
        if (connectTimer) clearTimeout(connectTimer);
        connectTimer = null;
        startMock();
        scheduleReconnect();
      };
    };

    if (config.forceMock) startMock();
    else tryLive();

    return () => {
      disposed = true;
      if (connectTimer) clearTimeout(connectTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      engineRef.current?.stop();
      engineRef.current = null;
      try {
        wsRef.current?.close();
      } catch {
        /* noop */
      }
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingestEvent]);

  /* --------------------------- load sampler ------------------------------ */

  useEffect(() => {
    const id = setInterval(() => {
      const busy = suppliersRef.current.filter((s) => s.status === "busy").length;
      setSeries((prev) => [...prev, { t: Date.now(), load: busy }].slice(-SERIES_LIMIT));
    }, SAMPLE_MS);
    return () => clearInterval(id);
  }, []);

  /* ------------------------------ actions -------------------------------- */

  const submitPrompt = useCallback(async (prompt: string) => {
    const text = prompt.trim();
    if (!text) return;

    if (modeRef.current === "mock" && engineRef.current) {
      engineRef.current.simulate(text, DASHBOARD_CLIENT);
      return;
    }

    if (modeRef.current === "live") {
      setRequest({
        id: null,
        prompt: text,
        clientLabel: DASHBOARD_CLIENT,
        status: "received",
        stage: "toServer",
      });
      try {
        const res = await fetch(`${config.apiBaseUrl}/api/prompts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
          },
          body: JSON.stringify({ prompt: text, client_label: DASHBOARD_CLIENT }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setRequest((prev) => ({
            ...prev,
            status: "failed",
            stage: "failed",
            error: data?.error ?? data?.detail ?? `Request failed (${res.status})`,
          }));
          return;
        }
        const content =
          data?.content ??
          data?.response ??
          data?.choices?.[0]?.message?.content ??
          "";
        setRequest((prev) => ({
          ...prev,
          id: data?.request_id ?? data?.id ?? prev.id,
          status: "completed",
          stage: "done",
          supplierName: data?.supplier_name ?? prev.supplierName,
          response: content,
          finishedAt: Date.now(),
        }));
      } catch {
        setRequest((prev) => ({
          ...prev,
          status: "failed",
          stage: "failed",
          error: "Could not reach the central server.",
        }));
      }
    }
  }, []);

  const registerEndpoint = useCallback(async (
    name: string,
    baseUrl: string,
    modelName: string,
  ): Promise<string | null> => {
    if (modeRef.current !== "live") return "Connect to the live router before registering an endpoint.";
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/endpoints`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({ name, base_url: baseUrl, model_name: modelName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data?.detail ?? `Registration failed (${res.status})`;
      const endpoint = normalizeSupplier(data);
      setSuppliers((current) => [
        ...current.filter((item) => item.id !== endpoint.id),
        endpoint,
      ]);
      return null;
    } catch {
      return "Could not reach the central server.";
    }
  }, []);

  /* ------------------------------ metrics -------------------------------- */

  const metrics: DashboardMetrics = useMemo(() => {
    const onlineCount = suppliers.filter((s) => s.status === "online").length;
    const busyCount = suppliers.filter((s) => s.status === "busy").length;
    const avg =
      stats.latencies.length > 0
        ? Math.round(stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length)
        : null;
    return {
      onlineCount,
      busyCount,
      totalNodes: suppliers.length,
      requestsThisSession: stats.completed + stats.failed,
      avgLatencyMs: avg,
    };
  }, [suppliers, stats]);

  const busy =
    request.status !== "idle" &&
    request.status !== "completed" &&
    request.status !== "failed";

  return {
    mode,
    suppliers,
    events,
    request,
    metrics,
    series,
    completions,
    submitPrompt,
    registerEndpoint,
    busy,
  };
}
