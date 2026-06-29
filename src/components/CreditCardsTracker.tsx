/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { CreditCard as CardIcon, Calendar, Trash2, Plus, AlertCircle, TrendingDown, ClipboardList, Tag, X, Loader2, FastForward, Pencil } from "lucide-react";
import { CreditCard, CreditCardExpense } from "../types";
import { EXPENSE_CATEGORIES, getCategory } from "../lib/categories";
import { todayLocalYmd } from "../lib/dates";
import { Portal } from "./Portal";

interface CreditCardsTrackerProps {
  creditCards: CreditCard[];
  cardExpenses: CreditCardExpense[];
  onAddCard: (name: string, limit: number, cutoff: number, due: number) => void;
  onDeleteCard: (id: string) => void;
  onAddExpense: (cardId: string, concept: string, amount: number, date: string, category?: string) => string;
  onDeleteExpense: (id: string) => void;
  onSetExpenseCategory: (id: string, category: string) => void;
  onPayCard: (cardId: string, amountPaid: number) => void;
  onUpdateCardBalance: (cardId: string, customBalance: number) => void;
  onUpdateCardPeriod: (cardId: string, offsetMonths: number) => void;
  onUpdateCardDetails: (cardId: string, fields: { name?: string; creditLimit?: number; cutoffDay?: number; paymentDueDay?: number }) => void;
  simulatedDate: Date;
}

