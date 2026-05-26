/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from "react";
import { TrendingDown, ChevronLeft, ChevronRight, PieChart, Sparkles, Loader2 } from "lucide-react";
import { CreditCardExpense } from "../types";
import { EXPENSE_CATEGORIES, getCategory } from "../lib/categories";

interface CategorizeResult {
  ok: boolean;
  isFallback?: boolean;
  count?: number;
  error?: string;
}

interface ExpenseCategoryChartProps {
  expenses: CreditCardExpense[];
  simulatedDate: Date;
  onCategorizePending?: () => Promise<CategorizeResult>;
}

type WindowMode = "this-month" | "last-30" | "all";

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function parseLocalYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function ExpenseCategoryChart({ expenses, simulatedDate, onCategorizePending }: ExpenseCategoryChartProps) {
  const [windowMode, setWindowMode] = useState<WindowMode>("this-month");
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current, -1 = prev, etc.
  const [pendingBusy, setPendingBusy] = useState(false);
  const [pendingMsg, setPendingMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const handleCategorizePending = async () => {
    if (!onCategorizePending || pendingBusy) return;
    setPendingBusy(true);
    setPendingMsg(null);
    try {
      const result = await onCategorizePending();
      if (result.ok) {
        if (result.count === 0) {
          setPendingMsg({ kind: "ok", text: "No hay gastos pendientes." });
        } else {
          setPendingMsg({ kind: "ok", text: `✓ ${result.count} gasto${result.count === 1 ? "" : "s"} categorizado${result.count === 1 ? "" : "s"} por IA.` });
        }
      } else if (result.isFallback) {
        setPendingMsg({ kind: "error", text: "Gemini saturado en este momento. Reintenta en 30s o categoriza manualmente tocando cada badge." });
      } else {
        setPendingMsg({ kind: "error", text: `Error: ${result.error || "desconocido"}` });
      }
    } catch (e: any) {
      setPendingMsg({ kind: "error", text: `Error de red: ${e?.message || "intenta de nuevo"}` });
    } finally {
      setPendingBusy(false);
      setTimeout(() => setPendingMsg(null), 6000);
    }
  };

  const { totals, total, label, uncategorizedCount } = useMemo(() => {
    // Define the window
    let from: Date | null = null;
    let to: Date | null = null;
    let label = "";

    if (windowMode === "this-month") {
      const target = new Date(simulatedDate.getFullYear(), simulatedDate.getMonth() + monthOffset, 1);
      from = startOfMonth(target);
      to = new Date(target.getFullYear(), target.getMonth() + 1, 0); // last day of month
      label = target.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    } else if (windowMode === "last-30") {
      from = new Date(simulatedDate);
      from.setDate(from.getDate() - 30);
      to = simulatedDate;
      label = "Últimos 30 días";
    } else {
      label = "Todo el historial";
    }

    // Sum positive amounts per category (skip payments, which are negative)
    const map: Record<string, number> = {};
    let uncat = 0;
    expenses.forEach(ex => {
      if (ex.amount <= 0) return;
      if (from && to) {
        const exDate = parseLocalYmd(ex.date);
        if (exDate < from || exDate > to) return;
      }
      const catId = ex.category || "_uncategorized";
      if (catId === "_uncategorized") uncat++;
      map[catId] = (map[catId] || 0) + ex.amount;
    });

    const sorted = Object.entries(map)
      .map(([id, amount]) => ({ id, amount }))
      .sort((a, b) => b.amount - a.amount);

    const total = sorted.reduce((acc, c) => acc + c.amount, 0);

    return { totals: sorted, total, label, uncategorizedCount: uncat };
  }, [expenses, simulatedDate, windowMode, monthOffset]);

  const maxAmount = totals[0]?.amount || 1;

  return (
    <div className="bg-white/[0.04] rounded-3xl border border-white/10 p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-indigo-400" />
          <h3 className="font-bold text-white text-sm font-display">¿En qué gastas?</h3>
        </div>
        {windowMode === "this-month" && (
          <div className="flex items-center gap-1">
            <button onClick={() => setMonthOffset(o => o - 1)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-300" aria-label="Mes anterior">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setMonthOffset(o => o + 1)}
              disabled={monthOffset >= 0}
              className="p-1.5 rounded-lg hover:bg-white/5 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Window selector */}
      <div className="flex gap-1.5 mb-3">
        {(["this-month", "last-30", "all"] as WindowMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => { setWindowMode(mode); setMonthOffset(0); }}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${
              windowMode === mode
                ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-200"
                : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-slate-200"
            }`}
          >
            {mode === "this-month" ? "Por mes" : mode === "last-30" ? "30 días" : "Todo"}
          </button>
        ))}
      </div>

      {/* Total + label */}
      <div className="flex items-baseline justify-between mb-3 pb-3 border-b border-white/10">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Gasto total</span>
          <span className="text-2xl font-black text-rose-300 font-mono">
            ${total.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-bold capitalize">{label}</span>
      </div>

      {/* Bars */}
      {totals.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-xs">
          <TrendingDown className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
          Sin gastos en esta ventana.
        </div>
      ) : (
        <div className="space-y-2.5">
          {totals.map(({ id, amount }) => {
            const cat = id === "_uncategorized" ? null : getCategory(id);
            const pct = total > 0 ? (amount / total) * 100 : 0;
            const widthPct = (amount / maxAmount) * 100;
            const hex = cat?.hex || "#64748b";
            return (
              <div key={id}>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-base leading-none flex-shrink-0">{cat?.emoji || "❓"}</span>
                    <span className="font-bold truncate" style={{ color: hex }}>
                      {cat?.label || "Sin categoría"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-slate-400 font-mono text-[10px]">{pct.toFixed(0)}%</span>
                    <span className="font-bold text-white font-mono">
                      ${amount.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${widthPct}%`, backgroundColor: hex }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Feedback message after the user taps "Categorizar" */}
      {pendingMsg && (
        <div className={`mt-3 p-3 rounded-xl border text-[11px] font-medium leading-snug ${
          pendingMsg.kind === "ok"
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
            : "bg-rose-500/10 border-rose-500/30 text-rose-200"
        }`}>
          {pendingMsg.text}
        </div>
      )}

      {uncategorizedCount > 0 && (
        <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5">
          <span className="text-sm">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-amber-200 leading-tight">
              {uncategorizedCount} gasto{uncategorizedCount === 1 ? "" : "s"} sin categoría
            </p>
            <p className="text-[10px] text-amber-300/80 mt-0.5 leading-snug">
              Toca el badge en cada gasto para asignar manualmente, o deja que la IA lo haga ahora:
            </p>
          </div>
          {onCategorizePending && (
            <button
              onClick={handleCategorizePending}
              disabled={pendingBusy}
              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:bg-indigo-600/50 text-white transition-colors flex-shrink-0"
            >
              {pendingBusy ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  IA...
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  Categorizar
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
