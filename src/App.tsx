/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { usePortfolioState } from "./hooks/usePortfolioState";
import { useAuth } from "./hooks/useAuth";
import { useLiveBtc, useLiveFx, useLiveStocks, useBtcHistory, useStocksHistory } from "./hooks/useLiveData";
import { HomeDashboard } from "./components/HomeDashboard";
import { BottomTabBar, TabId } from "./components/BottomTabBar";
import { PortfolioCharts } from "./components/PortfolioCharts";
import { PortfolioHistoryChart } from "./components/PortfolioHistoryChart";
import { GeminiAdvisor } from "./components/GeminiAdvisor";
import { InstrumentCard } from "./components/InstrumentCard";
import { BitcoinTracker } from "./components/BitcoinTracker";
import { CreditCardsTracker } from "./components/CreditCardsTracker";
import { CreditCardsCalendar } from "./components/CreditCardsCalendar";
import { ExpenseCategoryChart } from "./components/ExpenseCategoryChart";
import { CustomInvestmentsTracker } from "./components/CustomInvestmentsTracker";
import { MarketsAndNews } from "./components/MarketsAndNews";
import { OnboardingWizard } from "./components/OnboardingWizard";
import {
  PiggyBank, PlusCircle, Zap, RotateCcw, Settings, X,
  Download, Upload, Trash2, LogOut, Cloud, CloudOff, Loader2 as Spinner, CheckCircle2, AlertCircle, Sparkles
} from "lucide-react";

