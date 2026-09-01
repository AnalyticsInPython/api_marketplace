/* Runtime configuration, read from NEXT_PUBLIC_* env vars with local defaults. */

function bool(value: string | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === "true";
}

export const config = {
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
    "http://localhost:8000",
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/dashboard",
  apiKey: process.env.NEXT_PUBLIC_API_KEY ?? "",
  forceMock: bool(process.env.NEXT_PUBLIC_USE_MOCK),
  /** How long to wait for the live WebSocket before falling back to mock (ms). */
  liveConnectTimeoutMs: 2500,
} as const;
