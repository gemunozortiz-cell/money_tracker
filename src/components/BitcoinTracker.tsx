/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { TrendingUp, Plus, Trash2, RotateCw, Coins, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BitcoinPurchase } from "../types";
import { todayLocalYmd } from "../lib/dates";

interface BitcoinTrackerProps {
  btcTransactions: BitcoinPurchase[];
  onAddPurchase: (date: string, montoMXN: number, cantidadBTC: number) => void;
  onDeletePurchase: (id: string) => void;
  liveBtcPriceMxn: number;
  liveBtcPriceUsd: number;
  liveBtcLoading: boolean;
  onRefreshLivePrice: () => void;
  liveBtcSource: string;
}

export function BitcoinTracker({
  btcTransactions,
  onAddPurchase,
  onDeletePurchase,
  liveBtcPriceMxn,
  liveBtcPriceUsd,
  liveBtcLoading,
  onRefreshLivePrice,
  liveBtcSource
}: BitcoinTrackerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState<string>(
    todayLocalYmd()
  );
  const [montoMxnString, setMontoMxnString] = useState<string>("");
  const [cantidadBtcString, setCantidadBtcString] = useState<string>("");
  const [formError, setFormError] = useState<string>("");

  // Sum calculations
  const totalBtc = btcTransactions.reduce((acc, tx) => acc + tx.cantidadBTC, 0);
  const totalInvestedMxn = btcTransactions.reduce((acc, tx) => acc + tx.montoMXN, 0);
  const currentValuationMxn = totalBtc * liveBtcPriceMxn;
  const yieldMxn = currentValuationMxn - totalInvestedMxn;
  const yieldPercentage = totalInvestedMxn > 0 ? (yieldMxn / totalInvestedMxn) * 100 : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const monto = parseFloat(montoMxnString);
    const btc = parseFloat(cantidadBtcString);

    if (isNaN(monto) || monto <= 0) {
      setFormError("Por favor ingresa un monto válido de MXN.");
      return;
    }
    if (isNaN(btc) || btc <= 0) {
      setFormError("Por favor ingresa una cantidad de Bitcoin válida.");
      return;
    }

    onAddPurchase(purchaseDate, monto, btc);
    setMontoMxnString("");
    setCantidadBtcString("");
    setFormError("");
    setShowAddForm(false);
  };

  return (
    <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/10 p-6 shadow-xl flex flex-col md:flex-row gap-6 mb-8 relative z-10" id="bitcoin-tracker-section">
      {/* Visual Ticker & Valuation Block */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/25">
              <Coins className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-white text-lg font-display">Activo Bitcoin (BTC)</h3>
              <p className="text-xs text-slate-400">Valuación en Pesos Mexicanos (MXN)</p>
            </div>
          </div>

          {/* Real-time Ticker Status */}
          <div className="flex items-center gap-2 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/25">
            <span className={`w-2 h-2 rounded-full ${liveBtcLoading ? "bg-amber-400" : "bg-emerald-400 animate-pulse mr-0.5"}`} />
            <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider relative bottom-[1px] font-display">
              {liveBtcLoading ? "Leyendo..." : "En Vivo"}
            </span>
            <button
              onClick={onRefreshLivePrice}
              disabled={liveBtcLoading}
              className="text-amber-400 hover:text-amber-300 transition-transform hover:rotate-180 duration-500 cursor-pointer"
              title="Actualizar precio ahora"
            >
              <RotateCw className={`w-3 h-3 ${liveBtcLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Real-time Bitcoin Price Grid */}
        <div className="bg-amber-500/5 rounded-2xl p-4 border border-amber-500/20 text-center relative overflow-hidden backdrop-blur-sm shadow-lg">
          <span className="text-[10px] text-amber-300 font-extrabold uppercase tracking-widest block font-display">Precios de Mercado de Bitcoin en Tiempo Real</span>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mt-2">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Valor en MXN</span>
              <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight block mt-0.5" id="btc-live-rate">
                ${liveBtcPriceMxn.toLocaleString("es-MX")} MXN
              </span>
            </div>
            <div className="hidden sm:block w-[1.5px] h-10 bg-amber-500/15" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Referencia en USD</span>
              <span className="text-2xl sm:text-3xl font-black text-amber-300 font-mono tracking-tight block mt-0.5" id="btc-live-rate-usd">
                ${liveBtcPriceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
            </div>
          </div>
          <span className="text-[9.5px] text-slate-400 block mt-2.5">
            Fuente oficial: {liveBtcSource} • Actualizaciones continuas cada 15s • Tipo de Cambio Implícito: ${(liveBtcPriceMxn / (liveBtcPriceUsd || 1)).toFixed(2)} MXN/USD
          </span>
        </div>

        {/* Return Summary Card */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3">
            <span className="text-[10px] font-semibold text-slate-400 uppercase block font-display">Total de BTC Acumulado</span>
            <span className="text-base font-bold text-white font-mono block mt-1" id="btc-held-sum">
              {totalBtc.toFixed(8)} BTC
            </span>
          </div>
          <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3">
            <span className="text-[10px] font-semibold text-slate-400 uppercase block font-display">Inversión Histórica Total</span>
            <span className="text-base font-bold text-white block mt-1" id="btc-invested-sum">
              ${totalInvestedMxn.toLocaleString("es-MX")} MXN
            </span>
          </div>
        </div>

        {/* Accrued Performance Box */}
        <div className="border border-white/10 bg-white/[0.02] rounded-2xl p-4 flex items-center justify-between shadow-sm" id="btc-valuation-yield">
          <div>
            <span className="text-xs text-slate-400 block">Valor Actual en tu Cartera</span>
            <span className="text-xl font-bold text-slate-100 font-mono block mt-0.5" id="btc-value-sum">
              ${currentValuationMxn.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Rendimiento Acumunulado</span>
            <div className={`flex items-center gap-1 justify-end font-bold text-base mt-0.5 ${yieldMxn >= 0 ? "text-emerald-400" : "text-rose-455"}`} id="btc-yield-sum">
              {yieldMxn >= 0 ? (
                <>
                  <ArrowUpRight className="w-4 h-4" />
                  <span>+${yieldMxn.toLocaleString("es-MX", { maximumFractionDigits: 0 })} ({yieldPercentage.toFixed(2)}%)</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-4 h-4" />
                  <span>-${Math.abs(yieldMxn).toLocaleString("es-MX", { maximumFractionDigits: 0 })} ({yieldPercentage.toFixed(2)}%)</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Inputs and purchases logger */}
      <div className="flex-1 flex flex-col justify-between border-t md:border-t-0 md:border-l border-white/10 pt-6 md:pt-0 md:pl-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-white text-sm font-display">Transacciones / Compras Registradas</h4>
            <button
              onClick={() => {
                setFormError("");
                setShowAddForm(!showAddForm);
              }}
              className="flex items-center gap-1 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-white px-3 py-1.5 rounded-lg shadow-md transition-all cursor-pointer"
              id="btn-toggle-add-btc"
            >
              <Plus className="w-3.5 h-3.5" />
              Ingresar Compra
            </button>
          </div>

          {/* Form to log purchase */}
          {showAddForm && (
            <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4 space-y-3 animate-fade-in" id="add-btc-form">
              <h5 className="text-[11px] font-bold text-amber-300 uppercase tracking-widest font-display">Registrar nueva compra histórica</h5>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-300 font-medium">Fecha Compra</label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    className="w-full text-xs border border-white/10 bg-[#080d19] rounded p-1.5 focus:outline-none focus:border-amber-500 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-300 font-medium">MXN Invertido ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ej. 10000"
                    value={montoMxnString}
                    onChange={e => setMontoMxnString(e.target.value)}
                    className="w-full text-xs border border-white/10 bg-[#080d19] rounded p-1.5 focus:outline-none focus:border-amber-500 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-300 font-medium">Bitcoin Recibido (BTC)</label>
                <input
                  type="number"
                  step="0.00000001"
                  required
                  placeholder="Ej. 0.00537"
                  value={cantidadBtcString}
                  onChange={e => setCantidadBtcString(e.target.value)}
                  className="w-full text-xs border border-white/10 bg-[#080d19] rounded p-1.5 focus:outline-none focus:border-amber-500 text-white"
                />
              </div>

              {formError && <p className="text-[10px] text-red-400 font-semibold">{formError}</p>}

              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-450 text-white text-xs font-bold py-1.5 rounded transition-all cursor-pointer shadow-sm">
                Confirmar Transacción
              </button>
            </form>
          )}

          {/* List of purchases */}
          {btcTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-450 bg-white/[0.01] rounded-xl border border-dashed border-white/5">
              <p className="text-xs font-medium text-slate-300">No tienes registrado ningún movimiento de Bitcoin.</p>
              <p className="text-[10px] text-slate-500 mt-1">Registra arriba tus compras para ver tus rendimientos estimativos.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {btcTransactions.map(tx => {
                const txGainMxn = (tx.cantidadBTC * liveBtcPriceMxn) - tx.montoMXN;
                const txGainPercent = (txGainMxn / tx.montoMXN) * 100;
                return (
                  <div key={tx.id} className="border border-white/5 rounded-xl p-3 flex justify-between items-center bg-white/[0.01] hover:bg-white/[0.03] transition-all">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-100 font-mono">
                          {tx.cantidadBTC} BTC
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">{tx.date}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 space-x-1 font-sans">
                        <span>Inv. ${tx.montoMXN.toLocaleString("es-MX")} MXN</span>
                        <span>•</span>
                        <span>Precio Ref: ${tx.purchasePricePerBTC.toLocaleString("es-MX", { maximumFractionDigits: 0 })}/BTC</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className={`text-xs font-bold block font-mono ${txGainMxn >= 0 ? "text-emerald-400" : "text-rose-455"}`}>
                          {txGainMxn >= 0 ? "+" : ""}${Math.round(txGainMxn).toLocaleString("es-MX")}
                        </span>
                        <span className={`text-[9px] font-semibold block ${txGainMxn >= 0 ? "text-emerald-400" : "text-rose-405"}`}>
                          {txGainMxn >= 0 ? "+" : ""}{txGainPercent.toFixed(1)}%
                        </span>
                      </div>
                      <button
                        onClick={() => onDeletePurchase(tx.id)}
                        className="text-slate-400 hover:text-red-400 p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
                        title="Quitar transacción"
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

        {/* Interactive Buy-points visual graph indicator */}
        {btcTransactions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2 font-display">Comportamiento de tus puntos de compra</span>
            <div className="flex items-center gap-2 flex-wrap">
              {btcTransactions.slice(0, 4).map((tx, idx) => {
                const priceDiff = liveBtcPriceMxn - tx.purchasePricePerBTC;
                const isWinner = priceDiff >= 0;
                return (
                  <span
                    key={tx.id}
                    className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${
                      isWinner 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" 
                        : "bg-rose-500/10 border-rose-500/20 text-rose-300"
                    }`}
                  >
                    C{idx + 1}: {isWinner ? "🏆 Ganancia" : "🔻 Pérdida"}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