export function CreditCardsTracker({
  creditCards,
  cardExpenses,
  onAddCard,
  onDeleteCard,
  onAddExpense,
  onDeleteExpense,
  onSetExpenseCategory,
  onPayCard,
  onUpdateCardBalance,
  onUpdateCardPeriod,
  onUpdateCardDetails,
  simulatedDate
}: CreditCardsTrackerProps) {
  // Category UX state
  const [categorizingIds, setCategorizingIds] = useState<Set<string>>(new Set());
  const [editingCategoryFor, setEditingCategoryFor] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteConfirmCardId, setDeleteConfirmCardId] = useState<string | null>(null);

  // Edit card dates/limit state
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLimit, setEditLimit] = useState("");
  const [editCutoff, setEditCutoff] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editError, setEditError] = useState("");

  const openEditCard = (cc: { id: string; name: string; creditLimit: number; cutoffDay: number; paymentDueDay: number }) => {
    setEditingCardId(cc.id);
    setEditName(cc.name);
    setEditLimit(String(cc.creditLimit));
    setEditCutoff(String(cc.cutoffDay));
    setEditDue(String(cc.paymentDueDay));
    setEditError("");
  };

  const saveEditCard = () => {
    const limit = parseFloat(editLimit);
    const cut = parseInt(editCutoff);
    const due = parseInt(editDue);
    if (!editName.trim()) return setEditError("El nombre es obligatorio.");
    if (isNaN(limit) || limit <= 0) return setEditError("Límite inválido.");
    if (isNaN(cut) || cut < 1 || cut > 31) return setEditError("Día de corte debe ser 1-31.");
    if (isNaN(due) || due < 1 || due > 31) return setEditError("Día de pago debe ser 1-31.");
    onUpdateCardDetails(editingCardId!, { name: editName.trim(), creditLimit: limit, cutoffDay: cut, paymentDueDay: due });
    setEditingCardId(null);
  };

  // Async classify a freshly-added expense via /api/categorize-expense
  const classifyExpense = async (expenseId: string, concept: string, amount: number) => {
    setCategorizingIds(prev => new Set(prev).add(expenseId));
    try {
      const r = await fetch("/api/categorize-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept, amount })
      });
      const j = await r.json();
      if (j?.category) onSetExpenseCategory(expenseId, j.category);
    } catch {
      onSetExpenseCategory(expenseId, "otro");
    } finally {
      setCategorizingIds(prev => { const n = new Set(prev); n.delete(expenseId); return n; });
    }
  };
  // Card creation form states
  const [showAddCard, setShowAddCard] = useState(false);
  const addCardFormRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (showAddCard) addCardFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [showAddCard]);
  const [cardName, setCardName] = useState("");
  const [cardLimit, setCardLimit] = useState("");
  const [cutoffDay, setCutoffDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [cardError, setCardError] = useState("");

  // Payment states
  const [activeCardIdForPayment, setActiveCardIdForPayment] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  // Edit balance states
  const [activeCardIdForEditBalance, setActiveCardIdForEditBalance] = useState<string | null>(null);
  const [editBalanceValue, setEditBalanceValue] = useState("");

  // Expense creation states
  const [activeCardIdForExpense, setActiveCardIdForExpense] = useState<string | null>(null);
  const [expenseConcept, setExpenseConcept] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayLocalYmd());
  const [expenseError, setExpenseError] = useState("");

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = parseFloat(cardLimit);
    const cutNum = parseInt(cutoffDay);
    const dueNum = parseInt(dueDay);

    if (!cardName.trim()) {
      setCardError("Ingresa el nombre de la tarjeta.");
      return;
    }
    if (isNaN(limitNum) || limitNum <= 0) {
      setCardError("Ingresa un límite de crédito válido.");
      return;
    }
    if (isNaN(cutNum) || cutNum < 1 || cutNum > 31) {
      setCardError("Día de corte debe ser entre 1 y 31.");
      return;
    }
    if (isNaN(dueNum) || dueNum < 1 || dueNum > 31) {
      setCardError("Día de límite de pago debe ser entre 1 y 31.");
      return;
    }

    onAddCard(cardName.trim(), limitNum, cutNum, dueNum);
    setCardName("");
    setCardLimit("");
    setCutoffDay("");
    setDueDay("");
    setCardError("");
    setShowAddCard(false);
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCardIdForExpense) return;

    const amountNum = parseFloat(expenseAmount);
    if (!expenseConcept.trim()) {
      setExpenseError("Ingresa el concepto del gasto.");
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      setExpenseError("Ingresa un monto de gasto válido.");
      return;
    }

    const concept = expenseConcept.trim();
    const newId = onAddExpense(activeCardIdForExpense, concept, amountNum, expenseDate);
    // Fire-and-forget AI categorization (writes back via onSetExpenseCategory)
    classifyExpense(newId, concept, amountNum);
    setExpenseConcept("");
    setExpenseAmount("");
    setExpenseError("");
    setActiveCardIdForExpense(null);
  };

  // Helper: Evaluates how many days are left to pay based on the simulated current day
  const getPaymentStatusAndTime = (cutoff: number, due: number, nextPeriodOffsetMonths: number = 0) => {
    const todayDay = simulatedDate.getDate();
    const todayMonth = simulatedDate.getMonth() + nextPeriodOffsetMonths;
    const todayYear = simulatedDate.getFullYear();

    // Work out when the next due date is.
    // If cutoff < due (e.g. cut 5th, due 25th): Payment is in the same month
    // If cutoff > due (e.g. cut 15th, due 5th of next month): Payment is in the following month
    let targetMonth = todayMonth;
    let targetYear = todayYear;

    if (cutoff >= due) {
      // Payment is in the next month relative to cutting
      // Let's decide if cutoff has passed in this month
      if (todayDay > cutoff) {
        // Cutoff passed, payment due is in month + 2
        targetMonth = todayMonth + 2;
      } else {
        // Cutoff has not passed yet, but after last cut, payment is in month + 1
        targetMonth = todayMonth + 1;
      }
    } else {
      // Payment same month as corte
      if (todayDay > due) {
        // Already passed due day, the next due date corresponds to next month
        targetMonth = todayMonth + 1;
      }
    }

    const dueDate = new Date(targetYear, targetMonth, due);
    dueDate.setHours(0,0,0,0);
    
    // Days delta calculation
    const simulatedMidnight = new Date(simulatedDate);
    simulatedMidnight.setHours(0,0,0,0);
    const diffTime = dueDate.getTime() - simulatedMidnight.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let colorClass = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
    let text = "Al corriente";

    if (diffDays < 0) {
      colorClass = "bg-red-500/15 border-red-500/30 text-red-300 animate-pulse";
      text = `Vencida hace ${Math.abs(diffDays)} d`;
    } else if (diffDays === 0) {
      colorClass = "bg-rose-500 text-white animate-pulse font-black";
      text = "¡Paga Hoy!";
    } else if (diffDays < 5) {
      colorClass = "bg-red-500/10 border-red-500/25 text-red-300 font-bold";
      text = `Urgente: Quedan ${diffDays} días`;
    } else if (diffDays <= 12) {
      colorClass = "bg-amber-500/10 border-amber-550/20 text-amber-305 font-semibold";
      text = `Quedan ${diffDays} días`;
    } else {
      colorClass = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
      text = `Quedan ${diffDays} días`;
    }

    return {
      daysLeft: diffDays,
      statusLabel: text,
      colorClass,
      formattedDueDate: dueDate.toLocaleDateString("es-MX", { day: "numeric", month: "short" })
    };
  };

  return (
    <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/10 p-4 sm:p-6 shadow-xl mb-8 animate-fade-in relative z-10" id="credit-cards-section">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <CardIcon className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-lg font-display">Control de Tarjetas de Crédito</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Sigue tus pasivos de tarjetas de crédito y nunca olvides tus límites o fechas de pago.</p>
        </div>

        <button
          onClick={() => {
            setCardError("");
            setShowAddCard(!showAddCard);
          }}
          className="flex items-center justify-center gap-1.5 py-2 px-3.5 text-xs font-bold rounded-lg bg-[#4f46e5]/10 hover:bg-[#4f46e5]/20 text-indigo-300 transition-all border border-indigo-500/25 cursor-pointer shadow-sm"
          id="btn-toggle-add-card"
        >
          <Plus className="w-3.5 h-3.5" />
          Registrar Tarjeta
        </button>
      </div>

      {/* Add Card Form */}
      {showAddCard && (
        <form ref={addCardFormRef} onSubmit={handleCreateCard} className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3 animate-fade-in" id="add-card-form">
          <div className="sm:col-span-1">
            <label className="block text-[10px] text-slate-450 font-bold uppercase font-display">Nombre Banco / Tarjeta</label>
            <input
              type="text"
              required
              placeholder="Ej. BBVA Oro, Nu..."
              value={cardName}
              onChange={e => setCardName(e.target.value)}
              className="w-full text-xs border border-white/10 bg-[#080d19] text-white rounded p-2 mt-1 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-450 font-bold uppercase font-display">Límite de Crédito ($ MXN)</label>
            <input
              type="number"
              required
              placeholder="Ej. 45005"
              value={cardLimit}
              onChange={e => setCardLimit(e.target.value)}
              className="w-full text-xs border border-white/10 bg-[#080d19] text-white rounded p-2 mt-1 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-450 font-bold uppercase font-display">Día Corte</label>
              <input
                type="number"
                min="1"
                max="31"
                required
                placeholder="15"
                value={cutoffDay}
                onChange={e => setCutoffDay(e.target.value)}
                className="w-full text-xs border border-white/10 bg-[#080d19] text-white rounded p-2 mt-1 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-450 font-bold uppercase font-display">Día Pago</label>
              <input
                type="number"
                min="1"
                max="31"
                required
                placeholder="5"
                value={dueDay}
                onChange={e => setDueDay(e.target.value)}
                className="w-full text-xs border border-white/10 bg-[#080d19] text-white rounded p-2 mt-1 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="sm:col-span-1 flex flex-col justify-end">
            {cardError && <p className="text-[10px] text-red-400 font-bold mb-1.5">{cardError}</p>}
            <button type="submit" className="w-full bg-indigo-550 hover:bg-indigo-500 text-white font-bold text-xs py-2 rounded transition-all shadow-md cursor-pointer">
              Guardar Tarjeta
            </button>
          </div>
        </form>
      )}

      {creditCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 border border-dashed border-white/10 rounded-2xl text-slate-450 bg-white/[0.01]">
          <CardIcon className="w-8 h-8 text-slate-500 mb-2" />
          <p className="text-sm font-bold text-slate-350">No hay tarjetas de crédito registradas</p>
          <p className="text-xs text-slate-500 mt-0.5">Controla tus fechas límite de pago para evitar recargos e intereses.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6" id="cards-grid">
          {creditCards.map(cc => {
            const avaCredit = cc.creditLimit - cc.currentBalance;
            const usePercent = cc.creditLimit > 0 ? (cc.currentBalance / cc.creditLimit) * 100 : 0;
            const expensesList = cardExpenses.filter(e => e.cardId === cc.id);
            const status = getPaymentStatusAndTime(cc.cutoffDay, cc.paymentDueDay, cc.nextPeriodOffsetMonths || 0);

            return (
              <div key={cc.id} className="border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col justify-between bg-white/[0.01] hover:bg-white/[0.03] hover:border-indigo-500/25 transition-all shadow-sm" id={`card-block-${cc.id}`}>
                {/* Visual Plastic representation */}
                <div className="bg-gradient-to-tr from-slate-950 via-indigo-950 to-indigo-900 border border-white/5 text-white rounded-xl p-4 relative overflow-hidden shadow-lg aspect-[1.58/1] flex flex-col justify-between">
                  {/* Decorative blur — must NOT capture clicks meant for the edit/delete buttons */}
                  <div className="absolute right-0 top-0 w-32 h-32 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none"></div>

                  {/* Top line banner */}
                  <div className="flex justify-between items-start gap-1 relative z-10">
                    <div className="flex items-center gap-1.5 flex-wrap max-w-[85%]">
                      <span className={`w-2 h-2 rounded-full block ${status.daysLeft < 5 ? "bg-red-400 animate-ping" : status.daysLeft <= 12 ? "bg-amber-400" : "bg-emerald-400"}`} />
                      <span className="text-xs font-bold tracking-widest uppercase font-display">{cc.name}</span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/15 text-white whitespace-nowrap">
                        {status.daysLeft < 0 ? "Vencida" : status.daysLeft === 0 ? "¡Hoy!" : `Faltan ${status.daysLeft} d`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                      <button
                        onClick={() => openEditCard(cc)}
                        className="text-white/40 hover:text-indigo-300 transition-colors cursor-pointer p-0.5"
                        title="Editar fechas y límite"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmCardId(cc.id)}
                        className="text-white/40 hover:text-red-400 transition-colors cursor-pointer p-0.5"
                        title="Eliminar tarjeta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Delete confirmation overlay */}
                  {deleteConfirmCardId === cc.id && (
                    <div className="absolute inset-0 z-20 bg-[#0c1222]/96 backdrop-blur-md rounded-xl flex flex-col items-center justify-center text-center p-4 animate-fade-in border border-red-500/30">
                      <Trash2 className="w-7 h-7 text-red-400 mb-2" />
                      <p className="text-sm font-extrabold text-white">¿Eliminar {cc.name}?</p>
                      <p className="text-[10px] text-slate-400 mt-1 mb-4 leading-relaxed max-w-[240px]">
                        Se borrará la tarjeta y todos sus gastos registrados. Esta acción no se puede deshacer.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { onDeleteCard(cc.id); setDeleteConfirmCardId(null); }}
                          className="px-3.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors shadow-md"
                        >
                          Sí, eliminar
                        </button>
                        <button
                          onClick={() => setDeleteConfirmCardId(null)}
                          className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg text-xs font-bold transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Balance details */}
                  <div className="mt-2">
                    <span className="text-[9px] text-indigo-300 uppercase font-bold block">Saldo al Corte gastado</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xl sm:text-2xl font-black font-mono tracking-tight block">
                        ${cc.currentBalance.toLocaleString("es-MX")} MXN
                      </span>
                      {cc.manualBalance !== undefined && (
                        <span className="text-[8px] bg-indigo-500/30 text-indigo-200 border border-indigo-500/10 px-1 py-0.5 rounded uppercase font-bold tracking-wider">
                          Manual
                        </span>
                      )}
                      {(cc.nextPeriodOffsetMonths || 0) > 0 && (
                        <span className="text-[8px] bg-emerald-500/30 text-emerald-200 border border-emerald-500/10 px-1 py-0.5 rounded uppercase font-bold tracking-wider">
                          Per. +{cc.nextPeriodOffsetMonths}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Limit status bars */}
                  <div>
                    <div className="flex justify-between text-[10px] text-indigo-200 mb-1 font-semibold">
                      <span>Disponible: ${Math.max(0, avaCredit).toLocaleString("es-MX")}</span>
                      <span>Límite: ${cc.creditLimit.toLocaleString("es-MX")}</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          usePercent > 85 ? "bg-rose-500" : usePercent > 50 ? "bg-amber-400" : "bg-emerald-400"
                        }`}
                        style={{ width: `${Math.min(100, usePercent)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Bottom dates panel */}
                  <div className="grid grid-cols-2 gap-2 text-[9px] border-t border-white/10 pt-2 text-indigo-150 mt-1">
                    <div>
                      <span className="block opacity-65 uppercase font-medium">Día de Corte</span>
                      <span className="font-bold">{cc.cutoffDay} de cada mes</span>
                    </div>
                    <div className="text-right">
                      <span className="block opacity-65 uppercase font-medium">Límite de Pago</span>
                      <span className="font-bold">{cc.paymentDueDay} de cada mes</span>
                    </div>
                  </div>
                </div>

                {/* Interactive Payment and Adjustment Buttons */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setActiveCardIdForPayment(activeCardIdForPayment === cc.id ? null : cc.id);
                      setPaymentAmount(cc.currentBalance.toString());
                      setActiveCardIdForEditBalance(null);
                    }}
                    className="flex-1 min-w-[100px] text-[10px] sm:text-xs flex items-center justify-center font-bold py-1.5 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 cursor-pointer shadow-sm text-center transition-colors"
                  >
                    Registrar Pago
                  </button>
                  <button
                    onClick={() => {
                      setActiveCardIdForEditBalance(activeCardIdForEditBalance === cc.id ? null : cc.id);
                      setEditBalanceValue(cc.currentBalance.toString());
                      setActiveCardIdForPayment(null);
                    }}
                    className="flex-1 min-w-[100px] text-[10px] sm:text-xs flex items-center justify-center font-bold py-1.5 px-3 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 cursor-pointer shadow-sm text-center transition-colors"
                  >
                    Ajustar Saldo
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateCardPeriod(cc.id, (cc.nextPeriodOffsetMonths || 0) + 1)}
                    className="flex items-center gap-1 text-[10px] font-bold py-1.5 px-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 cursor-pointer transition-colors"
                    title="El período actual ya está pagado, mover la fecha de pago al siguiente ciclo (no toca tu saldo actual)"
                  >
                    <FastForward className="w-3 h-3" />
                    Período pagado
                  </button>
                  {(cc.nextPeriodOffsetMonths || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => onUpdateCardPeriod(cc.id, 0)}
                      className="text-[9px] font-bold py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/15 text-slate-350 border border-white/10 cursor-pointer transition-colors"
                      title="Reiniciar periodo a actual"
                    >
                      Restablecer
                    </button>
                  )}
                </div>
                {(cc.nextPeriodOffsetMonths || 0) > 0 && (
                  <p className="mt-2 text-[10px] text-amber-300/90 leading-snug">
                    📅 Adelantado <strong>{cc.nextPeriodOffsetMonths}</strong> ciclo{cc.nextPeriodOffsetMonths === 1 ? "" : "s"}. Próximo pago se calcula desde ahí.
                  </p>
                )}

                {/* Form to Register Payment */}
                {activeCardIdForPayment === cc.id && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const amt = parseFloat(paymentAmount);
                      if (!isNaN(amt)) {
                        onPayCard(cc.id, amt);
                        setActiveCardIdForPayment(null);
                      }
                    }}
                    className="mt-3 bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl space-y-2 animate-fade-in"
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider font-display">Registrar Pago de Tarjeta</h4>
                      <button type="button" onClick={() => setActiveCardIdForPayment(null)} className="text-[9px] text-slate-400 hover:text-white font-bold">Cancelar</button>
                    </div>
                    <p className="text-[9.5px] text-slate-350 leading-relaxed">
                      Se restará el pago al saldo actual, se registrará el abono del pago en el historial y <strong className="text-white">el vencimiento se postergará al siguiente periodo automáticamente</strong>.
                    </p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">$</span>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          className="w-full text-xs border border-white/10 bg-[#080d19] rounded py-1.5 pl-6 pr-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
                          placeholder="Monto pagado"
                        />
                      </div>
                      <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-3 rounded transition-all cursor-pointer">
                        Confirmar Pago
                      </button>
                    </div>
                  </form>
                )}

                {/* Form to Edit Balance Manually */}
                {activeCardIdForEditBalance === cc.id && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const amt = parseFloat(editBalanceValue);
                      if (!isNaN(amt)) {
                        onUpdateCardBalance(cc.id, amt);
                        setActiveCardIdForEditBalance(null);
                      }
                    }}
                    className="mt-3 bg-indigo-500/5 border border-indigo-500/20 p-3 rounded-xl space-y-2 animate-fade-in"
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider font-display">Ajustar Saldo Manualmente</h4>
                      <button type="button" onClick={() => setActiveCardIdForEditBalance(null)} className="text-[9px] text-slate-400 hover:text-white font-bold">Cancelar</button>
                    </div>
                    <p className="text-[9.5px] text-slate-350 leading-relaxed">
                      Ajusta el saldo libremente. El indicador interno se marcará como manual ignorando la suma de cargos enlistados.
                    </p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">$</span>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={editBalanceValue}
                          onChange={(e) => setEditBalanceValue(e.target.value)}
                          className="w-full text-xs border border-white/10 bg-[#080d19] rounded py-1.5 pl-6 pr-2 text-white font-mono focus:border-indigo-500 focus:outline-none"
                          placeholder="Nuevo saldo"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <button type="submit" className="bg-indigo-650 hover:bg-indigo-500 text-white font-bold text-[10px] px-3 rounded transition-all cursor-pointer">
                          Ajustar
                        </button>
                        {cc.manualBalance !== undefined && (
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateCardBalance(cc.id, undefined as any);
                              setActiveCardIdForEditBalance(null);
                            }}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] px-2 rounded font-bold text-slate-300"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  </form>
                )}

                {/* Scheduling alert banner */}
                <div className={`mt-4 p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${status.colorClass}`} id={`payment-alert-${cc.id}`}>
                  <div className="flex items-start gap-2.5 max-w-full">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="text-xs min-w-0">
                      <span className="font-bold block">Pagar antes del: {status.formattedDueDate}</span>
                      <span className="text-[10px] block opacity-90 leading-tight">Para no generar cargos ni intereses</span>
                    </div>
                  </div>
                  <span className="text-xs sm:text-[11px] font-black uppercase px-2.5 py-1 rounded bg-white/15 border border-white/20 whitespace-nowrap shadow-xs text-center inline-block w-full sm:w-auto">
                    {status.statusLabel}
                  </span>
                </div>

                {/* Expenses logger & control list */}
                <div className="mt-4 flex-1">
                  <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 font-display">
                      <ClipboardList className="w-3 h-3" />
                      Historial de Cargos ({expensesList.length})
                    </span>
                    <button
                      onClick={() => {
                        setExpenseError("");
                        setExpenseConcept("");
                        setExpenseAmount("");
                        setActiveCardIdForExpense(activeCardIdForExpense === cc.id ? null : cc.id);
                      }}
                      className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Registrar Cargo
                    </button>
                  </div>

                  {/* Register Expense toggleable inside card */}
                  {activeCardIdForExpense === cc.id && (
                    <form onSubmit={handleCreateExpense} className="bg-white/5 border border-white/10 p-3 rounded-xl mb-3 space-y-2 animate-fade-in">
                      <h4 className="text-[10px] font-bold text-indigo-350 uppercase font-display">Cargar Gasto a la Tarjeta</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] text-slate-400 font-bold">Monto ($ MXN)</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            placeholder="Monto"
                            value={expenseAmount}
                            onChange={e => setExpenseAmount(e.target.value)}
                            className="w-full text-xs border border-white/10 bg-[#080d19] rounded p-1.5 mt-0.5 focus:outline-none focus:border-indigo-500 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-400 font-bold">Fecha Gasto</label>
                          <input
                            type="date"
                            required
                            value={expenseDate}
                            onChange={e => setExpenseDate(e.target.value)}
                            className="w-full text-xs border border-white/10 bg-[#080d19] rounded p-1.5 mt-0.5 focus:outline-none focus:border-indigo-500 text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-400 font-bold">Concepto / Comercio</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. Cena Sushi Roll, Uber al aeropuerto, Netflix..."
                          value={expenseConcept}
                          onChange={e => setExpenseConcept(e.target.value)}
                          className="w-full text-xs border border-white/10 bg-[#080d19] rounded p-1.5 mt-0.5 focus:outline-none focus:border-indigo-500 text-white"
                        />
                        <p className="text-[9px] text-slate-500 mt-1 leading-snug">
                          <strong className="text-indigo-300">Tip:</strong> sé específico (incluye comercio o tipo). La IA lo categoriza solo. Si se equivoca, toca el badge para corregir.
                        </p>
                      </div>

                      {/* Leyenda de categorías disponibles */}
                      <div className="bg-[#080d19] border border-white/5 rounded-lg p-2">
                        <div className="flex items-center gap-1 mb-1.5">
                          <Tag className="w-2.5 h-2.5 text-indigo-400" />
                          <span className="text-[9px] uppercase font-extrabold tracking-widest text-slate-400">Categorías disponibles</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {EXPENSE_CATEGORIES.map(cat => (
                            <span
                              key={cat.id}
                              title={cat.description}
                              className="inline-flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded border"
                              style={{
                                backgroundColor: `${cat.hex}1a`,
                                borderColor: `${cat.hex}55`,
                                color: cat.hex
                              }}
                            >
                              <span className="leading-none">{cat.emoji}</span>
                              <span>{cat.label}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {expenseError && <span className="text-[10px] text-red-400 block font-bold">{expenseError}</span>}

                      <div className="flex gap-2">
                        <button type="submit" className="flex-1 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-[10px] py-1.5 rounded transition-all cursor-pointer">
                          Agregar Cargo
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveCardIdForExpense(null)}
                          className="px-3 bg-white/5 border border-white/10 text-slate-300 text-[10px] py-1.5 rounded cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Render expenses of card */}
                  {expensesList.length === 0 ? (
                    <span className="text-[10px] italic text-slate-500 block py-2">Sin cargos registrados en este período</span>
                  ) : (
                    <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                      {expensesList.map(ex => {
                        const cat = getCategory(ex.category);
                        const isCategorizing = categorizingIds.has(ex.id);
                        // Skip the visible badge for payment rows (negative amounts) — they're not "expenses"
                        const isPayment = ex.amount < 0;
                        return (
                          <div key={ex.id} className="flex justify-between items-center text-xs border-b border-white/5 pb-1.5 hover:bg-white/[0.02] p-1 rounded transition-all gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="font-semibold text-slate-200 block truncate">{ex.concept}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] text-slate-400">{ex.date}</span>
                                {!isPayment && (
                                  isCategorizing ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      Categorizando...
                                    </span>
                                  ) : cat ? (
                                    <button
                                      onClick={() => setEditingCategoryFor(ex.id)}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border hover:opacity-80 active:scale-95 transition-all cursor-pointer"
                                      style={{
                                        backgroundColor: `${cat.hex}1a`,
                                        borderColor: `${cat.hex}66`,
                                        color: cat.hex
                                      }}
                                      title="Toca para cambiar categoría"
                                    >
                                      <span>{cat.emoji}</span>
                                      <span>{cat.label}</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setEditingCategoryFor(ex.id)}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 active:scale-95 transition-all cursor-pointer"
                                      title="Toca para asignar categoría"
                                    >
                                      <Tag className="w-3 h-3" />
                                      Asignar categoría
                                    </button>
                                  )
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className={`font-bold font-mono ${isPayment ? "text-emerald-400" : "text-white"}`}>
                                ${ex.amount.toLocaleString("es-MX")}
                              </span>
                              <button
                                onClick={() => onDeleteExpense(ex.id)}
                                className="text-slate-400 hover:text-red-400 p-0.5 rounded hover:bg-white/5 transition-all"
                                title="Remover cargo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom sheet (mobile) / centered modal (desktop) to edit a category */}
      {editingCategoryFor && (
        <Portal>
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setEditingCategoryFor(null)}
        >
          <div
            className="bg-[#0e1424] rounded-t-3xl sm:rounded-3xl border-t sm:border border-white/10 w-full max-w-md p-5 shadow-2xl animate-fade-in"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] uppercase font-extrabold text-indigo-300 tracking-widest">Cambiar categoría</span>
                <h3 className="text-sm font-black text-white font-display truncate max-w-[260px]">
                  {cardExpenses.find(ex => ex.id === editingCategoryFor)?.concept || "Gasto"}
                </h3>
              </div>
              <button onClick={() => setEditingCategoryFor(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
              {EXPENSE_CATEGORIES.map(cat => {
                const current = cardExpenses.find(ex => ex.id === editingCategoryFor)?.category;
                const isActive = current === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      onSetExpenseCategory(editingCategoryFor!, cat.id);
                      setEditingCategoryFor(null);
                    }}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                      isActive ? "ring-2 ring-offset-2 ring-offset-[#0e1424]" : ""
                    }`}
                    style={{
                      backgroundColor: `${cat.hex}1a`,
                      borderColor: `${cat.hex}55`,
                      // @ts-expect-error: --tw-ring-color is set via CSS var
                      "--tw-ring-color": cat.hex
                    }}
                  >
                    <span className="text-base">{cat.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold" style={{ color: cat.hex }}>{cat.label}</div>
                      <div className="text-[9px] text-slate-400 leading-tight">{cat.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Edit card details modal (cutoff/payment days, limit, name) */}
      {editingCardId && (
        <Portal>
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setEditingCardId(null)}
        >
          <div
            className="bg-[#0e1424] rounded-t-3xl sm:rounded-3xl border-t sm:border border-white/10 w-full max-w-md p-5 shadow-2xl animate-fade-in max-h-[88dvh] overflow-y-auto"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] uppercase font-extrabold text-indigo-300 tracking-widest">Editar tarjeta</span>
                <h3 className="text-sm font-black text-white font-display">Fechas, límite y nombre</h3>
              </div>
              <button onClick={() => setEditingCardId(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Nombre</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full text-sm border border-white/10 bg-[#080d19] text-white rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Día de corte</label>
                  <input
                    type="number" min="1" max="31"
                    value={editCutoff}
                    onChange={e => setEditCutoff(e.target.value)}
                    className="w-full text-sm border border-white/10 bg-[#080d19] text-white rounded-lg p-2.5 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-[9px] text-slate-500 mt-1">Día del mes en que cierra el periodo</p>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Día de pago</label>
                  <input
                    type="number" min="1" max="31"
                    value={editDue}
                    onChange={e => setEditDue(e.target.value)}
                    className="w-full text-sm border border-white/10 bg-[#080d19] text-white rounded-lg p-2.5 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-[9px] text-slate-500 mt-1">Fecha límite para pagar sin interés</p>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Límite de crédito (MXN)</label>
                <input
                  type="number" step="0.01"
                  value={editLimit}
                  onChange={e => setEditLimit(e.target.value)}
                  className="w-full text-sm border border-white/10 bg-[#080d19] text-white rounded-lg p-2.5 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              {editError && <p className="text-xs text-rose-400 font-bold">{editError}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveEditCard}
                  className="flex-1 bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white font-bold text-sm py-2.5 rounded-lg shadow-md transition-colors"
                >
                  Guardar cambios
                </button>
                <button
                  onClick={() => setEditingCardId(null)}
                  className="px-4 py-2.5 bg-white/5 border border-white/10 text-slate-300 hover:text-white text-sm font-bold rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
