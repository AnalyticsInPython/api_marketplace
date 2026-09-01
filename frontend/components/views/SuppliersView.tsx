"use client";

import { useMemo, useState } from "react";
import type {
  EndpointDiagnostic,
  RoutedNetworkTest,
  Supplier,
  SupplierStatus,
} from "@/lib/types";
import { SuppliersTable } from "@/components/SuppliersTable";
import { SupplierSetupGuide } from "@/components/SupplierSetupGuide";
import { IconSearch } from "@/components/icons";

type Filter = "all" | SupplierStatus;

function normalizeEndpointUrl(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const withPort = /^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)
    ? `${trimmed}:11434`
    : trimmed;
  return `http://${withPort}`;
}

function CheckRow({
  label,
  value,
  passed,
  warning = false,
}: {
  label: string;
  value: string;
  passed: boolean;
  warning?: boolean;
}) {
  const badgeClass = passed ? (warning ? "badge-busy" : "badge-online") : "badge-danger";
  return (
    <div className="grid gap-2 border-t border-line px-4 py-3 first:border-t-0 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
      <span className="text-[12px] text-muted">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <span className={`badge ${badgeClass}`}><span className="dot" />{passed ? (warning ? "Check" : "Passed") : "Action needed"}</span>
        <span className="min-w-0 break-words font-mono text-[11.5px] text-dim">{value}</span>
      </div>
    </div>
  );
}

