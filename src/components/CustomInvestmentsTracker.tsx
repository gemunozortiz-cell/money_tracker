/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { TrendingUp, TrendingDown, Plus, Trash2, ArrowUpRight, ArrowDownRight, Globe, Layers, DollarSign, Calendar, Briefcase, PlusCircle, Check, X, Tag, Loader2, Search } from "lucide-react";
import { CustomAsset, CustomAssetPurchase } from "../types";
import { todayLocalYmd } from "../lib/dates";

interface LookupResult {
  found: boolean;
  symbol: string;
  name?: string;
  type?: string;
  priceUsd?: number | null;
  priceMxn?: number | null;
  exchange?: string | null;
  currency?: string;
  changePercent?: number | null;
  marketState?: string | null;
  error?: string;
}

interface CustomInvestmentsTrackerProps {
  customAssets: CustomAsset[];
  customAssetPurchases: CustomAssetPurchase[];
  onAddAsset: (name: string, symbol: string, type: string, initialPriceMxn: number, initialPriceUsd: number) => void;
  onDeleteAsset: (id: string) => void;
  onAddPurchase: (assetId: string, date: string, montoMXN: number, cantidadUnits: number) => void;
  onDeletePurchase: (id: string) => void;
}

export function CustomInvestmentsTracker({
  customAssets = [],
  customAssetPurchases = [],
  onAddAsset,
  onDeleteAsset,
  onAddPurchase,
  onDeletePurchase
}: CustomInvestmentsTrackerProps) {
  const [showAddAssetForm, setShowAddAssetForm] = useState(false);
  const [showAddPurchaseForm, setShowAddPurchaseForm] = useState(false);

  // Add Asset form state
  const [assetName, setAssetName] = useState("");
  const [assetSymbol, setAssetSymbol] = useState("");
  const [assetType, setAssetType] = useState("Acción");
  const [assetPriceMxn, setAssetPriceMxn] = useState("");
  const [assetPriceUsd, setAssetPriceUsd] = useState("");
  const [assetFormError, setAssetFormError] = useState("");

  // Add Purchase form state
  const [purchaseAssetId, setPurchaseAssetId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayLocalYmd());
  const [purchaseMontoMxn, setPurchaseMontoMxn] = useState("");
  const [purchaseCantidadUnits, setPurchaseCantidadUnits] = useState("");
  const [purchaseFormError, setPurchaseFormError] = useState("");

  // Clean confirmation states to bypass Sandbox/iFrame blocked confirm warnings
  const [deleteConfirmAssetId, setDeleteConfirmAssetId] = useState<string | null>(null);
  const [deleteConfirmPurchaseId, setDeleteConfirmPurchaseId] = useState<string | null>(null);

  // Ticker autocomplete state
  const [lookupStatus, setLookupStatus] = useState<"idle" | "searching" | "found" | "notfound" | "error">("idle");
  const [lookupData, setLookupData] = useState<LookupResult | null>(null);
  const lookupAbortRef = useRef<AbortController | null>(null);

  // Debounced lookup: pegamos a /api/stock-lookup ~500ms después de que el usuario deja de teclear.
  useEffect(() => {
    const symbol = assetSymbol.trim().toUpperCase();
    if (!showAddAssetForm) return;
    if (symbol.length < 1) {
      setLookupStatus("idle");
      setLookupData(null);
      return;
    }

    // Abort any in-flight lookup
    lookupAbortRef.current?.abort();
    const controller = new AbortController();
    lookupAbortRef.current = controller;

    setLookupStatus("searching");
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/stock-lookup?symbol=${encodeURIComponent(symbol)}`, { signal: controller.signal });
        const j: LookupResult = await r.json();
        if (controller.signal.aborted) return;
        if (j.found) {
          setLookupStatus("found");
          setLookupData(j);
          // Auto-fill the rest of the form
          if (j.name) setAssetName(j.name);
          if (j.type) setAssetType(j.type);
          if (j.priceMxn != null) setAssetPriceMxn(String(j.priceMxn));
          if (j.priceUsd != null) setAssetPriceUsd(String(j.priceUsd));
        } else {
          setLookupStatus("notfound");
          setLookupData(j);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setLookupStatus("error");
          setLookupData({ found: false, symbol, error: e?.message });
        }
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetSymbol, showAddAssetForm]);

  // Reset autocomplete state when form closes
  useEffect(() => {
    if (!showAddAssetForm) {
      setLookupStatus("idle");
      setLookupData(null);
    }
  }, [showAddAssetForm]);

  // Filter and compute assets
  const computedAssets = customAssets.map(asset => {
    const purchases = customAssetPurchases.filter(p => p.assetId === asset.id);
    const totalUnits = purchases.reduce((acc, p) => acc + p.cantidadUnits, 0);
    const totalInvestedMxn = purchases.reduce((acc, p) => acc + p.montoMXN, 0);
    const currentValuationMxn = totalUnits * asset.livePriceMxn;
    const currentValuationUsd = totalUnits * asset.livePriceUsd;
    const profitMxn = currentValuationMxn - totalInvestedMxn;
    const profitPercent = totalInvestedMxn > 0 ? (profitMxn / totalInvestedMxn) * 100 : 0;
    
    return {
      ...asset,
      totalUnits,
      totalInvestedMxn,
      currentValuationMxn,
      currentValuationUsd,
      profitMxn,
      profitPercent,
      purchasesCount: purchases.length
    };
  });

  const totalAssetsInvested = computedAssets.reduce((acc, a) => acc + a.totalInvestedMxn, 0);
  const totalAssetsValuation = computedAssets.reduce((acc, a) => acc + a.currentValuationMxn, 0);
  const totalAssetsProfit = totalAssetsValuation - totalAssetsInvested;
  const totalAssetsProfitPercent = totalAssetsInvested > 0 ? (totalAssetsProfit / totalAssetsInvested) * 100 : 0;

  const handleCreateAsset = (e: React.FormEvent) => {
    e.preventDefault();
    const mxn = parseFloat(assetPriceMxn);
    const usd = parseFloat(assetPriceUsd);

    if (!assetName.trim()) {
      setAssetFormError("El nombre del activo es obligatorio.");
      return;
    }
    if (!assetSymbol.trim()) {
      setAssetFormError("El símbolo de cotización (Ticker) es obligatorio.");
      return;
    }
    if (isNaN(mxn) || mxn <= 0) {
      setAssetFormError("Por favor ingresa un precio válido en MXN.");
      return;
    }
    if (isNaN(usd) || usd <= 0) {
      setAssetFormError("Por favor ingresa un precio válido en USD.");
      return;
    }

    onAddAsset(assetName.trim(), assetSymbol.trim().toUpperCase(), assetType, mxn, usd);
    setAssetName("");
    setAssetSymbol("");
    setAssetPriceMxn("");
    setAssetPriceUsd("");
    setAssetFormError("");
    setShowAddAssetForm(false);
  };

  const handleCreatePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const monto = parseFloat(purchaseMontoMxn);
    const units = parseFloat(purchaseCantidadUnits);

    if (!purchaseAssetId) {
      setPurchaseFormError("Debe seleccionar un activo de inversión.");
      return;
    }
    if (isNaN(monto) || monto <= 0) {
      setPurchaseFormError("El monto invertido en MXN debe ser un número positivo.");
      return;
    }
    if (isNaN(units) || units <= 0) {
      setPurchaseFormError("La cantidad de títulos o acciones compradas debe ser positiva.");
      return;
    }

    onAddPurchase(purchaseAssetId, purchaseDate, monto, units);
    setPurchaseMontoMxn("");
    setPurchaseCantidadUnits("");
    setPurchaseFormError("");
    setShowAddPurchaseForm(false);
  };

  return (
    <div className="bg-white/[0.04] backdrop-blur-md rounded-3xl border border-white/10 p-6 mb-8 shadow-xl relative z-10" id="custom-investments-section">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-lg font-display">Inversiones de Capital Variable (S&P 500, Acciones, ETF)</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Agrega tus activos e introduce tus compras con fecha y precio histórico. Los tickers fluctúan estimando el mercado diario.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setAssetFormError("");
              setShowAddAssetForm(!showAddAssetForm);
              setShowAddPurchaseForm(false);
            }}
            className="flex items-center gap-1.5 py-1.5 px-3 text-xs font-bold rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 transition-all border border-indigo-500/25 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Nuevo Activo
          </button>
          
          <button
            onClick={() => {
              if (customAssets.length === 0) {
                alert("Primero debes crear un activo.");
                return;
              }
              setPurchaseFormError("");
              if (!purchaseAssetId && customAssets.length > 0) {
                setPurchaseAssetId(customAssets[0].id);
              }
              setShowAddPurchaseForm(!showAddPurchaseForm);
              setShowAddAssetForm(false);
            }}
            className="flex items-center gap-1.5 py-1.5 px-3 text-xs font-bold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition-all border border-emerald-500/25 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Registrar Compra
          </button>
        </div>
      </div>

      {/* PORTFOLIO ACCRUED BOX */}
      {computedAssets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-white/5 border border-white/10 rounded-2xl">
          <div className="text-center md:text-left border-b md:border-b-0 md:border-r border-white/10 pb-3 md:pb-0 md:pr-4">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-display">Valor Total Estimado</span>
            <span className="text-2xl font-black text-white block mt-0.5 font-mono">
              ${totalAssetsValuation.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
            </span>
          </div>
          <div className="text-center md:text-left border-b md:border-b-0 md:border-r border-white/10 pb-3 md:pb-0 md:px-4">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-display">Capital Invertido Histórico</span>
            <span className="text-2xl font-bold text-slate-300 block mt-0.5 font-mono">
              ${totalAssetsInvested.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
            </span>
          </div>
          <div className="text-center md:text-left pt-3 md:pt-0 md:pl-4">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-display">Plusvalía / Minusvalía Acumulada</span>
            <div className="flex items-center justify-center md:justify-start gap-1.5 mt-1">
              {totalAssetsProfit >= 0 ? (
                <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  <span className="text-sm font-black font-mono">
                    +${totalAssetsProfit.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (+{totalAssetsProfitPercent.toFixed(2)}%)
                  </span>
                </span>
              ) : (
                <span className="p-1 rounded-md bg-rose-500/10 text-rose-400 flex items-center">
                  <TrendingDown className="w-4 h-4 mr-1" />
                  <span className="text-sm font-black font-mono">
                    -${Math.abs(totalAssetsProfit).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totalAssetsProfitPercent.toFixed(2)}%)
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD ASSET FORM — ticker-first con autocompletado desde Yahoo Finance */}
      {showAddAssetForm && (
        <form onSubmit={handleCreateAsset} className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 space-y-3 animate-fade-in">
          {/* TICKER (campo principal) */}
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1 flex items-center gap-1.5">
              <Search className="w-3 h-3 text-indigo-400" />
              Ticker (escribe y se autocompleta)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ej. SPY, AAPL, NVDA, AMZN, BIMBOA.MX"
                value={assetSymbol}
                onChange={e => setAssetSymbol(e.target.value.toUpperCase())}
                className="w-full bg-[#12192c] border border-white/10 text-white placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-hidden focus:border-indigo-400 font-mono tracking-wider pr-10"
                autoFocus
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {lookupStatus === "searching" && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
                {lookupStatus === "found" && <Check className="w-4 h-4 text-emerald-400" />}
                {lookupStatus === "notfound" && <X className="w-4 h-4 text-rose-400" />}
              </div>
            </div>

            {/* Preview de lo encontrado */}
            {lookupStatus === "found" && lookupData?.found && (
              <div className="mt-2 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2.5 text-xs">
                <Globe className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-white truncate">{lookupData.name}</span>
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 flex-shrink-0">
                      {lookupData.type}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                    {lookupData.exchange} · {lookupData.currency}
                    {lookupData.changePercent != null && (
                      <span className={lookupData.changePercent >= 0 ? "text-emerald-400 ml-1.5" : "text-rose-400 ml-1.5"}>
                        {lookupData.changePercent >= 0 ? "+" : ""}{lookupData.changePercent.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-black text-white font-mono">
                    ${lookupData.priceUsd?.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    ${lookupData.priceMxn?.toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN
                  </div>
                </div>
              </div>
            )}
            {lookupStatus === "notfound" && (
              <p className="text-[10px] text-rose-300 mt-1.5 leading-snug">
                ⚠️ No encontramos "{assetSymbol}". Para acciones mexicanas prueba con sufijo <code className="font-mono bg-white/5 px-1 rounded">.MX</code> (ej. BIMBOA.MX). Puedes seguir y llenar manualmente.
              </p>
            )}
          </div>

          {/* Campos auto-fill (visibles colapsados si hay match, abiertos si no) */}
          <details open={lookupStatus !== "found"} className="group">
            <summary className="text-[10px] uppercase font-bold tracking-wider text-slate-400 cursor-pointer select-none flex items-center gap-1 hover:text-slate-300">
              <span>Ajustar datos manualmente</span>
              <span className="text-slate-500 group-open:rotate-90 transition-transform inline-block">▸</span>
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <div>
                <label className="text-[10px] text-slate-400 font-bold">Nombre</label>
                <input
                  type="text"
                  placeholder="Apple Inc."
                  value={assetName}
                  onChange={e => setAssetName(e.target.value)}
                  className="w-full bg-[#12192c] border border-white/10 text-white placeholder-slate-500 rounded-lg px-3 py-1.5 text-xs focus:outline-hidden focus:border-indigo-400 mt-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold">Tipo</label>
                <select
                  value={assetType}
                  onChange={e => setAssetType(e.target.value)}
                  className="w-full bg-[#12192c] border border-white/10 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-hidden focus:border-indigo-400 mt-0.5"
                >
                  <option value="Acción">Acción</option>
                  <option value="Índice">Índice / ETF</option>
                  <option value="Fondo">Fondo de Inversión</option>
                  <option value="Cripto">Criptoactivo</option>
                  <option value="FIBRA">FIBRA / Bienes Raíces</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold">Precio MXN</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={assetPriceMxn}
                  onChange={e => setAssetPriceMxn(e.target.value)}
                  className="w-full bg-[#12192c] border border-white/10 text-white placeholder-slate-500 rounded-lg px-3 py-1.5 text-xs focus:outline-hidden focus:border-indigo-400 font-mono mt-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold">Precio USD</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={assetPriceUsd}
                  onChange={e => setAssetPriceUsd(e.target.value)}
                  className="w-full bg-[#12192c] border border-white/10 text-white placeholder-slate-500 rounded-lg px-3 py-1.5 text-xs focus:outline-hidden focus:border-indigo-400 font-mono mt-0.5"
                />
              </div>
            </div>
          </details>

          {assetFormError && (
            <div className="text-xs text-rose-450 font-semibold bg-rose-500/10 border border-rose-500/25 p-2 rounded-lg">
              {assetFormError}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={lookupStatus === "searching"}
              className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-600/40 text-white rounded-xl font-bold text-xs py-2.5 px-3.5 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Crear activo
            </button>
            <button
              type="button"
              onClick={() => setShowAddAssetForm(false)}
              className="px-4 py-2.5 bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* REGISTRATION PURCHASE FORM */}
      {showAddPurchaseForm && (
        <form onSubmit={handleCreatePurchase} className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3 animate-fade-in">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Activo</label>
            <select
              value={purchaseAssetId}
              onChange={e => setPurchaseAssetId(e.target.value)}
              className="w-full bg-[#12192c] border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-indigo-400"
            >
              <option value="">-- Selecciona Activo --</option>
              {customAssets.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.symbol})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Fecha de Compra</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={e => setPurchaseDate(e.target.value)}
              className="w-full bg-[#12192c] border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-indigo-400 font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Importe Invertido (MXN)</label>
            <input
              type="number"
              step="any"
              placeholder="Monto total pagado"
              value={purchaseMontoMxn}
              onChange={e => setPurchaseMontoMxn(e.target.value)}
              className="w-full bg-[#12192c] border border-white/10 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-indigo-400 font-mono"
            />
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Títulos / Acciones Adquiridos</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 1.345"
                value={purchaseCantidadUnits}
                onChange={e => setPurchaseCantidadUnits(e.target.value)}
                className="w-full bg-[#12192c] border border-white/10 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-indigo-400 font-mono"
              />
            </div>
            <button
              type="submit"
              className="py-2 px-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              Registrar
            </button>
          </div>
          {purchaseFormError && (
            <div className="col-span-full text-xs text-rose-450 font-semibold bg-rose-500/10 border border-rose-500/25 p-2 rounded-lg">
              {purchaseFormError}
            </div>
          )}
        </form>
      )}

      {/* ASSETS AND TICKERS LIST */}
      {computedAssets.length === 0 ? (
        <div className="text-center py-10 bg-white/[0.01] border border-dashed border-white/10 rounded-2xl">
          <Layers className="w-8 h-8 text-slate-500 mx-auto opacity-40 mb-2" />
          <h4 className="text-sm font-bold text-slate-300">No hay activos de renta variable registrados</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Agrega tu inversión a fondos como el S&P 500, acciones corporativas o títulos seleccionados para ver el rendimiento en vivo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {computedAssets.map(asset => (
            <div key={asset.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-indigo-500/30 transition-all shadow-md group relative">
              
              {/* Delete asset pill hidden by default but shown on group-hover */}
              <button
                onClick={() => setDeleteConfirmAssetId(asset.id)}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-red-500/20 text-red-300 hover:text-white hover:bg-red-500/40 transition-all cursor-pointer z-10"
                title="Eliminar este ticker activo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Advanced confirmation safety prompt overlay */}
              {deleteConfirmAssetId === asset.id && (
                <div className="absolute inset-0 bg-[#0c1222]/98 backdrop-blur-md rounded-2xl p-4 flex flex-col justify-center items-center text-center z-25 animate-fade-in border border-red-500/30">
                  <Trash2 className="w-8 h-8 text-red-400 mb-2" />
                  <p className="text-sm font-bold text-white">¿Eliminar {asset.symbol}?</p>
                  <p className="text-[10px] text-slate-400 mt-1 mb-4 px-2 select-none leading-relaxed">
                    Esto removerá permanentemente el activo e historial de compras. ¿Deseas proceder?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        onDeleteAsset(asset.id);
                        setDeleteConfirmAssetId(null);
                      }}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold font-display cursor-pointer transition-colors shadow-md"
                    >
                      Sí, eliminar
                    </button>
                    <button
                      onClick={() => setDeleteConfirmAssetId(null)}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-slate-300 rounded-lg text-xs font-bold font-display cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div>
                {/* Header info */}
                <div className="flex items-start gap-1.5 mb-2">
                  <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/10">
                    {asset.type}
                  </span>
                  <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                    {asset.symbol}
                  </span>
                </div>
                
                <h4 className="font-bold text-white text-base group-hover:text-indigo-300 transition-colors pr-6">
                  {asset.name}
                </h4>

                {/* Simulated Ticker Value */}
                <div className="mt-3 p-2 bg-[#0a0f1d] border border-white/5 rounded-xl font-mono relative">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Tasa actual</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-lg font-black text-white">
                      ${asset.livePriceMxn.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                    </span>
                    <span className="text-xs text-slate-400">
                      ${asset.livePriceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </span>
                  </div>
                </div>

                {/* User Holdings stats */}
                <div className="grid grid-cols-2 gap-2 mt-3.5 pt-3 border-t border-white/5">
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Unidades</span>
                    <span className="text-xs font-bold text-white font-mono">{asset.totalUnits.toFixed(4)} títulos</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Valuado en MXN</span>
                    <span className="text-xs font-bold text-white font-mono">
                      ${asset.currentValuationMxn.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Yield summary for this card */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Invertido</span>
                  <span className="text-xs font-semibold text-slate-300 font-mono">${asset.totalInvestedMxn.toLocaleString("es-MX")} MXN</span>
                </div>
                <div>
                  {asset.totalUnits > 0 ? (
                    asset.profitMxn >= 0 ? (
                      <span className="py-1 px-2 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold flex items-center font-mono">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        +{asset.profitPercent.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="py-1 px-2 rounded-lg bg-rose-500/15 text-rose-400 text-xs font-bold flex items-center font-mono">
                        <TrendingDown className="w-3 h-3 mr-1" />
                        {asset.profitPercent.toFixed(1)}%
                      </span>
                    )
                  ) : (
                    <span className="py-1 px-2 rounded-lg bg-white/5 text-slate-500 text-[10px] font-bold">Sin Compras</span>
                  )}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* HISTORICAL PURCHASES COLLAPSIBLE TABLES */}
      {computedAssets.some(a => a.purchasesCount > 0) && (
        <div className="mt-8">
          <div className="flex items-center gap-1.5 border-t border-white/10 pt-4 mb-3">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">Historial de Operaciones Renta Variable</h4>
          </div>
          
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0e1424]">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5 text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left">Activo</th>
                  <th scope="col" className="px-4 py-2 text-left">Fecha</th>
                  <th scope="col" className="px-4 py-2 text-right">Monto (MXN)</th>
                  <th scope="col" className="px-4 py-2 text-right">Títulos</th>
                  <th scope="col" className="px-4 py-2 text-right">Precio de Compra</th>
                  <th scope="col" className="px-4 py-2 text-right">Valor Actual</th>
                  <th scope="col" className="px-4 py-2 text-center">Rendimiento</th>
                  <th scope="col" className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-slate-300 font-medium">
                {computedAssets.flatMap(asset => {
                  const purchases = customAssetPurchases.filter(p => p.assetId === asset.id);
                  return purchases.map(purchase => {
                    const currentVal = purchase.cantidadUnits * asset.livePriceMxn;
                    const perfMxn = currentVal - purchase.montoMXN;
                    const perfPct = purchase.montoMXN > 0 ? (perfMxn / purchase.montoMXN) * 100 : 0;
                    
                    return (
                      <tr key={purchase.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="font-bold text-white block">{asset.name}</div>
                          <span className="text-[10px] text-indigo-400 font-mono block uppercase">{asset.symbol}</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-400">
                          {purchase.date}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">
                          ${purchase.montoMXN.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">
                          {purchase.cantidadUnits.toFixed(4)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                          ${purchase.purchasePricePerUnit.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-white">
                          ${currentVal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {perfMxn >= 0 ? (
                            <span className="inline-flex items-center text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                              <ArrowUpRight className="w-3 h-3 mr-0.5" />
                              +{perfPct.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[11px] font-mono font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-md">
                              <ArrowDownRight className="w-3 h-3 mr-0.5" />
                              {perfPct.toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {deleteConfirmPurchaseId === purchase.id ? (
                            <div className="flex items-center justify-center gap-1.5 animate-fade-in">
                              <button
                                onClick={() => {
                                  onDeletePurchase(purchase.id);
                                  setDeleteConfirmPurchaseId(null);
                                }}
                                className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-[10px] font-bold cursor-pointer transition-colors shadow-xs"
                                title="Sí, eliminar"
                              >
                                Sí
                              </button>
                              <button
                                onClick={() => setDeleteConfirmPurchaseId(null)}
                                className="px-2 py-1 bg-white/10 hover:bg-white/20 text-slate-300 rounded text-[10px] font-bold cursor-pointer transition-colors"
                                title="Cancelar"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmPurchaseId(purchase.id)}
                              className="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                              title="Descartar compra"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
