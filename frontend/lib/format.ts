/* Small formatting helpers shared across components. */

export function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Abbreviate a token count for a fixed-width table cell: 0, 940, 1.2K, 15.3K,
 * 2.4M, 1.1B. Values under 1000 stay exact; above that, one decimal is kept
 * only while it is meaningful (9.4K, but 15K rather than 15.0K).
 */
export function compactCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  const units = [
    { limit: 1e12, suffix: "T" },
    { limit: 1e9, suffix: "B" },
    { limit: 1e6, suffix: "M" },
    { limit: 1e3, suffix: "K" },
  ];
  for (let i = 0; i < units.length; i++) {
    const { limit, suffix } = units[i];
    if (value >= limit) {
      const scaled = value / limit;
      const rounded = Number(scaled.toFixed(scaled < 10 ? 1 : 0));
      // Rounding can carry a value into the next unit: 999,999 would otherwise
      // render as "1000K" rather than "1M".
      if (rounded >= 1000 && i > 0) return `1${units[i - 1].suffix}`;
      return `${rounded}${suffix}`;
    }
  }
  return String(Math.round(value));
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "—";
  const secs = Math.max(0, Math.round((Date.now() - d) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}
