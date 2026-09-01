"use client";

import { useMemo, useState } from "react";
import type { Supplier, SupplierStatus } from "@/lib/types";
import { SuppliersTable } from "@/components/SuppliersTable";
import { IconSearch } from "@/components/icons";

type Filter = "all" | SupplierStatus;

export function SuppliersView({
  suppliers,
  activeSupplierId,
  onRegister,
}: {
  suppliers: Supplier[];
  activeSupplierId?: string;
  onRegister: (name: string, baseUrl: string, modelName: string) => Promise<string | null>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelName, setModelName] = useState("qwen2.5-coder");
  const [registering, setRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  const register = async () => {
    if (!name.trim() || !baseUrl.trim() || !modelName.trim() || registering) return;
    setRegistering(true);
    setRegistrationError(null);
    const error = await onRegister(name.trim(), baseUrl.trim(), modelName.trim());
    setRegistering(false);
    setRegistrationError(error);
    if (!error) {
      setName("");
      setBaseUrl("");
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (filter !== "all" && s.status !== filter) return false;
      if (q && !(s.name.toLowerCase().includes(q) || s.model.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [suppliers, query, filter]);

  const opts: { label: string; value: Filter }[] = [
    { label: "All", value: "all" },
    { label: "Online", value: "online" },
    { label: "Busy", value: "busy" },
    { label: "Offline", value: "offline" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[19px] font-semibold text-ink">Ollama endpoints</h1>
        <p className="mt-1 text-[13px] text-muted">
          Register each Mac&apos;s Ollama URL. The router validates the model, polls health, and persists
          the endpoint registry across restarts.
        </p>
      </div>

      <section className="panel px-5 py-4">
        <div className="eyebrow mb-3">Register endpoint</div>
        <div className="grid gap-2 md:grid-cols-[1fr_1.5fr_0.8fr_auto]">
          <input className="field" aria-label="Endpoint name" placeholder="Omer's Mac" value={name} onChange={(event) => setName(event.target.value)} />
          <input className="field" aria-label="Ollama base URL" placeholder="http://192.168.1.24:11434" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
          <input className="field" aria-label="Ollama model" placeholder="qwen2.5-coder" value={modelName} onChange={(event) => setModelName(event.target.value)} />
          <button className="btn btn-primary" onClick={register} disabled={registering || !name.trim() || !baseUrl.trim() || !modelName.trim()}>
            {registering ? "Checking…" : "Register"}
          </button>
        </div>
        {registrationError ? <p className="mt-2 text-[12px]" style={{ color: "var(--error)" }}>{registrationError}</p> : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div className="input min-w-[190px] flex-1 sm:max-w-[280px]">
            <IconSearch size={15} />
            <input aria-label="Search endpoints" placeholder="Search by endpoint or model…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="seg scroll-thin max-w-full overflow-x-auto" role="group" aria-label="Filter endpoints by status">
            {opts.map((o) => (
              <button key={o.value} className={`seg-btn ${filter === o.value ? "active" : ""}`} onClick={() => setFilter(o.value)} aria-pressed={filter === o.value}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <span className="text-[12px] text-muted">
          {filtered.length} of {suppliers.length}
        </span>
      </div>

      <SuppliersTable suppliers={filtered} activeSupplierId={activeSupplierId} />
    </div>
  );
}
