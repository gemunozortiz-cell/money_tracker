/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { PlusCircle, MinusCircle, Trash2, Calendar, TrendingUp, History } from "lucide-react";
import { FinancialInstrument, Transaction } from "../types";

interface InstrumentCardProps {
  key?: string;
  instrument: FinancialInstrument & { totalInterestsEarned: number; currentBalance: number };
  transactions: Transaction[];
  onAddTransaction: (instrumentId: string, type: "DEPOSIT" | "WITHDRAWAL", amount: number, concept?: string, date?: string) => void;
  onDeleteInstrument: (id: string) => void;
  simulatedDate: Date;
}

export function InstrumentCard({ instrument, transactions, onAddTransaction, onDeleteInstrument, simulatedDate }: InstrumentCardProps) {
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [concept, setConcept] = useState<string>("");
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  
  // Error handling
  const [errorMsg, setErrorMsg] = useState<string>("");

  const filteredHistory = transactions.filter(t => t.instrumentId === instrument.id);

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg("Por favor ingresa un monto válido mayor a cero.");
      return;
    }
    onAddTransaction(instrument.id, "DEPOSIT", numAmount, concept || "Depósito adicional", transactionDate);
    setAmount("");
    setConcept("");
    setErrorMsg("");
    setShowDepositForm(false);
  };

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg("Por favor ingresa un monto válido mayor a cero.");
      return;
    }
    if (!concept.trim()) {
      setErrorMsg("Debes especificar el concepto o justificación de tu retiro obligatoriamente.");
      return;
    }
    if (numAmount > instrument.currentBalance) {
      setErrorMsg(`Saldo insuficiente. El saldo disponible es $${instrument.currentBalance.toLocaleString("es-MX")} MXN`);
      return;
    }
    onAddTransaction(instrument.id, "WITHDRAWAL", numAmount, concept.trim(), transactionDate);
    setAmount("");
    setConcept("");
    setErrorMsg("");
    setShowWithdrawForm(false);
  };

  return (
    <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-lg transition-all relative overflow-hidden" id={`instrument-${instrument.id}`}>
      {/* Top Header */}
      <div className="flex items-start justify-between border-b border-white/10 pb-4 mb-4">
        <div>
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-300 bg-white/5 border border-white/5 px-2 py-0.5 rounded font-display">
            Capitalización Diaria
          </span>
          <h3 className="font-extrabold text-white text-lg mt-1 font-display">{instrument.name}</h3>
        </div>
        <button
          onClick={() => onDeleteInstrument(instrument.id)}
          className="text-slate-400 hover:text-red-400 hover:bg-white/5 p-1.5 rounded-lg transition-all cursor-pointer"
          title="Eliminar instrumento"
          id={`btn-del-${instrument.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-[1.25fr_0.75fr] gap-2 mb-4 bg-white/[0.01] border border-white/5 rounded-xl p-3">
        <div>
          <span className="text-[10px] text-slate-400 uppercase font-semibold block font-display">Tasa Anual</span>
          <div className="flex items-baseline gap-1" id={`rate-val-${instrument.id}`}>
            <span className={`font-bold text-white font-display ${
              instrument.name.toLowerCase().includes("revolut") ? "text-xs sm:text-sm" : "text-xl"
            }`}>
              {instrument.name.toLowerCase().includes("revolut") ? "15% / 7% / 4.5%" : `${instrument.annualRate}%`}
            </span>
            <span className="text-[9px] text-slate-400 font-medium font-sans">Compuesto</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block font-display">Interés Acumulado</span>
          <span className="text-base sm:text-lg font-bold text-emerald-400 font-mono block truncate" id={`interest-${instrument.id}`}>
            +${instrument.totalInterestsEarned.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Revolut specific info card */}
      {instrument.name.toLowerCase().includes("revolut") && (
        <div className="mb-4 bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-300 rounded-xl p-2.5 space-y-1">
          <p className="font-semibold uppercase tracking-wider text-[9px]">Garantía de Rendimientos Revolut</p>
          <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[9.5px]">
            <li>Hasta $25,000 MXN: <strong className="text-white">15.00% Anual</strong> (Cálculo ACT/360)</li>
            <li>$25,000 – $1,000,000: <strong className="text-white">7.00% Anual</strong></li>
            <li>Retención Fiscal ISR: <strong className="text-white">-0.90% Anual</strong> (Cálculo ACT/365)</li>
          </ul>
        </div>
      )}

      {/* Current Accrued Balance Display */}
      <div className="mb-5 bg-gradient-to-r from-emerald-500/10 to-teal-600/10 border border-emerald-500/30 text-white p-4 rounded-xl shadow-md">
        <span className="text-xs text-emerald-300 font-bold uppercase tracking-wider block font-display">Saldo Estimado al {simulatedDate.toLocaleDateString("es-MX")}</span>
        <span className="text-2xl font-black block tracking-tight mt-0.5 font-display text-white" id={`balance-${instrument.id}`}>
          ${instrument.currentBalance.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setShowWithdrawForm(false);
            setAmount("");
            setConcept("");
            setErrorMsg("");
            setShowDepositForm(!showDepositForm);
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition-all border border-emerald-500/25 cursor-pointer shadow-xs"
          id={`btn-deposit-${instrument.id}`}
        >
          <PlusCircle className="w-4 h-4" />
          Depósito
        </button>
        <button
          onClick={() => {
            setShowDepositForm(false);
            setAmount("");
            setConcept("");
            setErrorMsg("");
            setShowWithdrawForm(!showWithdrawForm);
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition-all border border-rose-500/25 cursor-pointer shadow-xs"
          id={`btn-withdraw-${instrument.id}`}
        >
          <MinusCircle className="w-4 h-4" />
          Retiro
        </button>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <p className="text-xs text-red-200 font-semibold mt-3 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
          ⚠️ {errorMsg}
        </p>
      )}

      {/* Form Slide/Drop panels */}
      {showDepositForm && (
        <form onSubmit={handleDeposit} className="border-t border-white/10 mt-4 pt-4 space-y-3 animate-fade-in" id={`deposit-form-${instrument.id}`}>
          <h4 className="text-xs font-bold text-slate-200 uppercase font-display">Agregar Ingreso adicional</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-300 font-medium">Monto ($ MXN)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Ej 5000"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                className="w-full text-xs border border-white/10 bg-[#080d19] rounded p-1.5 mt-0.5 focus:border-emerald-500 focus:outline-none text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-300 font-medium">Fecha depósito</label>
              <input
                type="date"
                required
                value={transactionDate}
                onChange={e => setTransactionDate(e.target.value)}
                className="w-full text-xs border border-white/10 bg-[#080d19] rounded p-1.5 mt-0.5 focus:border-emerald-500 focus:outline-none text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-slate-300 font-medium">Concepto (Opcional)</label>
            <input
              type="text"
              placeholder="Ej. Mi nómina"
              value={concept}
              onChange={e => setConcept(e.target.value)}
              className="w-full text-xs border border-white/10 bg-[#080d19] rounded p-1.5 mt-0.5 focus:border-emerald-500 focus:outline-none text-white"
            />
          </div>
          <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-450 text-white font-bold text-xs py-2 rounded shadow-md transition-all cursor-pointer">
            Confirmar Depósito
          </button>
        </form>
      )}

      {showWithdrawForm && (
        <form onSubmit={handleWithdraw} className="border-t border-white/10 mt-4 pt-4 space-y-3 animate-fade-in" id={`withdraw-form-${instrument.id}`}>
          <h4 className="text-xs font-bold text-rose-300 uppercase font-display">Solicitar Retiro de Fondos</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-300 font-medium">Monto ($ MXN)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Ej 1500"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                className="w-full text-xs border border-white/10 bg-[#080d19] rounded p-1.5 mt-0.5 focus:border-rose-500 focus:outline-none text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-300 font-medium">Fecha retiro</label>
              <input
                type="date"
                required
                value={transactionDate}
                onChange={e => setTransactionDate(e.target.value)}
                className="w-full text-xs border border-white/10 bg-[#080d19] rounded p-1.5 mt-0.5 focus:border-rose-500 focus:outline-none text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-rose-300 font-semibold">Concepto / Destino del Retiro *</label>
            <input
              type="text"
              placeholder="Ej. Emergencia médica, Pago, etc."
              value={concept}
              onChange={e => setConcept(e.target.value)}
              required
              className="w-full text-xs border border-white/10 bg-[#0c1221] rounded p-1.5 mt-0.5 focus:border-rose-500 focus:outline-none text-white"
            />
          </div>
          <button type="submit" className="w-full bg-rose-500 hover:bg-rose-455 text-white font-bold text-xs py-2 rounded shadow-md transition-all cursor-pointer">
            Confirmar Retiro
          </button>
        </form>
      )}

      {/* Local transaction history for this card */}
      <div className="mt-4 border-t border-white/10 pt-3">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1 font-display">
          <History className="w-3 h-3" />
          Movimientos Recientes
        </h4>
        {filteredHistory.length === 0 ? (
          <span className="text-[10px] text-slate-500 block italic">Sin movimientos registrados aún</span>
        ) : (
          <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1">
            {filteredHistory.map(tx => (
              <div key={tx.id} className="flex justify-between items-center text-[11px] border-b border-white/5 pb-1">
                <div>
                  <span className={`font-bold mr-1.5 ${tx.type === "DEPOSIT" ? "text-emerald-400" : "text-rose-400"}`}>
                    {tx.type === "DEPOSIT" ? "DEP" : "RET"}
                  </span>
                  <span className="text-slate-400 text-[10px]">{tx.date}</span>
                  <div className="text-slate-400 text-[9px] font-sans truncate max-w-[140px]" title={tx.concept}>
                    {tx.concept}
                  </div>
                </div>
                <span className={`font-semibold ${tx.type === "DEPOSIT" ? "text-emerald-300" : "text-rose-300"}`}>
                  {tx.type === "DEPOSIT" ? "+" : "-"}${tx.amount.toLocaleString("es-MX")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
