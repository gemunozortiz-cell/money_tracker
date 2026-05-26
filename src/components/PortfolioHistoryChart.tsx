/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState, useRef } from "react";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

export interface HistoryPoint {
  date: string;
  netWorth: number;
  liquidity: number;
  investments: number;
  debt: number;
}

interface PortfolioHistoryChartProps {
  series: HistoryPoint[];
  variant?: "compact" | "full";
  defaultDays?: 7 | 30 | 90;
  onChangeDays?: (days: 7 | 30 | 90) => void;
  loading?: boolean;
}

const RANGES: { label: string; days: 7 | 30 | 90 }[] = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function formatCurrency(v: number, compact = false): string {
  if (compact) {
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
    return `$${Math.round(v)}`;
  }
  return `$${v.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export function PortfolioHistoryChart({ series, variant = "full", defaultDays = 30, onChangeDays, loading }: PortfolioHistoryChartProps) {
  const [days, setDays] = useState<7 | 30 | 90>(defaultDays);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleSetDays = (d: 7 | 30 | 90) => {
    setDays(d);
    onChangeDays?.(d);
  };

  const filtered = useMemo(() => {
    if (series.length === 0) return [];
    return series.slice(-days);
  }, [series, days]);

  const stats = useMemo(() => {
    if (filtered.length < 2) return null;
    const first = filtered[0].netWorth;
    const last = filtered[filtered.length - 1].netWorth;
    const change = last - first;
    const changePct = first !== 0 ? (change / Math.abs(first)) * 100 : 0;
    const max = Math.max(...filtered.map(p => p.netWorth));
    const min = Math.min(...filtered.map(p => p.netWorth));
    return { first, last, change, changePct, max, min };
  }, [filtered]);

  // SVG geometry
  const width = variant === "compact" ? 600 : 800;
  const height = variant === "compact" ? 140 : 240;
  const padX = variant === "compact" ? 20 : 40;
  const padTop = 20;
  const padBottom = variant === "compact" ? 24 : 32;

  const { linePath, areaPath, points } = useMemo(() => {
    if (filtered.length === 0) return { linePath: "", areaPath: "", points: [] as { x: number; y: number; data: HistoryPoint }[] };
    const values = filtered.map(p => p.netWorth);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const range = maxV - minV > 0 ? maxV - minV : 1;
    const usableH = height - padTop - padBottom;

    const pts = filtered.map((d, i) => {
      const x = padX + (i * (width - padX * 2)) / Math.max(filtered.length - 1, 1);
      const y = padTop + usableH - ((d.netWorth - minV) / range) * usableH;
      return { x, y, data: d };
    });
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
    const area = `${line} L ${pts[pts.length - 1].x} ${height - padBottom} L ${pts[0].x} ${height - padBottom} Z`;
    return { linePath: line, areaPath: area, points: pts };
  }, [filtered, width, height, padX, padTop, padBottom]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xRel = ((e.clientX - rect.left) / rect.width) * width;
    let closestIdx = 0;
    let closestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - xRel);
      if (d < closestDist) { closestDist = d; closestIdx = i; }
    });
    setHoverIdx(closestIdx);
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!svgRef.current || points.length === 0) return;
    const touch = e.touches[0];
    if (!touch) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xRel = ((touch.clientX - rect.left) / rect.width) * width;
    let closestIdx = 0;
    let closestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - xRel);
      if (d < closestDist) { closestDist = d; closestIdx = i; }
    });
    setHoverIdx(closestIdx);
  };

  const hover = hoverIdx != null ? points[hoverIdx] : null;
  const isPositive = stats ? stats.change >= 0 : true;

  // ===== COMPACT (HomeDashboard) =====
  if (variant === "compact") {
    return (
      <div className="bg-white/[0.04] rounded-2xl border border-white/10 p-3.5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] uppercase font-extrabold text-indigo-300 tracking-wider font-display">
              Patrimonio últimos {days} días
            </span>
          </div>
          {stats && (
            <span className={`text-[10px] font-bold font-mono ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
              {isPositive ? "+" : ""}{formatCurrency(stats.change, true)} ({stats.changePct.toFixed(1)}%)
            </span>
          )}
        </div>

        {loading && filtered.length === 0 ? (
          <div className="h-[100px] flex items-center justify-center text-[10px] text-slate-500">Cargando...</div>
        ) : filtered.length < 2 ? (
          <div className="h-[100px] flex items-center justify-center text-[10px] text-slate-500">Datos insuficientes</div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto"
            preserveAspectRatio="none"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverIdx(null)}
            onTouchMove={handleTouchMove}
            onTouchEnd={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id="histGradCompact" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isPositive ? "#10b981" : "#f43f5e"} stopOpacity="0.4" />
                <stop offset="100%" stopColor={isPositive ? "#10b981" : "#f43f5e"} stopOpacity="0" />
              </linearGradient>
            </defs>
            {areaPath && <path d={areaPath} fill="url(#histGradCompact)" />}
            {linePath && (
              <path d={linePath} fill="none" stroke={isPositive ? "#10b981" : "#f43f5e"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {hover && (
              <>
                <line x1={hover.x} y1={padTop} x2={hover.x} y2={height - padBottom} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="2,2" />
                <circle cx={hover.x} cy={hover.y} r="4" fill="#0c1221" stroke={isPositive ? "#10b981" : "#f43f5e"} strokeWidth="2" />
              </>
            )}
          </svg>
        )}

        {hover && (
          <div className="text-[10px] text-slate-400 mt-1 flex justify-between font-mono">
            <span>{formatDateShort(hover.data.date)}</span>
            <span className="font-bold text-white">{formatCurrency(hover.data.netWorth, true)}</span>
          </div>
        )}
      </div>
    );
  }

  // ===== FULL (Cuentas tab) =====
  return (
    <div className="bg-white/[0.04] rounded-3xl border border-white/10 p-5 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-white text-sm font-display">Patrimonio histórico</h3>
          </div>
          {stats && (
            <p className="text-[10px] text-slate-400 mt-1">
              {formatDateShort(filtered[0]?.date || "")} → {formatDateShort(filtered[filtered.length - 1]?.date || "")}
            </p>
          )}
        </div>

        <div className="flex gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
          {RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => handleSetDays(r.days)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors ${
                days === r.days
                  ? "bg-indigo-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Headline numbers */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Actual</span>
            <span className="text-base font-black text-white font-mono block mt-0.5">
              {formatCurrency(stats.last)}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Cambio</span>
            <span className={`text-base font-black font-mono block mt-0.5 flex items-center gap-1 ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
              {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {isPositive ? "+" : ""}{formatCurrency(stats.change, true)}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">%</span>
            <span className={`text-base font-black font-mono block mt-0.5 ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
              {isPositive ? "+" : ""}{stats.changePct.toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {/* Chart */}
      {loading && filtered.length === 0 ? (
        <div className="h-[240px] flex items-center justify-center text-xs text-slate-500">Cargando precios históricos...</div>
      ) : filtered.length < 2 ? (
        <div className="h-[240px] flex items-center justify-center text-xs text-slate-500">
          Sin suficiente histórico. Vuelve mañana o agrega instrumentos.
        </div>
      ) : (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="histGradFull" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isPositive ? "#10b981" : "#f43f5e"} stopOpacity="0.35" />
              <stop offset="100%" stopColor={isPositive ? "#10b981" : "#f43f5e"} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Horizontal grid */}
          {[0, 0.5, 1].map((t, i) => (
            <line
              key={i}
              x1={padX}
              y1={padTop + t * (height - padTop - padBottom)}
              x2={width - padX}
              y2={padTop + t * (height - padTop - padBottom)}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              strokeDasharray={i === 2 ? "none" : "3,3"}
            />
          ))}
          {areaPath && <path d={areaPath} fill="url(#histGradFull)" />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={isPositive ? "#10b981" : "#f43f5e"}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {/* X-axis labels at start/middle/end */}
          {filtered.length > 0 && (
            <>
              <text x={padX} y={height - 8} className="text-[10px] fill-slate-500 font-mono">
                {formatDateShort(filtered[0].date)}
              </text>
              <text x={width / 2} y={height - 8} textAnchor="middle" className="text-[10px] fill-slate-500 font-mono">
                {formatDateShort(filtered[Math.floor(filtered.length / 2)].date)}
              </text>
              <text x={width - padX} y={height - 8} textAnchor="end" className="text-[10px] fill-slate-500 font-mono">
                {formatDateShort(filtered[filtered.length - 1].date)}
              </text>
            </>
          )}
          {hover && (
            <>
              <line x1={hover.x} y1={padTop} x2={hover.x} y2={height - padBottom} stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3,3" />
              <circle cx={hover.x} cy={hover.y} r="5" fill="#0c1221" stroke={isPositive ? "#10b981" : "#f43f5e"} strokeWidth="2.5" />
            </>
          )}
        </svg>
      )}

      {/* Hover tooltip card */}
      {hover && (
        <div className="mt-3 bg-white/5 rounded-xl border border-white/10 p-3 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-white font-mono">{formatDateShort(hover.data.date)}</span>
            <span className="font-black text-white font-mono">{formatCurrency(hover.data.netWorth)} MXN</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <span className="text-emerald-400 font-bold block">Liquidez</span>
              <span className="text-slate-300 font-mono">{formatCurrency(hover.data.liquidity, true)}</span>
            </div>
            <div>
              <span className="text-amber-400 font-bold block">Inversiones</span>
              <span className="text-slate-300 font-mono">{formatCurrency(hover.data.investments, true)}</span>
            </div>
            <div>
              <span className="text-rose-400 font-bold block">Deuda</span>
              <span className="text-slate-300 font-mono">-{formatCurrency(hover.data.debt, true)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
