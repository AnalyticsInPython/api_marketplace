/* Runtime configuration, read from NEXT_PUBLIC_* env vars with network-aware defaults. */

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
const configuredWsUrl = process.env.NEXT_PUBLIC_WS_URL?.trim();

export function resolveApiBaseUrl(): string {
  if (configuredApiBaseUrl && configuredApiBaseUrl.toLowerCase() !== "auto") {
    return configuredApiBaseUrl.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
}

export function resolveWsUrl(): string {
  if (configuredWsUrl && configuredWsUrl.toLowerCase() !== "auto") {
    return configuredWsUrl;
  }
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.hostname}:8000/ws/dashboard`;
  }
  return "ws://localhost:8000/ws/dashboard";
}

export const config = {
  apiKey: process.env.NEXT_PUBLIC_API_KEY ?? "",
  /** How long to wait before declaring the router offline. */
  offlineAfterMs: 2500,
  /** How often an offline dashboard retries the router connection. */
  reconnectMs: 5000,
} as const;
