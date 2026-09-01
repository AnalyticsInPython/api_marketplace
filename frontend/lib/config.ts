/* Runtime configuration, read from NEXT_PUBLIC_* env vars with local defaults. */

export const config = {
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
    "http://localhost:8000",
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/dashboard",
  apiKey: process.env.NEXT_PUBLIC_API_KEY ?? "",
  /** How long to wait before declaring the router offline. */
  offlineAfterMs: 2500,
  /** How often an offline dashboard retries the router connection. */
  reconnectMs: 5000,
} as const;