export default function App() {
  const { user, signOut, configured: authConfigured } = useAuth();

  const {
    state,
    getSimulatedDate,
    getComputedBalances,
    setTimeOffset,
    resetToDemo,
    clearAllData,
    getHistoricalNetWorth,
    addInstrument,
    addCashAccount,
    updateInstrumentDetails,
    setUserProfile,
    deleteInstrument,
    addTransaction,
    addBitcoinPurchase,
    deleteBitcoinPurchase,
    addCreditCard,
    deleteCreditCard,
    addCardExpense,
    deleteCardExpense,
    setCardExpenseCategory,
    applyCategoryBatch,
    payCreditCard,
    updateCreditCardBalance,
    updateCreditCardPeriod,
    updateCreditCardDetails,
    addCustomAsset,
    deleteCustomAsset,
    addCustomAssetPurchase,
    deleteCustomAssetPurchase,
    updateCustomAssetPrices,
    syncStatus,
    lastSyncedAt
  } = usePortfolioState(user?.id || null);

  // Live data (real APIs through backend)
  const btc = useLiveBtc();
  const fx = useLiveFx();

  // Stock symbols come from the user's custom assets — fetch real prices
  const stockSymbols = useMemo(
    () => (state.customAssets || []).map(a => a.symbol).filter(Boolean),
    [state.customAssets]
  );
  const stocks = useLiveStocks(stockSymbols);

  // Historical prices for the chart. Hardcoded to 90 days (max window we offer).
  const btcHist = useBtcHistory(90);
  const stocksHist = useStocksHistory(stockSymbols, 90);

  // Push live stock prices into portfolio state so all the per-asset math uses real values
  const lastAppliedRef = useRef<string>("");
  useEffect(() => {
    if (stocks.prices.length === 0) return;
    const pricesMap: { [symbol: string]: { mxn: number; usd: number } } = {};
    stocks.prices.forEach(p => {
      if (p.priceMxn != null && p.priceUsd != null) {
        pricesMap[p.symbol] = { mxn: p.priceMxn, usd: p.priceUsd };
      }
    });
    // Avoid loop: only write if values actually changed
    const sig = JSON.stringify(pricesMap);
    if (sig !== lastAppliedRef.current) {
      lastAppliedRef.current = sig;
      updateCustomAssetPrices(pricesMap);
    }
  }, [stocks.prices, updateCustomAssetPrices]);

  // UI state
  const [activeTab, setActiveTab] = useState<TabId>("inicio");

  // Categorize pending (uncategorized) expenses via Gemini batch.
  // Returns a status so the caller can show real feedback (toast / inline error)
  // instead of silently corrupting data with "otro" when Gemini is overloaded.
  const categorizedAttemptedRef = useRef<Set<string>>(new Set());
  const categorizePending = async (force = false): Promise<{ ok: boolean; isFallback?: boolean; count?: number; error?: string }> => {
    const pending = state.cardExpenses
      .filter(ex => !ex.category && ex.amount > 0 && (force || !categorizedAttemptedRef.current.has(ex.id)))
      .slice(0, 20);
    if (pending.length === 0) return { ok: true, count: 0 };
    pending.forEach(ex => categorizedAttemptedRef.current.add(ex.id));
    try {
      const r = await fetch("/api/categorize-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: pending.map(ex => ({ id: ex.id, concept: ex.concept, amount: ex.amount })) })
      });
      const j = await r.json();
      // Detect Gemini total failure: server returns isFallback=true with everything mapped to "otro".
      // Don't pollute state — let user retry or categorize manually.
      if (j?.isFallback) {
        // Allow retry of these specific items
        pending.forEach(ex => categorizedAttemptedRef.current.delete(ex.id));
        return { ok: false, isFallback: true, error: j.error || "Gemini saturado" };
      }
      if (j?.results && Object.keys(j.results).length > 0) {
        applyCategoryBatch(j.results);
        return { ok: true, count: Object.keys(j.results).length };
      }
      return { ok: false, error: "Respuesta vacía del servidor" };
    } catch (e: any) {
      pending.forEach(ex => categorizedAttemptedRef.current.delete(ex.id));
      return { ok: false, error: e?.message || "Error de red" };
    }
  };

  useEffect(() => {
    if (activeTab !== "tarjetas") return;
    categorizePending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, state.cardExpenses]);

  const [showAddInstrument, setShowAddInstrument] = useState(false);
  const [newInstName, setNewInstName] = useState("");
  const [newInstRate, setNewInstRate] = useState("");
  const [newInstBalance, setNewInstBalance] = useState("");
  const [addInstError, setAddInstError] = useState("");
  // Cash account form
  const [showAddCash, setShowAddCash] = useState(false);
  const [newCashName, setNewCashName] = useState("Efectivo");
  const [newCashBalance, setNewCashBalance] = useState("");
  const [addCashError, setAddCashError] = useState("");
  // Optional tiered config when creating an instrument
  const [newInstCap, setNewInstCap] = useState("");
  const [newInstExcessRate, setNewInstExcessRate] = useState("");
  // Edit instrument modal
  const [editingInstId, setEditingInstId] = useState<string | null>(null);
  const [editInstName, setEditInstName] = useState("");
  const [editInstRate, setEditInstRate] = useState("");
  const [editInstCap, setEditInstCap] = useState("");
  const [editInstExcessRate, setEditInstExcessRate] = useState("");
  const [editInstError, setEditInstError] = useState("");

  const openEditInstrument = (inst: any) => {
    setEditingInstId(inst.id);
    setEditInstName(inst.name);
    setEditInstRate(String(inst.annualRate ?? ""));
    setEditInstCap(inst.balanceCap !== undefined ? String(inst.balanceCap) : "");
    setEditInstExcessRate(inst.excessRate !== undefined ? String(inst.excessRate) : "");
    setEditInstError("");
  };

  const saveEditInstrument = () => {
    const rate = parseFloat(editInstRate);
    if (!editInstName.trim()) return setEditInstError("Nombre requerido.");
    if (isNaN(rate) || rate < 0 || rate > 100) return setEditInstError("Tasa debe ser 0-100%.");
    const capRaw = editInstCap.trim();
    const excessRaw = editInstExcessRate.trim();
    const fields: { name: string; annualRate: number; balanceCap?: number | null; excessRate?: number | null } = {
      name: editInstName.trim(),
      annualRate: rate,
    };
    if (capRaw === "") {
      fields.balanceCap = null; // clears tiered config
    } else {
      const cap = parseFloat(capRaw);
      if (isNaN(cap) || cap <= 0) return setEditInstError("Límite inválido.");
      fields.balanceCap = cap;
      const ex = excessRaw === "" ? 0 : parseFloat(excessRaw);
      if (isNaN(ex) || ex < 0 || ex > 100) return setEditInstError("Tasa del excedente debe ser 0-100%.");
      fields.excessRate = ex;
    }
    updateInstrumentDetails(editingInstId!, fields);
    setEditingInstId(null);
  };
  const [optimizationToast, setOptimizationToast] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [importError, setImportError] = useState<string>("");
  // Onboarding: show after sign-in if no profile yet (and not skipped this session)
  const [skippedOnboardingThisSession, setSkippedOnboardingThisSession] = useState(false);
  const [forceOnboarding, setForceOnboarding] = useState(false); // when editing profile from Settings
  const profileDone = !!(state.userProfile?.completedAt || state.userProfile?.skipped);
  const showOnboarding = forceOnboarding || (!profileDone && !skippedOnboardingThisSession);

  const simulatedDate = getSimulatedDate();

  const {
    computedInstruments,
    totalTasaDiariaMxn,
    totalInteresesGanadosMxn,
    totalBtc,
    totalBtcInvestedMxn,
    computedCreditCards,
    totalDeudaTdcMxn,
    computedCustomAssets,
    totalCustomAssetsValuationMxn,
    totalCustomAssetsInvestedMxn
  } = getComputedBalances(simulatedDate);

  const totalBtcValuationMxn = totalBtc * btc.priceMxn;
  const netWorthMxn = (totalTasaDiariaMxn + totalBtcValuationMxn + totalCustomAssetsValuationMxn) - totalDeudaTdcMxn;

  // Revolut surplus optimization — now respects the DESTINATION's balance cap so
  // it never suggests overfilling a capped account (e.g. Nu Caja Turbo @ 25k).
  const revolutInst = computedInstruments.find(
    inst => inst.id === "inst-revolut" || inst.name.toLowerCase().includes("revolut")
  );

  // Compute available headroom for a target instrument (Infinity if no cap).
  const headroom = (inst: any) =>
    inst.balanceCap !== undefined && inst.balanceCap > 0
      ? Math.max(0, inst.balanceCap - inst.currentBalance)
      : Infinity;

  // Pick the best destination: a non-Revolut instrument with rate > 7% that still
  // has room. Prefer Nu Caja Turbo; otherwise the highest-rate one with headroom.
  const candidateTargets = computedInstruments
    .filter(inst => inst.id !== (revolutInst?.id || "") && (inst.annualRate || 0) > 7.0 && !inst.isCash && headroom(inst) > 1)
    .sort((a, b) => (b.annualRate || 0) - (a.annualRate || 0));
  const preferredTargetInst =
    candidateTargets.find(inst => inst.id === "inst-nu-turbo" || inst.name.toLowerCase().includes("nu caja turbo")) ||
    candidateTargets[0];

  const rawRevolutExcess = revolutInst && revolutInst.currentBalance > 25000
    ? Math.round((revolutInst.currentBalance - 25000) * 100) / 100
    : 0;
  // Only move what fits in the destination.
  const revolutExcess = preferredTargetInst
    ? Math.min(rawRevolutExcess, headroom(preferredTargetInst))
    : 0;
  const showRevolutOptimization = !!(revolutInst && rawRevolutExcess > 0 && preferredTargetInst && revolutExcess > 1);

  const handleOptimizeRevolutSurplus = () => {
    if (!revolutInst || !preferredTargetInst || revolutExcess <= 0) return;
    const formattedAmount = revolutExcess.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const currentDateStr = `${simulatedDate.getFullYear()}-${String(simulatedDate.getMonth() + 1).padStart(2, "0")}-${String(simulatedDate.getDate()).padStart(2, "0")}`;
    addTransaction(revolutInst.id, "WITHDRAWAL", revolutExcess, `Optimización de Excedentes a ${preferredTargetInst.name}`, currentDateStr);
    addTransaction(preferredTargetInst.id, "DEPOSIT", revolutExcess, "Recepción de excedente optimizado de Revolut", currentDateStr);
    setOptimizationToast(`Excedente de $${formattedAmount} MXN transferido a ${preferredTargetInst.name}.`);
    setTimeout(() => setOptimizationToast(null), 5000);
  };

  // Count cards with debt nearing due date (for tab badge)
  const debtAlertCount = useMemo(() => {
    return computedCreditCards.filter(card => {
      if (card.currentBalance <= 0) return false;
      const offset = card.nextPeriodOffsetMonths || 0;
      const d = new Date(simulatedDate.getFullYear(), simulatedDate.getMonth() + offset, card.paymentDueDay);
      if (d < simulatedDate) d.setMonth(d.getMonth() + 1);
      const days = Math.ceil((d.getTime() - simulatedDate.getTime()) / (1000 * 60 * 60 * 24));
      return days <= 7 && days >= 0;
    }).length;
  }, [computedCreditCards, simulatedDate]);

  // Compile state for AI
  const compiledPortfolioStateForAI = {
    instruments: computedInstruments,
    totalTasaDiariaMxn,
    totalBtc,
    totalBtcInvestedMxn,
    currentBtcValueMxn: totalBtcValuationMxn,
    btcPerformanceMxn: totalBtcValuationMxn - totalBtcInvestedMxn,
    btcPerformancePercent: totalBtcInvestedMxn > 0 ? ((totalBtcValuationMxn - totalBtcInvestedMxn) / totalBtcInvestedMxn) * 100 : 0,
    btcPurchases: state.btcPurchases,
    creditCards: computedCreditCards,
    cardExpenses: state.cardExpenses,
    transactions: state.transactions,
    computedCustomAssets,
    totalCustomAssetsValuationMxn,
    totalCustomAssetsInvestedMxn,
    userProfile: state.userProfile
  };

  // Historical net worth series — recomputed when state or historical prices change.
  const historicalSeries = useMemo(
    () => getHistoricalNetWorth(
      90,
      btcHist.series.length > 0 ? btcHist.series : null,
      Object.keys(stocksHist.seriesBySymbol).length > 0 ? stocksHist.seriesBySymbol : null,
      btc.priceMxn,
      fx.usdMxn
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, btcHist.series, stocksHist.seriesBySymbol, btc.priceMxn, fx.usdMxn]
  );
  const historicalLoading = btcHist.loading || stocksHist.loading;

  const handleCreateInstrument = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(newInstRate);
    const balance = parseFloat(newInstBalance);
    if (!newInstName.trim()) return setAddInstError("Nombre requerido.");
    if (isNaN(rate) || rate <= 0 || rate > 100) return setAddInstError("Tasa anual debe ser entre 0 y 100%.");
    if (isNaN(balance) || balance < 0) return setAddInstError("Saldo inicial inválido.");
    const capRaw = newInstCap.trim();
    let cap: number | undefined;
    let excessRate: number | undefined;
    if (capRaw !== "") {
      cap = parseFloat(capRaw);
      if (isNaN(cap) || cap <= 0) return setAddInstError("Límite preferencial inválido.");
      excessRate = newInstExcessRate.trim() === "" ? 0 : parseFloat(newInstExcessRate);
      if (isNaN(excessRate) || excessRate < 0 || excessRate > 100) return setAddInstError("Tasa del excedente 0-100%.");
    }
    addInstrument(newInstName.trim(), rate, balance, cap, excessRate);
    setNewInstName(""); setNewInstRate(""); setNewInstBalance(""); setNewInstCap(""); setNewInstExcessRate(""); setAddInstError("");
    setShowAddInstrument(false);
  };

  const handleCreateCash = (e: React.FormEvent) => {
    e.preventDefault();
    const balance = parseFloat(newCashBalance);
    if (!newCashName.trim()) return setAddCashError("Nombre requerido.");
    if (isNaN(balance) || balance < 0) return setAddCashError("Monto inválido.");
    addCashAccount(newCashName.trim(), balance);
    setNewCashName("Efectivo"); setNewCashBalance(""); setAddCashError("");
    setShowAddCash(false);
  };

  // Backup / restore
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portafolio-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError("");
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || "{}"));
        if (!parsed.instruments || !parsed.creditCards) {
          throw new Error("Archivo no parece un respaldo válido.");
        }
        localStorage.setItem("portfolio_state_v3", JSON.stringify(parsed));
        window.location.reload();
      } catch (err: any) {
        setImportError(err?.message || "No se pudo leer el archivo.");
      }
    };
    reader.readAsText(file);
  };

  // FX fluctuation indicator vs. baseline (~17.5)
  const usdFluc = ((fx.usdMxn - 17.5) / 17.5) * 100;

  // === RENDER ===
  return (
    <div className="min-h-screen bg-[#0c1221] text-slate-100 font-sans relative overflow-x-hidden" id="app-root">
      {/* Onboarding wizard — full-screen overlay */}
      {showOnboarding && (
        <OnboardingWizard
          initial={state.userProfile}
          onComplete={(profile) => {
            setUserProfile(profile);
            setForceOnboarding(false);
          }}
          onSkip={() => {
            // If editing from settings, just close; if first-time, mark skipped this session
            if (forceOnboarding) {
              setForceOnboarding(false);
            } else {
              setSkippedOnboardingThisSession(true);
              // Persist a light "skipped" flag so it doesn't nag every reload
              setUserProfile({ ...(state.userProfile || {}), skipped: true });
            }
          }}
        />
      )}

      {/* Ambient blur backgrounds */}
      <div className="absolute top-[-100px] right-[-100px] w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[20%] left-[5%] w-80 h-80 bg-emerald-600/5 rounded-full blur-[100px] pointer-events-none z-0" />

      {/* Compact mobile-first header */}
      <header
        className="bg-[#0c1221]/95 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 font-extrabold shadow-md text-sm">
              $
            </span>
            <div>
              <h1 className="font-extrabold text-white text-sm leading-tight font-display bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                Control de Portafolio
              </h1>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                {simulatedDate.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                {state.currentDateOffsetDays > 0 && ` • +${state.currentDateOffsetDays}d sim`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Sync status indicator */}
            {authConfigured && user && (
              <span
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold"
                title={
                  syncStatus === "synced" ? `Sincronizado${lastSyncedAt ? " · " + lastSyncedAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : ""}` :
                  syncStatus === "syncing" ? "Guardando en la nube..." :
                  syncStatus === "loading" ? "Cargando desde la nube..." :
                  syncStatus === "error" ? "Error de sincronización" :
                  "Modo local"
                }
              >
                {syncStatus === "synced" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {(syncStatus === "syncing" || syncStatus === "loading") && <Spinner className="w-3.5 h-3.5 text-indigo-400 animate-spin" />}
                {syncStatus === "error" && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
                {syncStatus === "offline" && <CloudOff className="w-3.5 h-3.5 text-slate-500" />}
              </span>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Ajustes"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Toast */}
      {optimizationToast && (
        <div
          className="fixed left-4 right-4 z-50 max-w-md mx-auto bg-emerald-500 text-white rounded-2xl shadow-2xl p-3.5 border border-emerald-400/40 flex items-start gap-3"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 80px)" }}
        >
          <Zap className="w-5 h-5 flex-shrink-0 text-emerald-100 mt-0.5" />
          <div className="flex-1">
            <p className="font-extrabold text-[10px] uppercase tracking-wider text-emerald-100">Optimización exitosa</p>
            <p className="text-xs text-white mt-0.5 font-medium">{optimizationToast}</p>
          </div>
          <button onClick={() => setOptimizationToast(null)} className="text-white/70 hover:text-white font-bold text-base">×</button>
        </div>
      )}

      {/* Settings drawer */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
          onClick={() => setShowSettings(false)}
        >
          <div
            className="bg-[#0e1424] rounded-t-3xl sm:rounded-3xl border-t sm:border border-white/10 w-full max-w-md shadow-2xl flex flex-col max-h-[88dvh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Fixed header */}
            <div className="flex items-center justify-between border-b border-white/10 p-5 pb-3 flex-shrink-0">
              <h3 className="text-base font-extrabold text-white font-display">Ajustes</h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white p-1 -mr-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div
              className="overflow-y-auto p-5 pt-4 space-y-4"
              style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            >
            <div>
              <h4 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-widest mb-2">Máquina del tiempo</h4>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTimeOffset(0)}
                  disabled={state.currentDateOffsetDays === 0}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 border border-white/10"
                >
                  Hoy
                </button>
                <button onClick={() => setTimeOffset(state.currentDateOffsetDays + 1)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40">+1 día</button>
                <button onClick={() => setTimeOffset(state.currentDateOffsetDays + 30)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/15 text-slate-200 border border-white/10">+30 días</button>
                <button onClick={() => setTimeOffset(state.currentDateOffsetDays + 90)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">+90 días</button>
              </div>
              {state.currentDateOffsetDays > 0 && (
                <p className="text-[10px] text-indigo-300 font-bold mt-2">Simulando +{state.currentDateOffsetDays} días</p>
              )}
            </div>

            <div>
              <h4 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-widest mb-2">Perfil financiero</h4>
              <button
                onClick={() => { setShowSettings(false); setForceOnboarding(true); }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {profileDone ? "Editar mi perfil" : "Completar mi perfil"}
              </button>
              <p className="text-[10px] text-slate-500 mt-2">Tus respuestas personalizan los consejos de la IA.</p>
            </div>

            <div>
              <h4 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-widest mb-2">Respaldo</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleExport}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar JSON
                </button>
                <label className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  Importar JSON
                  <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
                </label>
              </div>
              {importError && <p className="text-[10px] text-rose-400 mt-2">{importError}</p>}
              <p className="text-[10px] text-slate-500 mt-2">Tus datos viven solo en este dispositivo. Exporta antes de borrar el caché del navegador.</p>
            </div>

            {authConfigured && user && (
              <div>
                <h4 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-widest mb-2">Cuenta</h4>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-300 font-bold">
                      <Cloud className="w-3 h-3" />
                      Sincronización activa
                    </div>
                    <p className="text-xs text-white font-mono truncate mt-0.5">{user.email}</p>
                    {lastSyncedAt && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Última sync: {lastSyncedAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm("¿Cerrar sesión? Tus datos quedan en la nube; vuelves a iniciar sesión cuando quieras.")) {
                        await signOut();
                        setShowSettings(false);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors flex-shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Salir
                  </button>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-widest mb-2">Zona de riesgo</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { if (confirm("¿Restaurar datos demo? Se perderá tu información actual.")) { resetToDemo(); setShowSettings(false); } }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Demo
                </button>
                <button
                  onClick={() => { if (confirm("¿Borrar TODO? Esta acción no se puede deshacer.")) { clearAllData(); setShowSettings(false); } }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpiar todo
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit instrument modal */}
      {editingInstId && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setEditingInstId(null)}
        >
          <div
            className="bg-[#0e1424] rounded-t-3xl sm:rounded-3xl border-t sm:border border-white/10 w-full max-w-md p-5 shadow-2xl animate-fade-in max-h-[88dvh] overflow-y-auto"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] uppercase font-extrabold text-emerald-300 tracking-widest">Editar instrumento</span>
                <h3 className="text-sm font-black text-white font-display">Nombre, tasa y límites</h3>
              </div>
              <button onClick={() => setEditingInstId(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Nombre</label>
                <input
                  type="text" value={editInstName}
                  onChange={e => setEditInstName(e.target.value)}
                  className="w-full text-sm border border-white/10 bg-[#080d19] text-white rounded-lg p-2.5 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Tasa anual %</label>
                <input
                  type="number" step="0.01" value={editInstRate}
                  onChange={e => setEditInstRate(e.target.value)}
                  className="w-full text-sm border border-white/10 bg-[#080d19] text-white rounded-lg p-2.5 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <div className="pt-1 border-t border-white/10">
                <p className="text-[10px] uppercase font-bold text-indigo-300 tracking-widest mt-2 mb-1">Tasa escalonada (opcional)</p>
                <p className="text-[10px] text-slate-500 mb-2 leading-snug">
                  Ej. Nu Caja Turbo: límite $25,000 y excedente 0%. Deja el límite vacío para tasa única.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] text-slate-400 font-bold uppercase mb-1">Límite preferencial $</label>
                    <input
                      type="number" step="0.01" placeholder="ej. 25000" value={editInstCap}
                      onChange={e => setEditInstCap(e.target.value)}
                      className="w-full text-sm border border-white/10 bg-[#080d19] text-white rounded-lg p-2.5 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-400 font-bold uppercase mb-1">Tasa excedente %</label>
                    <input
                      type="number" step="0.01" placeholder="ej. 0" value={editInstExcessRate}
                      onChange={e => setEditInstExcessRate(e.target.value)}
                      className="w-full text-sm border border-white/10 bg-[#080d19] text-white rounded-lg p-2.5 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {editInstError && <p className="text-xs text-rose-400 font-bold">{editInstError}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={saveEditInstrument} className="flex-1 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-bold text-sm py-2.5 rounded-lg shadow-md">
                  Guardar cambios
                </button>
                <button onClick={() => setEditingInstId(null)} className="px-4 py-2.5 bg-white/5 border border-white/10 text-slate-300 hover:text-white text-sm font-bold rounded-lg">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN: scrollable content area */}
      <main
        className="max-w-3xl mx-auto px-4 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 90px)" }}
      >
        {/* INICIO */}
        {activeTab === "inicio" && (
          <HomeDashboard
            netWorthMxn={netWorthMxn}
            totalTasaDiariaMxn={totalTasaDiariaMxn}
            totalInteresesGanadosMxn={totalInteresesGanadosMxn}
            totalBtcValuationMxn={totalBtcValuationMxn}
            totalCustomAssetsValuationMxn={totalCustomAssetsValuationMxn}
            totalDeudaTdcMxn={totalDeudaTdcMxn}
            btcPriceMxn={btc.priceMxn}
            btcPriceUsd={btc.priceUsd}
            btcIsLive={btc.isLive}
            usdMxn={fx.usdMxn}
            fxIsLive={fx.isLive}
            simulatedDate={simulatedDate}
            computedCreditCards={computedCreditCards}
            revolutExcess={revolutExcess}
            preferredTargetName={preferredTargetInst?.name}
            onOptimizeRevolut={handleOptimizeRevolutSurplus}
            onNavigate={setActiveTab}
            totalInstruments={computedInstruments.length}
            totalCardsCount={computedCreditCards.length}
            historicalSeries={historicalSeries}
            historicalLoading={historicalLoading}
          />
        )}

        {/* CUENTAS */}
        {activeTab === "cuentas" && (
          <div className="space-y-5">
            <header>
              <h2 className="text-xl font-black text-white font-display">Cuentas y efectivo</h2>
              <p className="text-xs text-slate-400 mt-0.5">Instrumentos con interés diario + efectivo en cartera</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { setAddInstError(""); setShowAddInstrument(!showAddInstrument); setShowAddCash(false); }}
                  className="flex items-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 active:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Instrumento
                </button>
                <button
                  onClick={() => { setAddCashError(""); setShowAddCash(!showAddCash); setShowAddInstrument(false); }}
                  className="flex items-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl bg-amber-500/15 hover:bg-amber-500/25 active:bg-amber-500/30 text-amber-300 border border-amber-500/30"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Efectivo
                </button>
              </div>
            </header>

            {showAddCash && (
              <form onSubmit={handleCreateCash} className="bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl p-4 space-y-3">
                <p className="text-[10px] uppercase font-bold text-amber-300 tracking-widest">Nueva cuenta de efectivo</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nombre (Ej. Cartera)"
                    value={newCashName}
                    onChange={e => setNewCashName(e.target.value)}
                    className="w-full text-sm border border-white/10 bg-[#0d1527] text-white rounded-lg p-2.5 focus:border-amber-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Monto MXN"
                    value={newCashBalance}
                    onChange={e => setNewCashBalance(e.target.value)}
                    className="w-full text-sm border border-white/10 bg-[#0d1527] text-white rounded-lg p-2.5 focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
                {addCashError && <p className="text-xs text-rose-400 font-bold">{addCashError}</p>}
                <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white font-bold text-sm py-2.5 rounded-lg shadow-md">
                  Guardar efectivo
                </button>
              </form>
            )}

            <PortfolioHistoryChart series={historicalSeries} variant="full" defaultDays={30} loading={historicalLoading} />

            {showAddInstrument && (
              <form onSubmit={handleCreateInstrument} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Nombre (Ej. Nu, Cetes)"
                  value={newInstName}
                  onChange={e => setNewInstName(e.target.value)}
                  className="w-full text-sm border border-white/10 bg-[#0d1527] text-white rounded-lg p-2.5 focus:border-emerald-500 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Tasa anual %"
                    value={newInstRate}
                    onChange={e => setNewInstRate(e.target.value)}
                    className="w-full text-sm border border-white/10 bg-[#0d1527] text-white rounded-lg p-2.5 focus:border-emerald-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Saldo MXN"
                    value={newInstBalance}
                    onChange={e => setNewInstBalance(e.target.value)}
                    className="w-full text-sm border border-white/10 bg-[#0d1527] text-white rounded-lg p-2.5 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <details className="group">
                  <summary className="text-[11px] text-indigo-300 font-bold cursor-pointer select-none flex items-center gap-1">
                    <span>Tasa escalonada (opcional)</span>
                    <span className="text-slate-500 group-open:rotate-90 transition-transform inline-block">▸</span>
                  </summary>
                  <p className="text-[10px] text-slate-500 mt-1.5 mb-2 leading-snug">
                    Para cajas con límite, ej. Nu Caja Turbo: 13% solo hasta $25,000, el excedente rinde menos.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number" step="0.01"
                      placeholder="Límite preferencial $"
                      value={newInstCap}
                      onChange={e => setNewInstCap(e.target.value)}
                      className="w-full text-sm border border-white/10 bg-[#0d1527] text-white rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none font-mono"
                    />
                    <input
                      type="number" step="0.01"
                      placeholder="Tasa excedente %"
                      value={newInstExcessRate}
                      onChange={e => setNewInstExcessRate(e.target.value)}
                      className="w-full text-sm border border-white/10 bg-[#0d1527] text-white rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none font-mono"
                    />
                  </div>
                </details>
                {addInstError && <p className="text-xs text-rose-400 font-bold">{addInstError}</p>}
                <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-bold text-sm py-2.5 rounded-lg shadow-md">
                  Guardar
                </button>
              </form>
            )}

            {/* Revolut surplus banner */}
            {showRevolutOptimization && preferredTargetInst && (
              <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/5 to-indigo-500/10 border border-amber-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300 font-display">Optimización de excedente</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Revolut tiene <strong className="text-white">${revolutExcess.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN</strong> sobre el límite del 15%. Muévelos a <strong className="text-emerald-400">{preferredTargetInst.name} ({preferredTargetInst.annualRate}%)</strong>.
                </p>
                <button
                  onClick={handleOptimizeRevolutSurplus}
                  className="mt-3 w-full bg-gradient-to-r from-amber-500 to-indigo-600 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-2"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Transferir ${revolutExcess.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN
                </button>
              </div>
            )}

            {computedInstruments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border border-dashed border-white/10 rounded-2xl text-slate-400">
                <PiggyBank className="w-8 h-8 text-slate-500 mb-2" />
                <p className="text-sm font-bold text-slate-300">No hay instrumentos</p>
                <p className="text-xs mt-0.5">Toca "Agregar" para crear el primero</p>
              </div>
            ) : (
              <div className="space-y-4">
                {computedInstruments.map(inst => (
                  <InstrumentCard
                    key={inst.id}
                    instrument={inst}
                    transactions={state.transactions}
                    onAddTransaction={addTransaction}
                    onDeleteInstrument={deleteInstrument}
                    onEdit={inst.isCash || inst.id === "inst-revolut" || inst.name.toLowerCase().includes("revolut") ? undefined : () => openEditInstrument(inst)}
                    simulatedDate={simulatedDate}
                  />
                ))}
              </div>
            )}

            <PortfolioCharts
              tasaDiariaValue={totalTasaDiariaMxn}
              btcValue={totalBtcValuationMxn}
              customAssetsValue={totalCustomAssetsValuationMxn}
              instrumentsList={computedInstruments}
              totalInterestEarned={totalInteresesGanadosMxn}
            />
          </div>
        )}

        {/* TARJETAS */}
        {activeTab === "tarjetas" && (
          <div className="space-y-5">
            <header>
              <h2 className="text-xl font-black text-white font-display">Tarjetas de crédito</h2>
              <p className="text-xs text-slate-400 mt-0.5">Deuda, cortes y fechas límite de pago</p>
            </header>
            <CreditCardsCalendar
              creditCards={computedCreditCards}
              simulatedDate={simulatedDate}
            />
            <ExpenseCategoryChart
              expenses={state.cardExpenses}
              simulatedDate={simulatedDate}
              onCategorizePending={() => categorizePending(true)}
            />
            <CreditCardsTracker
              creditCards={computedCreditCards}
              cardExpenses={state.cardExpenses}
              onAddCard={addCreditCard}
              onDeleteCard={deleteCreditCard}
              onAddExpense={addCardExpense}
              onDeleteExpense={deleteCardExpense}
              onSetExpenseCategory={setCardExpenseCategory}
              onPayCard={payCreditCard}
              onUpdateCardBalance={updateCreditCardBalance}
              onUpdateCardPeriod={updateCreditCardPeriod}
              onUpdateCardDetails={updateCreditCardDetails}
              simulatedDate={simulatedDate}
            />
          </div>
        )}

        {/* INVERSIONES */}
        {activeTab === "inversiones" && (
          <div className="space-y-5">
            <header>
              <h2 className="text-xl font-black text-white font-display">Inversiones</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Bitcoin {btc.isLive && <span className="text-emerald-400">●</span>} y renta variable {stocks.isLive && <span className="text-emerald-400">●</span>}
              </p>
            </header>
            <BitcoinTracker
              btcTransactions={state.btcPurchases}
              onAddPurchase={addBitcoinPurchase}
              onDeletePurchase={deleteBitcoinPurchase}
              liveBtcPriceMxn={btc.priceMxn}
              liveBtcPriceUsd={btc.priceUsd}
              liveBtcLoading={btc.loading}
              onRefreshLivePrice={btc.refresh}
              liveBtcSource={btc.isLive ? btc.source : `${btc.source} (no en vivo)`}
            />
            <CustomInvestmentsTracker
              customAssets={computedCustomAssets}
              customAssetPurchases={state.customAssetPurchases || []}
              onAddAsset={addCustomAsset}
              onDeleteAsset={deleteCustomAsset}
              onAddPurchase={addCustomAssetPurchase}
              onDeletePurchase={deleteCustomAssetPurchase}
            />
          </div>
        )}

        {/* MERCADOS & IA */}
        {activeTab === "mercados" && (
          <div className="space-y-5">
            <header>
              <h2 className="text-xl font-black text-white font-display">Mercados e IA</h2>
              <p className="text-xs text-slate-400 mt-0.5">USD/MXN, noticias y consejos personalizados</p>
            </header>
            <GeminiAdvisor portfolioState={compiledPortfolioStateForAI} />
            <MarketsAndNews
              portfolioStateForAI={compiledPortfolioStateForAI}
              currentDateOffsetDays={state.currentDateOffsetDays}
              usdMxn={fx.usdMxn}
              usdFluc={usdFluc}
              fxIsLive={fx.isLive}
            />
          </div>
        )}
      </main>

      <BottomTabBar active={activeTab} onChange={setActiveTab} debtAlertCount={debtAlertCount} />
    </div>
  );
}
