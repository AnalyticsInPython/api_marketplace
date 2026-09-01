/* Shared domain types for the Local LLM Marketplace dashboard. */

export type SupplierStatus = "online" | "busy" | "offline";

export interface Supplier {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  status: SupplierStatus;
  /** 0 or 1 — each Ollama endpoint handles one routed request. */
  activeRequests: number;
  lastSeen: string | null; // ISO timestamp
}

export type DashboardEventType =
  | "supplier.online"
  | "supplier.busy"
  | "supplier.offline"
  | "endpoint.online"
  | "endpoint.busy"
  | "endpoint.offline"
  | "request.received"
  | "request.assigned"
  | "request.processing"
  | "request.completed"
  | "request.failed";

export interface DashboardEvent {
  id: string;
  event: DashboardEventType;
  timestamp: string; // ISO
  requestId?: string;
  clientLabel?: string;
  supplierId?: string;
  supplierName?: string;
  message?: string;
}

/** Stage of the request as it travels the flow diagram. */
export type FlowStage =
  | "idle"
  | "client"
  | "toServer"
  | "atServer"
  | "toSupplier"
  | "atSupplier"
  | "backToServer"
  | "toClient"
  | "done"
  | "failed";

export type RequestStatus =
  | "idle"
  | "received"
  | "assigned"
  | "processing"
  | "completed"
  | "failed";

export interface ActiveRequest {
  id: string | null;
  prompt: string;
  clientLabel: string;
  status: RequestStatus;
  stage: FlowStage;
  supplierId?: string;
  supplierName?: string;
  response?: string;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}

export type ConnectionMode = "connecting" | "live" | "mock";

/** One sample of network load (busy supplier count) at a point in time. */
export interface LoadSample {
  t: number; // epoch ms
  load: number;
}

/** A completed request, for the latency series. */
export interface Completion {
  t: number; // epoch ms
  latencyMs: number;
}

export interface DashboardMetrics {
  onlineCount: number;
  busyCount: number;
  totalNodes: number;
  requestsThisSession: number;
  avgLatencyMs: number | null;
}
