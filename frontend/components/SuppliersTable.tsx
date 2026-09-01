"use client";

import { useState } from "react";
import type { Supplier } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { IconPin } from "./icons";
import { relativeTime } from "@/lib/format";

export function SuppliersTable({
  suppliers,
  activeSupplierId,
}: {
  suppliers: Supplier[];
  activeSupplierId?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allChecked = suppliers.length > 0 && suppliers.every((s) => selected.has(s.id));
  const toggleAll = () =>
    setSelected(allChecked ? new Set() : new Set(suppliers.map((s) => s.id)));

  return (
    <div className="panel overflow-hidden">
      <div className="scroll-thin overflow-x-auto">
        <table className="dtable min-w-[720px]">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input className="check" type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th>Node</th>
              <th>Model</th>
              <th>Host</th>
              <th>Status</th>
              <th>Load</th>
              <th className="num">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted" style={{ textAlign: "center", padding: "34px" }}>
                  No suppliers match. Start a supplier agent to register a node.
                </td>
              </tr>
            ) : (
              suppliers.map((s) => {
                const active = s.id === activeSupplierId && s.status === "busy";
                return (
                  <tr key={s.id} className={selected.has(s.id) ? "selected" : ""}>
                    <td>
                      <input
                        className="check"
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s.id)}
                        aria-label={`Select ${s.name}`}
                      />
                    </td>
                    <td>
                      <span className="flex items-center gap-2">
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-accent pulse" />}
                        <span className="font-medium text-ink">{s.name}</span>
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-[12px] text-muted">{s.model}</span>
                    </td>
                    <td className="muted">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-online">
                          <IconPin size={13} />
                        </span>
                        {s.name}.local
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-[5px] w-7 rounded-full"
                          style={{ background: s.activeRequests > 0 ? "var(--busy)" : "var(--border-strong)" }}
                        />
                        <span className="tnum text-[12px] text-muted">{s.activeRequests} / 1</span>
                      </span>
                    </td>
                    <td className="num muted">{relativeTime(s.lastSeen)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
