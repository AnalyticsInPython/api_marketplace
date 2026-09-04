"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { ActiveRequest } from "@/lib/types";
import {
  clearPrivatePrompts,
  listPrivatePrompts,
  savePrivatePrompt,
  type PrivatePromptRecord,
  type PrivatePromptStatus,
} from "@/lib/privatePromptHistory";

function statusFor(request: ActiveRequest): PrivatePromptStatus {
  if (request.status === "completed") return "completed";
  if (request.status === "failed") return "failed";
  return "running";
}

function statusLabel(status: PrivatePromptStatus): string {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "interrupted") return "Interrupted";
  return "Running";
}

function statusClass(status: PrivatePromptStatus): string {
  if (status === "completed") return "badge-online";
  if (status === "running") return "badge-busy";
  return "badge-offline";
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PrivatePromptHistory({ request }: { request: ActiveRequest }) {
  const [records, setRecords] = useState<PrivatePromptRecord[]>([]);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let disposed = false;
    void listPrivatePrompts()
      .then(async (stored) => {
        const recovered = stored.map((item) =>
          item.status === "running"
            ? { ...item, status: "interrupted" as const, finishedAt: Date.now() }
            : item,
        );
        await Promise.all(
          recovered
            .filter((item, index) => item !== stored[index])
            .map((item) => savePrivatePrompt(item)),
        );
        if (!disposed) {
          setRecords((current) => {
            const currentIds = new Set(current.map((item) => item.id));
            return [...current, ...recovered.filter((item) => !currentIds.has(item.id))]
              .sort((a, b) => b.startedAt - a.startedAt)
              .slice(0, 100);
          });
        }
      })
      .catch(() => {
        if (!disposed) setStorageAvailable(false);
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!request.historyId || !request.prompt || request.status === "idle") return;

    const record: PrivatePromptRecord = {
      id: request.historyId,
      requestId: request.id,
      prompt: request.prompt,
      supplierId: request.supplierId,
      supplierName: request.supplierName,
      status: statusFor(request),
      startedAt: request.startedAt ?? Date.now(),
      finishedAt: request.finishedAt,
      latencyMs:
        request.startedAt && request.finishedAt
          ? request.finishedAt - request.startedAt
          : undefined,
      error: request.error,
    };

    setRecords((current) =>
      [record, ...current.filter((item) => item.id !== record.id)]
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, 100),
    );
    saveQueue.current = saveQueue.current
      .then(() => savePrivatePrompt(record))
      .catch(() => setStorageAvailable(false));
  }, [request]);

  useEffect(() => {
    if (!confirmClear) return;
    const timer = window.setTimeout(() => setConfirmClear(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmClear]);

  const completedCount = useMemo(
    () => records.filter((record) => record.status === "completed").length,
    [records],
  );

  const clear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    try {
      await saveQueue.current;
      await clearPrivatePrompts();
      setRecords([]);
      setConfirmClear(false);
    } catch {
      setStorageAvailable(false);
    }
  };

  return (
    <section className="panel overflow-hidden" aria-labelledby="private-history-title">
      <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <div className="eyebrow">Private to this browser</div>
          <h2 id="private-history-title" className="mt-1.5 text-[16px] font-semibold text-ink">
            My prompt history
          </h2>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted">
            Saves the prompt, assigned supplier, status, and timing only in this browser profile. The selected supplier still receives the prompt to process it.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="badge badge-online">
            <span className="dot" />
            {completedCount} completed
          </span>
          {records.length > 0 ? (
            <button className="btn btn-ghost" type="button" onClick={clear}>
              {confirmClear ? "Confirm clear" : "Clear history"}
            </button>
          ) : null}
        </div>
      </div>

      {!storageAvailable ? (
        <div className="border-t border-line bg-panel-2 px-5 py-4 text-[13px] text-danger sm:px-6">
          Private storage is unavailable in this browser. New prompts will still run, but they will not be saved here.
        </div>
      ) : records.length === 0 ? (
        <div className="border-t border-line bg-panel-2 px-5 py-6 text-[13px] text-muted sm:px-6">
          Your next Playground prompt will appear here with the supplier that handled it.
        </div>
      ) : (
        <div className="divide-y divide-line border-t border-line">
          {records.map((record) => (
            <article className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:px-6" key={record.id}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge ${statusClass(record.status)}`}>
                    <span className={`dot ${record.status === "running" ? "pulse" : ""}`} />
                    {statusLabel(record.status)}
                  </span>
                  <span className="text-[12px] text-dim">{formatDate(record.startedAt)}</span>
                  {record.latencyMs !== undefined ? (
                    <span className="tnum text-[12px] text-dim">{record.latencyMs.toLocaleString()} ms</span>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink">
                  {record.prompt}
                </p>
                {record.error ? <p className="mt-2 text-[12px] text-danger">{record.error}</p> : null}
              </div>
              <div className="rounded-[9px] border border-line bg-panel-2 px-3.5 py-3">
                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-dim">Assigned supplier</div>
                <div className="mt-1.5 text-[13px] font-medium text-ink">
                  {record.supplierName ?? (record.status === "running" ? "Selecting…" : "Not assigned")}
                </div>
                {record.requestId ? (
                  <div className="mt-1 truncate font-mono text-[11px] text-dim" title={record.requestId}>
                    {record.requestId}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
