/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from "react";
import {
  PiggyBank, CreditCard, TrendingUp, AlertTriangle, Zap, Sparkles,
  Bitcoin, DollarSign, Newspaper, ChevronRight
} from "lucide-react";
import { TabId } from "./BottomTabBar";
import { PortfolioHistoryChart, HistoryPoint } from "./PortfolioHistoryChart";

interface HomeDashboardProps {
  netWorthMxn: number;
  totalTasaDiariaMxn: number;
  totalInteresesGanadosMxn: number;
  totalBtcValuationMxn: number;
  totalCustomAssetsValuationMxn: number;
  totalDeudaTdcMxn: number;
  btcPriceMxn: number;
  btcPriceUsd: number;
  btcIsLive: boolean;
  usdMxn: number;
  fxIsLive: boolean;
  simulatedDate: Date;
  computedCreditCards: any[];
  revolutExcess: number;
  preferredTargetName?: string;
  onOptimizeRevolut: () => void;
  onNavigate: (tab: TabId) => void;
  latestNewsTitle?: string;
  latestNewsSource?: string;
  totalInstruments: number;
  totalCardsCount: number;
  historicalSeries: HistoryPoint[];
  historicalLoading: boolean;
}

function daysBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// Returns next due date for the card based on its day-of-month + offset
function nextDueDate(card: any, today: Date): Date {
  const offset = card.nextPeriodOffsetMonths || 0;
  const d = new Date(today.getFullYear(), today.getMonth() + offset, card.paymentDueDay);
  if (d < today) d.setMonth(d.getMonth() + 1);
  return d;
}

