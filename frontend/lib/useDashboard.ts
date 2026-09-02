"use client";

/* ---------------------------------------------------------------------------
   useDashboard — single source of truth for the console.

   Connects to the FastAPI central server's dashboard WebSocket
   (spec §10.4, WS /ws/dashboard). The console only renders marketplace data
   received from the live backend. When the router is unavailable, it clears
   transient state and exposes setup instructions while retrying automatically.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { config, resolveApiBaseUrl, resolveWsUrl } from "./config";
import type {
  ActiveRequest,
  Completion,
  ConnectionMode,
  DashboardEvent,
  DashboardEventType,
  DashboardMetrics,
  EndpointDiagnostic,
  FlowStage,
  LoadSample,
  RoutedNetworkTest,
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
    model: String(raw.model ?? raw.model_name ?? "qwen2.5-coder:1.5b"),
    status: ["online", "busy", "offline"].includes(status) ? status : "offline",
    activeRequests: Number(raw.active_requests ?? raw.activeRequests ?? 0),
    tokensUsed: Number(raw.tokens_used ?? raw.tokensUsed ?? 0),
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

const IDLE_REQUEST: ActiveRequest = {
  id: null,
  prompt: "",
  clientLabel: DASHBOARD_CLIENT,
  status: "idle",
  stage: "idle",
};

export function useDashboard() {
  const apiBaseUrl = resolveApiBaseUrl();
  const wsUrl = resolveWsUrl();
  const [mode, setMode] = useState<ConnectionMode>("connecting");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [request, setRequest] = useState<ActiveRequest>(IDLE_REQUEST);
  const [stats, setStats] = useState({ completed: 0, failed: 0, latencies: [] as number[] });
  const [series, setSeries] = useState<LoadSample[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const retryConnectionRef = useRef<() => void>(() => undefined);
  const modeRef = useRef<ConnectionMode>("connecting");
  const receivedAt = useRef<Map<string, number>>(new Map());
  const suppliersRef = useRef<Supplier[]>([]);

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

    const clearTransientState = () => {
      setSuppliers([]);
      setEvents([]);
      setRequest(IDLE_REQUEST);
      setStats({ completed: 0, failed: 0, latencies: [] });
      setSeries([]);
      setCompletions([]);
      receivedAt.current.clear();
    };

    const markOffline = () => {
      if (disposed) return;
      clearTransientState();
      setModeBoth("offline");
    };

    const fetchSuppliers = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/endpoints`, {
          headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.suppliers ?? data.data ?? [];
        if (!disposed) setSuppliers(list.map(normalizeSupplier));
      } catch {
        /* The WebSocket lifecycle owns the connection state. */
      }
    };

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        tryLive(false);
      }, config.reconnectMs);
    };

    const tryLive = (showConnecting: boolean) => {
      if (disposed) return;
      if (showConnecting) setModeBoth("connecting");
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        markOffline();
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      connectTimer = setTimeout(() => {
        if (modeRef.current !== "live" && !disposed && wsRef.current === ws) {
          wsRef.current = null;
          try {
            ws.close();
          } catch {
            /* noop */
          }
          markOffline();
          scheduleReconnect();
        }
      }, config.offlineAfterMs);

      ws.onopen = () => {
        if (disposed || wsRef.current !== ws) return;
        if (connectTimer) clearTimeout(connectTimer);
        connectTimer = null;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = null;
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
        if (disposed || wsRef.current !== ws) return;
        wsRef.current = null;
        if (connectTimer) clearTimeout(connectTimer);
        connectTimer = null;
        markOffline();
        scheduleReconnect();
      };
      ws.onclose = () => {
        if (disposed || wsRef.current !== ws) return;
        wsRef.current = null;
        if (connectTimer) clearTimeout(connectTimer);
        connectTimer = null;
        markOffline();
        scheduleReconnect();
      };
    };

    retryConnectionRef.current = () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      if (connectTimer) clearTimeout(connectTimer);
      connectTimer = null;
      const current = wsRef.current;
      wsRef.current = null;
      try {
        current?.close();
      } catch {
        /* noop */
      }
      tryLive(true);
    };

    tryLive(true);

    return () => {
      disposed = true;
      retryConnectionRef.current = () => undefined;
      if (connectTimer) clearTimeout(connectTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
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
      if (modeRef.current !== "live") return;
      const busy = suppliersRef.current.filter((s) => s.status === "busy").length;
      setSeries((prev) => [...prev, { t: Date.now(), load: busy }].slice(-SERIES_LIMIT));
    }, SAMPLE_MS);
    return () => clearInterval(id);
  }, []);

  /* ------------------------------ actions -------------------------------- */

  const submitPrompt = useCallback(async (prompt: string) => {
    const text = prompt.trim();
    if (!text) return;

    if (modeRef.current === "live") {
      setRequest({
        id: null,
        prompt: text,
        clientLabel: DASHBOARD_CLIENT,
        status: "received",
        stage: "toServer",
      });
      try {
        const res = await fetch(`${apiBaseUrl}/api/prompts`, {
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
          routingNotice: data?.routing_notice ?? undefined,
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

  const retryConnection = useCallback(() => {
    retryConnectionRef.current();
  }, []);

  const diagnoseEndpoint = useCallback(async (
    baseUrl: string,
    modelName: string,
  ): Promise<{ diagnostic: EndpointDiagnostic | null; error: string | null }> => {
    if (modeRef.current !== "live") {
      return { diagnostic: null, error: "The marketplace router is offline." };
    }
    try {
      const res = await fetch(`${apiBaseUrl}/api/endpoints/diagnose`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({ base_url: baseUrl, model_name: modelName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          diagnostic: null,
          error: data?.detail?.[0]?.msg ?? data?.detail ?? `Network checks failed (${res.status})`,
        };
      }
      return {
        diagnostic: {
          baseUrl: String(data.base_url),
          networkScope: data.network_scope,
          safeForLan: Boolean(data.safe_for_lan),
          reachable: Boolean(data.reachable),
          version: data.version == null ? null : String(data.version),
          models: Array.isArray(data.models) ? data.models.map(String) : [],
          requestedModel: String(data.requested_model),
          modelAvailable: Boolean(data.model_available),
          ready: Boolean(data.ready),
          issues: Array.isArray(data.issues) ? data.issues : [],
        },
        error: null,
      };
    } catch {
      return { diagnostic: null, error: "Could not reach the marketplace router." };
    }
  }, []);

  const runNetworkTest = useCallback(async (): Promise<{
    result: RoutedNetworkTest | null;
    error: string | null;
  }> => {
    if (modeRef.current !== "live") {
      return { result: null, error: "The marketplace router is offline." };
    }
    try {
      const res = await fetch(`${apiBaseUrl}/api/prompts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          prompt: "Reply with exactly: REMOTE_TEST_OK",
          client_label: `dashboard-network-check-${Date.now()}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          result: null,
          error: data?.detail ?? data?.error ?? `Routed test failed (${res.status})`,
        };
      }
      const content = String(data.content ?? "");
      return {
        result: {
          requestId: String(data.request_id ?? ""),
          supplierId: String(data.supplier_id ?? data.endpoint_id ?? ""),
          supplierName: String(data.supplier_name ?? data.endpoint_name ?? "Unknown endpoint"),
          content,
          matchedExpectedReply: content.includes("REMOTE_TEST_OK"),
        },
        error: null,
      };
    } catch {
      return { result: null, error: "Could not reach the marketplace router." };
    }
  }, []);

  const registerEndpoint = useCallback(async (
    name: string,
    baseUrl: string,
    modelName: string,
  ): Promise<string | null> => {
    if (modeRef.current !== "live") return "The marketplace router is offline. Reconnect before registering an endpoint.";
    try {
      const res = await fetch(`${apiBaseUrl}/api/endpoints`, {
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
    diagnoseEndpoint,
    runNetworkTest,
    retryConnection,
    busy,
  };
}
