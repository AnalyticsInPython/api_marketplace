"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Completion, LoadSample } from "@/lib/types";

const VB_W = 1000;
const VB_H = 300;
const PADL = 46;
const PADT = 14;
const PADB = 26;

type Show = "active" | "latency" | "both";

function niceCeil(v: number) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function fmtClock(t: number) {
  return new Date(t).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ActivityChart({
  series,
  completions,
  totalNodes,
  windowSec,
  show,
}: {
  series: LoadSample[];
  completions: Completion[];
  totalNodes: number;
  windowSec: number;
  show: Show;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverT, setHoverT] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const showActive = show === "active" || show === "both";
  const showLatency = show === "latency" || show === "both";
  const PADR = showLatency ? 46 : 20;

  const plotLeft = PADL;
  const plotRight = VB_W - PADR;
  const plotTop = PADT;
  const plotBottom = VB_H - PADB;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  const model = useMemo(() => {
    const now = series.length ? Math.max(series[series.length - 1].t, Date.now()) : Date.now();
    const start = now - windowSec * 1000;

    const visible = series.filter((s) => s.t >= start - 4000);
    const prev = [...series].reverse().find((s) => s.t < start);
    const startLoad = visible.length ? (prev?.load ?? visible[0].load) : (prev?.load ?? 0);
    const curLoad = series.length ? series[series.length - 1].load : 0;

    const pts: LoadSample[] = [
      { t: start, load: startLoad },
      ...visible.filter((s) => s.t >= start),
      { t: now, load: curLoad },
    ];

    const maxLoad = Math.max(2, totalNodes || 2);
    const visComp = completions.filter((c) => c.t >= start && c.t <= now);
    const maxMs = niceCeil(Math.max(4000, ...visComp.map((c) => c.latencyMs)));

    const x = (t: number) =>
      plotLeft + Math.max(0, Math.min(1, (t - start) / (now - start))) * plotW;
    const yL = (load: number) => plotBottom - (load / maxLoad) * plotH;
    const yR = (ms: number) => plotBottom - (ms / maxMs) * plotH;

    // stepped path for the active-load line
    let line = `M ${x(pts[0].t)} ${yL(pts[0].load)}`;
    for (let i = 1; i < pts.length; i++) {
      line += ` L ${x(pts[i].t)} ${yL(pts[i - 1].load)} L ${x(pts[i].t)} ${yL(pts[i].load)}`;
    }
    const area = `${line} L ${x(pts[pts.length - 1].t)} ${plotBottom} L ${x(pts[0].t)} ${plotBottom} Z`;

    // latency polyline
    const latPts = visComp.map((c) => ({ x: x(c.t), y: yR(c.latencyMs), ...c }));
    const latLine = latPts.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");

    // x ticks
    const ticks = Array.from({ length: 5 }, (_, i) => start + ((now - start) * i) / 4);

    return { now, start, maxLoad, maxMs, x, yL, yR, line, area, latPts, latLine, ticks, curLoad };
  }, [series, completions, totalNodes, windowSec, plotW, plotH, plotBottom, plotLeft, plotRight, plotTop]);

  const onMove = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const vbX = ((e.clientX - rect.left) / rect.width) * VB_W;
    const frac = (vbX - plotLeft) / plotW;
    if (frac < 0 || frac > 1) {
      setHoverT(null);
      return;
    }
    setHoverT(model.start + frac * (model.now - model.start));
  };

  const hover = useMemo(() => {
    if (hoverT == null) return null;
    // nearest active sample value at hoverT (step = value of last sample <= t)
    const loadSample = [...series].reverse().find((s) => s.t <= hoverT);
    const load = loadSample?.load ?? 0;
    const nearComp = model.latPts.length
      ? model.latPts.reduce((a, b) =>
          Math.abs(b.t - hoverT) < Math.abs(a.t - hoverT) ? b : a,
        )
      : null;
    const hx = model.x(hoverT);
    return { hx, load, nearComp };
  }, [hoverT, series, model]);

  const yTicks = [0, model.maxLoad / 2, model.maxLoad];
  const yRTicks = showLatency ? [0, model.maxMs / 2, model.maxMs] : [];

  if (!mounted) {
    return (
      <div
        className="h-[220px] w-full animate-pulse rounded-lg bg-panel-2 sm:h-[300px]"
        role="status"
        aria-label="Loading network activity chart"
      />
    );
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="h-auto w-full select-none"
      role="img"
      aria-label="Network activity chart showing active requests and request latency over time"
      onMouseMove={onMove}
      onMouseLeave={() => setHoverT(null)}
    >
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* horizontal grid + left labels */}
      {yTicks.map((v, i) => (
        <g key={`yl-${i}`}>
          <line
            x1={plotLeft}
            x2={plotRight}
            y1={model.yL(v)}
            y2={model.yL(v)}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <text
            x={plotLeft - 8}
            y={model.yL(v) + 3.5}
            textAnchor="end"
            fontSize="11"
            fontFamily="var(--font-mono)"
            fill="var(--text-dim)"
          >
            {Math.round(v)}
          </text>
        </g>
      ))}

      {/* right latency labels */}
      {yRTicks.map((v, i) => (
        <text
          key={`yr-${i}`}
          x={plotRight + 8}
          y={model.yR(v) + 3.5}
          textAnchor="start"
          fontSize="11"
          fontFamily="var(--font-mono)"
          fill="var(--accent-2)"
          opacity={0.75}
        >
          {(v / 1000).toFixed(1)}s
        </text>
      ))}

      {/* x labels */}
      {model.ticks.map((t, i) => (
        <text
          key={`x-${i}`}
          x={model.x(t)}
          y={VB_H - 8}
          textAnchor={i === 0 ? "start" : i === model.ticks.length - 1 ? "end" : "middle"}
          fontSize="11"
          fontFamily="var(--font-mono)"
          fill="var(--text-dim)"
        >
          {fmtClock(t)}
        </text>
      ))}

      {/* active-load series */}
      {showActive && (
        <>
          <path d={model.area} fill="url(#areaFill)" />
          <path
            d={model.line}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="5 5"
            strokeLinejoin="round"
          />
        </>
      )}

      {/* latency series */}
      {showLatency && (
        <>
          {model.latPts.length > 1 && (
            <path d={model.latLine} fill="none" stroke="var(--accent-2)" strokeWidth={1.6} opacity={0.85} />
          )}
          {model.latPts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={2.6} fill="var(--accent-2)" />
          ))}
        </>
      )}

      {/* hover guide + callout */}
      {hover && (
        <>
          <line
            x1={hover.hx}
            x2={hover.hx}
            y1={plotTop}
            y2={plotBottom}
            stroke="var(--border-strong)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          {showActive && (
            <circle cx={hover.hx} cy={model.yL(hover.load)} r={3.6} fill="var(--accent)" stroke="var(--bg)" strokeWidth={1.5} />
          )}
          {showLatency && hover.nearComp && (
            <circle cx={hover.nearComp.x} cy={hover.nearComp.y} r={3.6} fill="var(--accent-2)" stroke="var(--bg)" strokeWidth={1.5} />
          )}
          {(() => {
            const boxW = 150;
            const boxH = showLatency && hover.nearComp ? 54 : 38;
            const bx = Math.min(Math.max(hover.hx + 10, plotLeft), plotRight - boxW);
            return (
              <g transform={`translate(${bx}, ${plotTop + 6})`}>
                <rect width={boxW} height={boxH} rx={7} fill="var(--panel-3)" stroke="var(--border-strong)" />
                <text x={10} y={16} fontSize="10.5" fontFamily="var(--font-mono)" fill="var(--text-dim)">
                  {fmtClock(hoverT!)}
                </text>
                {showActive && (
                  <text x={10} y={31} fontSize="12" fill="var(--text)">
                    <tspan fill="var(--accent)">●</tspan> {hover.load} active
                  </text>
                )}
                {showLatency && hover.nearComp && (
                  <text x={10} y={showActive ? 47 : 31} fontSize="12" fill="var(--text)">
                    <tspan fill="var(--accent-2)">●</tspan> {(hover.nearComp.latencyMs / 1000).toFixed(2)}s latency
                  </text>
                )}
              </g>
            );
          })()}
        </>
      )}
    </svg>
  );
}