export function HomeDashboard(props: HomeDashboardProps) {
  const {
    netWorthMxn, totalTasaDiariaMxn, totalInteresesGanadosMxn,
    totalBtcValuationMxn, totalCustomAssetsValuationMxn, totalDeudaTdcMxn,
    btcPriceMxn, btcPriceUsd, btcIsLive, usdMxn, fxIsLive,
    simulatedDate, computedCreditCards, revolutExcess, preferredTargetName,
    onOptimizeRevolut, onNavigate, latestNewsTitle, latestNewsSource,
    totalInstruments, totalCardsCount, historicalSeries, historicalLoading
  } = props;

  // Compute actionable alerts
  const alerts = useMemo(() => {
    const list: { id: string; severity: "high" | "medium" | "info"; icon: any; title: string; body: string; action?: { label: string; tab: TabId } }[] = [];

    // Cards near due date
    computedCreditCards.forEach(card => {
      if (card.currentBalance > 0) {
        const due = nextDueDate(card, simulatedDate);
        const days = daysBetween(simulatedDate, due);
        if (days <= 7 && days >= 0) {
          list.push({
            id: `card-due-${card.id}`,
            severity: days <= 3 ? "high" : "medium",
            icon: CreditCard,
            title: `${card.name} vence en ${days} día${days === 1 ? "" : "s"}`,
            body: `Saldo $${card.currentBalance.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN. Págala completa para no generar intereses (CAT >70%).`,
            action: { label: "Ver tarjeta", tab: "tarjetas" }
          });
        }
      }
    });

    // Revolut excess
    if (revolutExcess > 100 && preferredTargetName) {
      list.push({
        id: "revolut-excess",
        severity: "medium",
        icon: Zap,
        title: "Excedente en Revolut detectado",
        body: `$${revolutExcess.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN están al 7% en lugar de irse a ${preferredTargetName} con tasa mayor.`,
        action: { label: "Optimizar", tab: "cuentas" }
      });
    }

    // Debt vs liquidity ratio
    if (totalDeudaTdcMxn > 0 && totalDeudaTdcMxn > totalTasaDiariaMxn * 0.1) {
      list.push({
        id: "debt-warning",
        severity: "medium",
        icon: AlertTriangle,
        title: "Tu deuda excede el 10% de tu liquidez",
        body: `Considera pagar tarjetas antes de seguir invirtiendo. Cualquier interés moratorio supera lo que ganas en Nu/Revolut.`,
        action: { label: "Ver deuda", tab: "tarjetas" }
      });
    }

    return list;
  }, [computedCreditCards, simulatedDate, revolutExcess, preferredTargetName, totalDeudaTdcMxn, totalTasaDiariaMxn]);

  const hasOptimization = revolutExcess > 100 && preferredTargetName;

  return (
    <div className="space-y-5 pb-4">
      {/* HERO: Net worth */}
      <section className="bg-gradient-to-br from-indigo-500/15 via-indigo-500/5 to-emerald-500/10 rounded-3xl p-5 border border-indigo-500/25 shadow-xl relative overflow-hidden">
        <div className="absolute right-[-30px] top-[-30px] w-40 h-40 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <span className="text-[10px] uppercase font-extrabold tracking-widest text-indigo-300 font-display">Patrimonio neto</span>
          <h1 className="text-4xl font-black text-white font-display mt-1 tracking-tight">
            ${netWorthMxn.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
            <span className="text-base text-slate-400 font-bold ml-1">MXN</span>
          </h1>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
              <span className="text-[9px] uppercase font-bold text-emerald-300 tracking-wider block">Liquidez</span>
              <span className="text-sm font-black text-white font-mono block mt-0.5">
                ${(totalTasaDiariaMxn / 1000).toFixed(1)}k
              </span>
              <span className="text-[9px] text-emerald-400 font-bold">+${(totalInteresesGanadosMxn).toFixed(0)}</span>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
              <span className="text-[9px] uppercase font-bold text-amber-300 tracking-wider block">Inversiones</span>
              <span className="text-sm font-black text-white font-mono block mt-0.5">
                ${((totalBtcValuationMxn + totalCustomAssetsValuationMxn) / 1000).toFixed(1)}k
              </span>
              <span className="text-[9px] text-amber-400 font-bold">BTC+RV</span>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
              <span className="text-[9px] uppercase font-bold text-rose-300 tracking-wider block">Deuda TDC</span>
              <span className="text-sm font-black text-white font-mono block mt-0.5">
                ${(totalDeudaTdcMxn / 1000).toFixed(1)}k
              </span>
              <span className="text-[9px] text-rose-400 font-bold">{totalCardsCount} tarj.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Historical net worth sparkline */}
      <PortfolioHistoryChart
        series={historicalSeries}
        variant="compact"
        defaultDays={30}
        loading={historicalLoading}
      />

      {/* Real-time tickers row */}
      <section className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onNavigate("inversiones")}
          className="bg-white/[0.04] rounded-2xl p-3 border border-white/10 text-left active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Bitcoin className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] uppercase font-extrabold text-amber-300 tracking-wider">BTC/MXN</span>
            </div>
            <span className={`w-1.5 h-1.5 rounded-full ${btcIsLive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
          </div>
          <span className="text-lg font-black text-white font-mono block">
            ${btcPriceMxn.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[10px] text-slate-400 font-mono block">
            ${btcPriceUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD
          </span>
        </button>

        <button
          onClick={() => onNavigate("mercados")}
          className="bg-white/[0.04] rounded-2xl p-3 border border-white/10 text-left active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] uppercase font-extrabold text-emerald-300 tracking-wider">USD/MXN</span>
            </div>
            <span className={`w-1.5 h-1.5 rounded-full ${fxIsLive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
          </div>
          <span className="text-lg font-black text-white font-mono block">
            ${usdMxn.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400 font-mono block">
            {fxIsLive ? "Mercado interbancario" : "Sin conexión"}
          </span>
        </button>
      </section>

      {/* Actionable alerts */}
      {alerts.length > 0 && (
        <section>
          <h3 className="text-[11px] uppercase font-extrabold tracking-widest text-slate-400 font-display mb-2 px-1">
            Atención requerida
          </h3>
          <div className="space-y-2">
            {alerts.map(alert => {
              const Icon = alert.icon;
              const colors = {
                high:   "bg-rose-500/10 border-rose-500/30 text-rose-300",
                medium: "bg-amber-500/10 border-amber-500/30 text-amber-300",
                info:   "bg-indigo-500/10 border-indigo-500/30 text-indigo-300",
              }[alert.severity];

              return (
                <div key={alert.id} className={`rounded-2xl border p-3 ${colors}`}>
                  <div className="flex items-start gap-2.5">
                    <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-extrabold text-white leading-tight">{alert.title}</h4>
                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{alert.body}</p>
                      {alert.action && (
                        <div className="flex items-center gap-2 mt-2">
                          {alert.id === "revolut-excess" ? (
                            <button
                              onClick={onOptimizeRevolut}
                              className="text-[11px] font-bold bg-white/15 hover:bg-white/25 text-white px-2.5 py-1 rounded-lg transition-colors"
                            >
                              Optimizar ahora
                            </button>
                          ) : (
                            <button
                              onClick={() => onNavigate(alert.action!.tab)}
                              className="text-[11px] font-bold bg-white/15 hover:bg-white/25 text-white px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                            >
                              {alert.action.label}
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Quick actions */}
      <section>
        <h3 className="text-[11px] uppercase font-extrabold tracking-widest text-slate-400 font-display mb-2 px-1">
          Atajos
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate("cuentas")}
            className="bg-white/[0.04] rounded-2xl p-4 border border-white/10 text-left active:scale-[0.98] transition-transform"
          >
            <PiggyBank className="w-5 h-5 text-emerald-400 mb-2" />
            <h4 className="text-sm font-extrabold text-white">Cuentas</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">{totalInstruments} instrumento{totalInstruments === 1 ? "" : "s"} diario{totalInstruments === 1 ? "" : "s"}</p>
          </button>

          <button
            onClick={() => onNavigate("inversiones")}
            className="bg-white/[0.04] rounded-2xl p-4 border border-white/10 text-left active:scale-[0.98] transition-transform"
          >
            <TrendingUp className="w-5 h-5 text-amber-400 mb-2" />
            <h4 className="text-sm font-extrabold text-white">Inversiones</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">BTC + acciones</p>
          </button>

          <button
            onClick={() => onNavigate("tarjetas")}
            className="bg-white/[0.04] rounded-2xl p-4 border border-white/10 text-left active:scale-[0.98] transition-transform"
          >
            <CreditCard className="w-5 h-5 text-rose-400 mb-2" />
            <h4 className="text-sm font-extrabold text-white">Tarjetas</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Deuda y vencimientos</p>
          </button>

          <button
            onClick={() => onNavigate("mercados")}
            className="bg-white/[0.04] rounded-2xl p-4 border border-white/10 text-left active:scale-[0.98] transition-transform"
          >
            <Sparkles className="w-5 h-5 text-indigo-400 mb-2" />
            <h4 className="text-sm font-extrabold text-white">IA y Mercados</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Consejos y noticias</p>
          </button>
        </div>
      </section>

      {/* Latest news teaser */}
      {latestNewsTitle && (
        <section>
          <h3 className="text-[11px] uppercase font-extrabold tracking-widest text-slate-400 font-display mb-2 px-1">
            Última noticia
          </h3>
          <button
            onClick={() => onNavigate("mercados")}
            className="w-full bg-white/[0.04] rounded-2xl p-4 border border-white/10 text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex items-start gap-2.5">
              <Newspaper className="w-4 h-4 flex-shrink-0 text-indigo-400 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white leading-snug line-clamp-2">{latestNewsTitle}</p>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">{latestNewsSource}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
            </div>
          </button>
        </section>
      )}
    </div>
  );
}
