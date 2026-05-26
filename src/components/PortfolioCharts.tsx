/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InstrumentType } from "../types";

interface PortfolioChartsProps {
  tasaDiariaValue: number;
  btcValue: number;
  customAssetsValue?: number;
  instrumentsList: { name: string; currentBalance: number; annualRate?: number }[];
  totalInterestEarned: number;
}

export function PortfolioCharts({ tasaDiariaValue, btcValue, customAssetsValue = 0, instrumentsList, totalInterestEarned }: PortfolioChartsProps) {
  const totalAssets = tasaDiariaValue + btcValue + customAssetsValue;
  const tasaDiariaPercent = totalAssets > 0 ? (tasaDiariaValue / totalAssets) * 100 : 0;
  const btcPercent = totalAssets > 0 ? (btcValue / totalAssets) * 100 : 0;
  const customPercent = totalAssets > 0 ? (customAssetsValue / totalAssets) * 100 : 0;

  // Let's project compound interest into the future (365 days)
  // Calculate combined principal and average weighted annual rate
  const totalPrincipal = instrumentsList.reduce((acc, inst) => acc + inst.currentBalance, 0);
  const weightedRateSum = instrumentsList.reduce((acc, inst) => acc + (inst.currentBalance * (inst.annualRate || 0)), 0);
  const avgRate = totalPrincipal > 0 ? (weightedRateSum / totalPrincipal) : 0;

  const projectionMonths = [
    { label: "Hoy", days: 0 },
    { label: "+30 d", days: 30 },
    { label: "+90 d", days: 90 },
    { label: "+180 d", days: 180 },
    { label: "+270 d", days: 270 },
    { label: "+365 d", days: 365 },
  ];

  const projectionData = projectionMonths.map(p => {
    // Compound interest formula: P * (1 + r / 365)^t
    const dailyRate = (avgRate / 100) / 365;
    const projectedBal = totalPrincipal * Math.pow(1 + dailyRate, p.days);
    const gains = projectedBal - totalPrincipal;
    return {
      label: p.label,
      days: p.days,
      balance: Math.round(projectedBal),
      gains: Math.round(gains)
    };
  });

  // Calculate coordinates for responsive projection line chart
  const paddingX = 40;
  const paddingY = 30;
  const chartW = 480;
  const chartH = 180;
  
  const minVal = totalPrincipal;
  const maxVal = projectionData[projectionData.length - 1].balance || 1000;
  const valRange = maxVal - minVal > 0 ? maxVal - minVal : 1;

  const points = projectionData.map((d, index) => {
    const x = paddingX + (index * (chartW - paddingX * 2)) / (projectionData.length - 1);
    const normalizedY = (d.balance - minVal) / valRange; // 0 to 1
    const y = chartH - paddingY - normalizedY * (chartH - paddingY * 2);
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${chartH - paddingY} L ${points[0].x} ${chartH - paddingY} Z`
    : "";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8" id="charts-container">
      {/* Asset Distribution Chart */}
      <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/10 p-6 shadow-xl flex flex-col justify-between relative z-10" id="distribution-card">
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 font-display">
            Distribución del Portafolio
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-white font-extrabold text-xl font-display">
              ${totalAssets.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 font-medium border border-emerald-500/25">
              Activo Total
            </span>
          </div>
        </div>

        {totalAssets === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <div className="w-16 h-16 rounded-full bg-white/[0.01] flex items-center justify-center border border-dashed border-white/10 mb-2">
              📊
            </div>
            <p className="text-xs font-medium text-slate-400">Sin saldo o transacciones para graficar</p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6 mt-6">
            {/* Elegant SVG Donut */}
            <div className="relative w-32 h-32 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90 animate-fade-in">
                {/* Background Ring */}
                <circle cx="18" cy="18" r="14.3" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="3.4" />
                
                {/* Daily Compound segment (Blue) */}
                {tasaDiariaPercent > 0 && (
                  <circle
                    cx="18"
                    cy="18"
                    r="14.3"
                    fill="none"
                    stroke="#10B981" /* emerald-500 */
                    strokeWidth="3.5"
                    strokeDasharray={`${tasaDiariaPercent} ${100 - tasaDiariaPercent}`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                )}

                {/* Bitcoin segment (Orange) */}
                {btcPercent > 0 && (
                  <circle
                    cx="18"
                    cy="18"
                    r="14.3"
                    fill="none"
                    stroke="#F59E0B" /* amber-500 */
                    strokeWidth="3.5"
                    strokeDasharray={`${btcPercent} ${100 - btcPercent}`}
                    strokeDashoffset={`-${tasaDiariaPercent}`}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                )}

                {/* Custom Variable Assets segment (Indigo) */}
                {customPercent > 0 && (
                  <circle
                    cx="18"
                    cy="18"
                    r="14.3"
                    fill="none"
                    stroke="#6366F1" /* indigo-500 */
                    strokeWidth="3.5"
                    strokeDasharray={`${customPercent} ${100 - customPercent}`}
                    strokeDashoffset={`-${tasaDiariaPercent + btcPercent}`}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                )}
              </svg>
              {/* Inner Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-semibold text-slate-450 uppercase tracking-wider font-display">Fórmula</span>
                <span className="text-sm font-black text-white font-display">MXN</span>
              </div>
            </div>

            {/* Legends & Percentages */}
            <div className="flex-1 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block" />
                    <span className="text-xs font-semibold text-slate-200">Tasa Diaria</span>
                  </div>
                  <span className="text-xs font-extrabold text-white font-display">{tasaDiariaPercent.toFixed(1)}%</span>
                </div>
                <div className="text-[11px] text-slate-400 ml-4.5 font-mono">
                  ${tasaDiariaValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block" />
                    <span className="text-xs font-semibold text-slate-200">Bitcoin</span>
                  </div>
                  <span className="text-xs font-extrabold text-white font-display">{btcPercent.toFixed(1)}%</span>
                </div>
                <div className="text-[11px] text-slate-400 ml-4.5 font-mono">
                  ${btcValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN
                </div>
              </div>

              {customAssetsValue > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 block" />
                      <span className="text-xs font-semibold text-slate-200">Renta Variable (SPY/Stocks)</span>
                    </div>
                    <span className="text-xs font-extrabold text-white font-display">{customPercent.toFixed(1)}%</span>
                  </div>
                  <div className="text-[11px] text-slate-400 ml-4.5 font-mono">
                    ${customAssetsValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Daily Compound Projection Chart (Linear Area Projection) */}
      <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/10 p-6 shadow-xl flex flex-col justify-between relative z-10" id="projections-card">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-display">
              Proyección de Interés Compuesto
            </h3>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300">
              Tasa Promedio: {avgRate.toFixed(2)}% anual
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Escenario de acumulación de rendimiento diario de tu capital a 12 meses
          </p>
        </div>

        {totalPrincipal === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <div className="w-16 h-16 rounded-full bg-white/[0.01] flex items-center justify-center border border-dashed border-white/10 mb-2">
              📈
            </div>
            <p className="text-xs text-center text-slate-400">Agrega un instrumento de tasa diaria para ver su proyección de crecimiento diario</p>
          </div>
        ) : (
          <div className="mt-4" id="projection-chart">
            <div className="relative">
              {/* SVG Area Line Chart */}
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto overflow-visible">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.00" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1={paddingX} y1={paddingY} x2={chartW - paddingX} y2={paddingY} stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" strokeDasharray="3,3" />
                <line x1={paddingX} y1={chartH / 2} x2={chartW - paddingX} y2={chartH / 2} stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" strokeDasharray="3,3" />
                <line x1={paddingX} y1={chartH - paddingY} x2={chartW - paddingX} y2={chartH - paddingY} stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />

                {/* Shaded Area */}
                {areaPath && <path d={areaPath} fill="url(#chartGrad)" />}

                {/* Primary Data Line */}
                {linePath && <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

                {/* Interaction Hotspots (Circles) */}
                {points.map((p, index) => (
                  <g key={index} className="group cursor-pointer">
                    <circle cx={p.x} cy={p.y} r="5" fill="#0c1221" stroke="#6366f1" strokeWidth="2.5" />
                    {/* Tiny responsive floating tag */}
                    <text x={p.x} y={p.y - 12} textAnchor="middle" className="text-[10px] font-bold fill-indigo-300 opacity-60 group-hover:opacity-100 transition-opacity font-mono">
                      +${p.gains.toLocaleString("es-MX")}
                    </text>
                    
                    {/* Bottom Labels */}
                    <text x={p.x} y={chartH - 8} textAnchor="middle" className="text-[10px] fill-slate-450 font-medium font-sans">
                      {p.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            {/* Quick Summary Numbers */}
            <div className="grid grid-cols-2 gap-4 mt-2 pt-2 border-t border-white/10 text-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-display">Interés Ganado a +1 Año</span>
                <span className="text-sm font-bold text-indigo-300 font-mono block mt-1">
                  +${projectionData[5].gains.toLocaleString("es-MX")} MXN
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-display">Saldo Total Proyectado</span>
                <span className="text-sm font-bold text-slate-100 font-mono block mt-1">
                  ${projectionData[5].balance.toLocaleString("es-MX")} MXN
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
