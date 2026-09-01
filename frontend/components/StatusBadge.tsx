import type { SupplierStatus } from "@/lib/types";

const MAP: Record<SupplierStatus, { cls: string; label: string; pulse: boolean }> = {
  online: { cls: "badge-online", label: "online", pulse: false },
  busy: { cls: "badge-busy", label: "busy", pulse: true },
  offline: { cls: "badge-offline", label: "offline", pulse: false },
};

export function StatusBadge({ status }: { status: SupplierStatus }) {
  const { cls, label, pulse } = MAP[status];
  return (
    <span className={`badge ${cls}`}>
      <span className={`dot ${pulse ? "pulse" : ""}`} />
      {label}
    </span>
  );
}