function DiagnosticResults({ diagnostic }: { diagnostic: EndpointDiagnostic }) {
  const scopeLabel = {
    private: "Trusted private-network address",
    loopback: "Localhost address, not reachable from another Mac",
    public: "Public address, blocked for safety",
    hostname: "Unverified hostname, use a private IP or .local name",
  }[diagnostic.networkScope];
  const scopePassed = diagnostic.safeForLan;
  const scopeWarning = diagnostic.networkScope === "loopback";

  return (
    <div className="mt-4 overflow-hidden rounded-[10px] border border-line bg-bg">
      <CheckRow label="Network address" value={scopeLabel} passed={scopePassed} warning={scopeWarning} />
      <CheckRow
        label="Ollama API"
        value={diagnostic.reachable ? `Reachable${diagnostic.version ? `, version ${diagnostic.version}` : ""}` : "No response from /api/tags"}
        passed={diagnostic.reachable}
      />
      <CheckRow
        label="Requested model"
        value={diagnostic.modelAvailable ? diagnostic.requestedModel : `${diagnostic.requestedModel} was not found`}
        passed={diagnostic.modelAvailable}
      />
      <CheckRow
        label="Registration"
        value={diagnostic.ready ? "Ready to add to the marketplace" : "Resolve the checks below before registering"}
        passed={diagnostic.ready}
      />
      {diagnostic.issues.length > 0 ? (
        <div className="border-t border-line px-4 py-3">
          {diagnostic.issues.map((issue) => (
            <p
              key={issue.code}
              className="mt-1 text-[12px] first:mt-0"
              style={{ color: issue.severity === "error" ? "var(--error)" : "var(--busy)" }}
            >
              {issue.message}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SuppliersView({
  suppliers,
  activeSupplierId,
  onRegister,
  onDiagnose,
  onNetworkTest,
}: {
  suppliers: Supplier[];
  activeSupplierId?: string;
  onRegister: (name: string, baseUrl: string, modelName: string) => Promise<string | null>;
  onDiagnose: (
    baseUrl: string,
    modelName: string,
  ) => Promise<{ diagnostic: EndpointDiagnostic | null; error: string | null }>;
  onNetworkTest: () => Promise<{ result: RoutedNetworkTest | null; error: string | null }>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelName, setModelName] = useState("qwen2.5-coder");
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnostic, setDiagnostic] = useState<EndpointDiagnostic | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [networkTest, setNetworkTest] = useState<RoutedNetworkTest | null>(null);
  const [networkTestError, setNetworkTestError] = useState<string | null>(null);

  const invalidateChecks = () => {
    setDiagnostic(null);
    setRegistrationMessage(null);
    setFormError(null);
  };

  const diagnose = async () => {
    const normalizedUrl = normalizeEndpointUrl(baseUrl);
    if (!normalizedUrl || !modelName.trim() || diagnosing) return;
    setBaseUrl(normalizedUrl);
    setDiagnosing(true);
    setDiagnostic(null);
    setRegistrationMessage(null);
    setFormError(null);
    const response = await onDiagnose(normalizedUrl, modelName.trim());
    setDiagnosing(false);
    setDiagnostic(response.diagnostic);
    setFormError(response.error);
  };

  const register = async () => {
    if (!name.trim() || !diagnostic?.ready || registering) return;
    setRegistering(true);
    setRegistrationMessage(null);
    setFormError(null);
    const error = await onRegister(name.trim(), diagnostic.baseUrl, modelName.trim());
    setRegistering(false);
    setFormError(error);
    if (!error) setRegistrationMessage(`${name.trim()} is registered and available to the router.`);
  };

  const runTest = async () => {
    if (testing) return;
    setTesting(true);
    setNetworkTest(null);
    setNetworkTestError(null);
    const response = await onNetworkTest();
    setTesting(false);
    setNetworkTest(response.result);
    setNetworkTestError(response.error);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      if (filter !== "all" && supplier.status !== filter) return false;
      if (q && !(supplier.name.toLowerCase().includes(q) || supplier.model.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [suppliers, query, filter]);

  const opts: { label: string; value: Filter }[] = [
    { label: "All", value: "all" },
    { label: "Online", value: "online" },
    { label: "Busy", value: "busy" },
    { label: "Offline", value: "offline" },
  ];
  const hasAvailableSupplier = suppliers.some((supplier) => supplier.status === "online");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[19px] font-semibold text-ink">Ollama endpoints</h1>
        <p className="mt-1 max-w-3xl text-[13px] text-muted">
          Follow the setup guide, verify the Mac from the router, then submit it to the live marketplace.
        </p>
      </div>

      <SupplierSetupGuide />

      <section id="supplier-registration-form" className="panel overflow-hidden scroll-mt-24">
        <div className="px-5 py-5 sm:px-6">
            <h2 className="text-[15px] font-semibold text-ink">Submit a supplier endpoint</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              Paste the connection URL printed by the helper. Checks run from the FastAPI router, so a passing result proves the supplier Mac is ready and reachable.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-1.5 text-[11.5px] font-medium text-muted">
                Display name
                <input
                  className="field"
                  placeholder="Omer's Mac"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setRegistrationMessage(null);
                  }}
                />
              </label>
              <label className="grid gap-1.5 text-[11.5px] font-medium text-muted">
                Ollama model
                <input
                  className="field font-mono"
                  placeholder="qwen2.5-coder"
                  value={modelName}
                  onChange={(event) => {
                    setModelName(event.target.value);
                    invalidateChecks();
                  }}
                />
              </label>
              <label className="grid gap-1.5 text-[11.5px] font-medium text-muted md:col-span-2">
                Wi-Fi IP or Ollama URL
                <input
                  className="field font-mono"
                  placeholder="192.168.1.24 or http://192.168.1.24:11434"
                  value={baseUrl}
                  onChange={(event) => {
                    setBaseUrl(event.target.value);
                    invalidateChecks();
                  }}
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="btn btn-primary"
                onClick={diagnose}
                disabled={diagnosing || !baseUrl.trim() || !modelName.trim()}
              >
                {diagnosing ? "Running checks..." : "Run network checks"}
              </button>
              <button
                className="btn btn-ghost"
                onClick={register}
                disabled={registering || !name.trim() || !diagnostic?.ready}
              >
                {registering ? "Submitting..." : "Submit endpoint"}
              </button>
            </div>

            {formError ? <p className="mt-3 text-[12px] text-danger">{formError}</p> : null}
            {registrationMessage ? <p className="mt-3 text-[12px] text-online">{registrationMessage}</p> : null}
            {diagnostic ? <DiagnosticResults diagnostic={diagnostic} /> : null}
        </div>
      </section>

      <section className="panel flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[14px] font-semibold text-ink">Marketplace route test</h2>
          <p className="mt-1 text-[12px] text-muted">
            Sends REMOTE_TEST_OK through FastAPI routing, supplier selection, and Ollama inference.
          </p>
          {networkTest ? (
            <p className={`mt-2 text-[12px] ${networkTest.matchedExpectedReply ? "text-online" : "text-busy"}`}>
              {networkTest.supplierName} replied: <span className="font-mono">{networkTest.content || "No text returned"}</span>
            </p>
          ) : null}
          {networkTestError ? <p className="mt-2 text-[12px] text-danger">{networkTestError}</p> : null}
        </div>
        <button className="btn btn-primary shrink-0" onClick={runTest} disabled={testing || !hasAvailableSupplier}>
          {testing ? "Testing route..." : "Send routed test"}
        </button>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div className="input min-w-[190px] flex-1 sm:max-w-[280px]">
            <IconSearch size={15} />
            <input aria-label="Search endpoints" placeholder="Search by endpoint or model..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="seg scroll-thin max-w-full overflow-x-auto" role="group" aria-label="Filter endpoints by status">
            {opts.map((option) => (
              <button key={option.value} className={`seg-btn ${filter === option.value ? "active" : ""}`} onClick={() => setFilter(option.value)} aria-pressed={filter === option.value}>
                {option.label}
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
