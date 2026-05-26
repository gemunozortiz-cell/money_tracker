/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { FinancialInstrument, InstrumentType, BitcoinPurchase, CustomAsset, CustomAssetPurchase, CreditCard, CreditCardExpense, Transaction } from "../types";
import { supabase } from "../lib/supabase";

export type SyncStatus = "offline" | "loading" | "syncing" | "synced" | "error";

// Parse YYYY-MM-DD as LOCAL midnight. Avoids the trap where `new Date("2026-05-22")`
// is parsed as UTC and shifts back one day in negative-offset zones (e.g. Mexico).
function parseLocalDate(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export interface PortfolioState {
  instruments: FinancialInstrument[];
  btcPurchases: BitcoinPurchase[];
  customAssets?: CustomAsset[]; // Made optional/nullable for localStorage backwards compatibility
  customAssetPurchases?: CustomAssetPurchase[];
  creditCards: CreditCard[];
  cardExpenses: CreditCardExpense[];
  transactions: Transaction[];
  currentDateOffsetDays: number; // For "time travel" simulation!
}

const INITIAL_STATE: PortfolioState = {
  instruments: [
    {
      id: "inst-nu-turbo",
      name: "Nu Caja Turbo",
      type: InstrumentType.DAILY_COMPOUND,
      initialBalance: 20226.75,
      currentBalance: 20226.75,
      annualRate: 13.0,
      createdDate: "2026-05-22"
    },
    {
      id: "inst-nu-quinela",
      name: "Nu Quiniela Primates",
      type: InstrumentType.DAILY_COMPOUND,
      initialBalance: 2041.74,
      currentBalance: 2041.74,
      annualRate: 6.5,
      createdDate: "2026-05-22"
    },
    {
      id: "inst-revolut",
      name: "Revolut",
      type: InstrumentType.DAILY_COMPOUND,
      initialBalance: 25561.10,
      currentBalance: 25561.10,
      annualRate: 15.0, // Base display rate. Tiered math handled in calculateAccruedStateOfInstrument.
      createdDate: "2026-05-22"
    }
  ],
  btcPurchases: [
    {
      id: "btc-order-1",
      date: "2026-02-09",
      montoMXN: 1648.34,
      cantidadBTC: 0.00139100,
      purchasePricePerBTC: 1185000
    },
    {
      id: "btc-order-2",
      date: "2026-02-09",
      montoMXN: 1230.74,
      cantidadBTC: 0.00104300,
      purchasePricePerBTC: 1180000
    },
    {
      id: "btc-order-3",
      date: "2026-02-09",
      montoMXN: 1120.00,
      cantidadBTC: 0.00100000,
      purchasePricePerBTC: 1120000
    }
  ],
  creditCards: [
    {
      id: "cc-bbva-azul",
      name: "BBVA Azul",
      creditLimit: 14100,
      cutoffDay: 1,
      paymentDueDay: 21,
      currentBalance: 0
    },
    {
      id: "cc-nu",
      name: "Nu Card",
      creditLimit: 8000,
      cutoffDay: 16,
      paymentDueDay: 26,
      currentBalance: 0
    },
    {
      id: "cc-plata",
      name: "Plata Card",
      creditLimit: 10000,
      cutoffDay: 9,
      paymentDueDay: 9, // cutoffDay is 9th and has 1 month to pay (runs to 9th next month)
      currentBalance: 0
    },
    {
      id: "cc-revolut",
      name: "Revolut básica",
      creditLimit: 15000,
      cutoffDay: 12,
      paymentDueDay: 2, // e.g. 2nd of following month (payment window around 20 days)
      currentBalance: 0
    }
  ],
  cardExpenses: [
    {
      id: "ccex-bbva-1",
      cardId: "cc-bbva-azul",
      concept: "Saldo utilizado BBVA Azul",
      amount: 2071.99,
      date: "2026-05-18"
    },
    {
      id: "ccex-nu-1",
      cardId: "cc-nu",
      concept: "Saldo utilizado Nu Card",
      amount: 802.00,
      date: "2026-05-18"
    },
    {
      id: "ccex-plata-1",
      cardId: "cc-plata",
      concept: "Saldo utilizado Plata Card",
      amount: 11.48,
      date: "2026-05-18"
    },
    {
      id: "ccex-revolut-1",
      cardId: "cc-revolut",
      concept: "Suscripción Claude AI ($20 USD)",
      amount: 346.42,
      date: "2026-05-12"
    }
  ],
  transactions: [],
  customAssets: [
    {
      id: "asset-spy-sp500",
      name: "S&P 500 Index Fund (SPY)",
      symbol: "SPY",
      type: "Índice",
      livePriceMxn: 11180.50,
      livePriceUsd: 554.20
    },
    {
      id: "asset-aapl-apple",
      name: "Apple Inc. Acciones",
      symbol: "AAPL",
      type: "Acción",
      livePriceMxn: 3615.00,
      livePriceUsd: 178.50
    },
    {
      id: "asset-nvda-nvidia",
      name: "NVIDIA Corp. Acciones",
      symbol: "NVDA",
      type: "Acción",
      livePriceMxn: 1912.40,
      livePriceUsd: 94.40
    }
  ],
  customAssetPurchases: [],
  currentDateOffsetDays: 0 // Allows adjusting date dynamically to simulate future compound accumulation!
};

export function usePortfolioState(userId: string | null = null) {
  const [state, setState] = useState<PortfolioState>(() => {
    try {
      const stored = localStorage.getItem("portfolio_state_v3");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure standard fields look right
        if (parsed.instruments && parsed.creditCards) {
          if (!parsed.customAssets) {
            parsed.customAssets = INITIAL_STATE.customAssets;
          }
          if (parsed.customAssetPurchases) {
            // Force filtering of default demo purchase IDs so they immediately disappear for existing sessions
            parsed.customAssetPurchases = parsed.customAssetPurchases.filter(
              (p: any) => p.id !== "buyinst-spy-1" && p.id !== "buyinst-aapl-1"
            );
          } else {
            parsed.customAssetPurchases = [];
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Could not read portfolio state, using defaults:", e);
    }
    return INITIAL_STATE;
  });

  // === Supabase sync ===
  // Cloud is source-of-truth when signed in. localStorage stays in sync as offline cache.
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("offline");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const hasLoadedFromCloudRef = useRef<boolean>(false);
  const cloudWriteTimerRef = useRef<number | null>(null);
  // When true, the current state update came from a Realtime push from another device
  // (or the same device's own write echo) — skip writing it back to avoid loops.
  const applyingRealtimeRef = useRef<boolean>(false);

  // (1) On sign-in / sign-out: refresh the cloud snapshot
  useEffect(() => {
    if (!userId || !supabase) {
      setSyncStatus("offline");
      hasLoadedFromCloudRef.current = false;
      return;
    }

    setSyncStatus("loading");
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("portfolios")
          .select("state, updated_at")
          .eq("user_id", userId)
          .maybeSingle();

        if (cancelled) return;
        if (error) throw error;

        if (data?.state && Object.keys(data.state).length > 0) {
          // Cloud has a saved portfolio → it wins (e.g. user signed in on a fresh device)
          setState(prev => ({ ...INITIAL_STATE, ...data.state, currentDateOffsetDays: prev.currentDateOffsetDays }));
        } else {
          // Cloud is empty → push whatever we have locally up (first-time setup)
          const localRaw = localStorage.getItem("portfolio_state_v3");
          const localState = localRaw ? JSON.parse(localRaw) : INITIAL_STATE;
          const { error: upsertErr } = await supabase.from("portfolios").upsert({
            user_id: userId,
            state: localState
          });
          if (upsertErr) throw upsertErr;
        }

        hasLoadedFromCloudRef.current = true;
        setSyncStatus("synced");
        setLastSyncedAt(new Date());
      } catch (e: any) {
        if (cancelled) return;
        console.error("Supabase initial load failed:", e?.message || e);
        setSyncStatus("error");
        // Still allow the app to work in offline mode after a delay
        hasLoadedFromCloudRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // (1.5) Subscribe to Realtime changes — auto-update when another device writes
  useEffect(() => {
    if (!userId || !supabase) return;
    console.log("[Realtime] Setting up subscription for user", userId);

    const channel = supabase
      .channel(`portfolio-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT or UPDATE
          schema: "public",
          table: "portfolios",
          filter: `user_id=eq.${userId}`
        },
        (payload: any) => {
          console.log("[Realtime] Event received:", payload?.eventType, payload?.new?.updated_at);
          const incoming = payload?.new?.state;
          if (!incoming) {
            console.log("[Realtime] No state in payload, ignoring");
            return;
          }
          setState(prev => {
            // Compare without `currentDateOffsetDays` (that's device-local for the time machine)
            const stripOffset = (s: any) => {
              const { currentDateOffsetDays, ...rest } = s || {};
              return JSON.stringify(rest);
            };
            if (stripOffset(prev) === stripOffset(incoming)) {
              console.log("[Realtime] State unchanged, skipping (echo from this device)");
              return prev;
            }
            console.log("[Realtime] Applying remote state change");
            applyingRealtimeRef.current = true;
            return {
              ...INITIAL_STATE,
              ...incoming,
              currentDateOffsetDays: prev.currentDateOffsetDays // keep local time machine
            };
          });
          setLastSyncedAt(new Date(payload.new.updated_at || Date.now()));
          setSyncStatus("synced");
        }
      )
      .subscribe((status: string, err?: Error) => {
        console.log("[Realtime] Subscription status:", status);
        if (err) console.error("[Realtime] Subscription error:", err);
      });

    return () => {
      console.log("[Realtime] Removing subscription");
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // (2) On every state change: write to localStorage (always) + debounced upsert to cloud (if signed in)
  useEffect(() => {
    try {
      localStorage.setItem("portfolio_state_v3", JSON.stringify(state));
    } catch (e) {
      console.error("Could not write portfolio state to localStorage:", e);
    }

    if (!userId || !supabase || !hasLoadedFromCloudRef.current) return;

    // Skip cloud write if this state update came from a Realtime push
    if (applyingRealtimeRef.current) {
      applyingRealtimeRef.current = false;
      return;
    }

    if (cloudWriteTimerRef.current) window.clearTimeout(cloudWriteTimerRef.current);
    setSyncStatus("syncing");
    // 150ms debounce: fast enough that user can't refresh between action and write,
    // slow enough to batch micro-rapid updates into a single Supabase call.
    cloudWriteTimerRef.current = window.setTimeout(async () => {
      try {
        const { error } = await supabase.from("portfolios").upsert({
          user_id: userId,
          state
        });
        if (error) throw error;
        setSyncStatus("synced");
        setLastSyncedAt(new Date());
      } catch (e: any) {
        console.error("Supabase sync failed:", e?.message || e);
        setSyncStatus("error");
      }
    }, 150);
  }, [state, userId]);

  // Safety net: if the user refreshes/closes the tab DURING a pending write,
  // flush the localStorage version to Supabase synchronously via fetch+keepalive.
  // This catches the edge case where someone hits Ctrl+R extremely fast after an action.
  useEffect(() => {
    if (!userId || !supabase) return;
    const handler = () => {
      if (!cloudWriteTimerRef.current) return;
      window.clearTimeout(cloudWriteTimerRef.current);
      cloudWriteTimerRef.current = null;
      try {
        const stateRaw = localStorage.getItem("portfolio_state_v3");
        if (!stateRaw) return;
        const sessionRaw = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
        if (!sessionRaw) return;
        const session = JSON.parse(localStorage.getItem(sessionRaw) || "null");
        const accessToken = session?.access_token;
        if (!accessToken) return;
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/portfolios`;
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${accessToken}`,
            "Prefer": "resolution=merge-duplicates"
          },
          body: JSON.stringify({ user_id: userId, state: JSON.parse(stateRaw) }),
          keepalive: true
        }).catch(() => {});
      } catch {
        /* best-effort */
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [userId]);

  // Reset helper
  const resetToDemo = () => {
    setState(INITIAL_STATE);
  };

  const clearAllData = () => {
    setState({
      instruments: [],
      btcPurchases: [],
      customAssets: [],
      customAssetPurchases: [],
      creditCards: [],
      cardExpenses: [],
      transactions: [],
      currentDateOffsetDays: 0
    });
  };

  // Modify Simulated Time Offset
  const setTimeOffset = (days: number) => {
    setState(prev => ({
      ...prev,
      currentDateOffsetDays: days
    }));
  };

  // INSTRUMENTS ACTIONS
  const addInstrument = (name: string, rate: number, initialBalance: number) => {
    const newInst: FinancialInstrument = {
      id: `inst-${Date.now()}`,
      name,
      type: InstrumentType.DAILY_COMPOUND,
      initialBalance,
      currentBalance: initialBalance,
      annualRate: rate,
      createdDate: new Date().toISOString().split("T")[0]
    };
    setState(prev => ({
      ...prev,
      instruments: [...prev.instruments, newInst]
    }));
  };

  const deleteInstrument = (id: string) => {
    setState(prev => ({
      ...prev,
      instruments: prev.instruments.filter(inst => inst.id !== id),
      transactions: prev.transactions.filter(tx => tx.instrumentId !== id)
    }));
  };

  const addTransaction = (instrumentId: string, type: "DEPOSIT" | "WITHDRAWAL", amount: number, concept?: string, customDate?: string) => {
    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      instrumentId,
      type,
      amount,
      date: customDate || new Date().toISOString().split("T")[0],
      concept: type === "WITHDRAWAL" ? (concept || "Retiro general") : concept
    };
    setState(prev => ({
      ...prev,
      transactions: [tx, ...prev.transactions]
    }));
  };

  // BITCOIN ACTIONS
  const addBitcoinPurchase = (date: string, montoMXN: number, cantidadBTC: number) => {
    const price = Math.round(montoMXN / cantidadBTC);
    const newBuy: BitcoinPurchase = {
      id: `btc-${Date.now()}`,
      date,
      montoMXN,
      cantidadBTC,
      purchasePricePerBTC: price
    };
    setState(prev => ({
      ...prev,
      btcPurchases: [newBuy, ...prev.btcPurchases]
    }));
  };

  const deleteBitcoinPurchase = (id: string) => {
    setState(prev => ({
      ...prev,
      btcPurchases: prev.btcPurchases.filter(p => p.id !== id)
    }));
  };

  // CREDIT CARDS ACTIONS
  const addCreditCard = (name: string, creditLimit: number, cutoffDay: number, paymentDueDay: number) => {
    const card: CreditCard = {
      id: `cc-${Date.now()}`,
      name,
      creditLimit,
      cutoffDay,
      paymentDueDay,
      currentBalance: 0
    };
    setState(prev => ({
      ...prev,
      creditCards: [...prev.creditCards, card]
    }));
  };

  const deleteCreditCard = (id: string) => {
    setState(prev => ({
      ...prev,
      creditCards: prev.creditCards.filter(cc => cc.id !== id),
      cardExpenses: prev.cardExpenses.filter(ex => ex.cardId !== id)
    }));
  };

  // Returns the new expense id so the caller can fire async AI categorization
  // and route the response back into setCardExpenseCategory.
  const addCardExpense = (cardId: string, concept: string, amount: number, date: string, category?: string): string => {
    const id = `ccex-${Date.now()}`;
    const expense: CreditCardExpense = {
      id,
      cardId,
      concept,
      amount,
      date,
      category
    };
    setState(prev => ({
      ...prev,
      cardExpenses: [expense, ...prev.cardExpenses]
    }));
    return id;
  };

  const deleteCardExpense = (id: string) => {
    setState(prev => ({
      ...prev,
      cardExpenses: prev.cardExpenses.filter(ex => ex.id !== id)
    }));
  };

  // Manual override OR async write from /api/categorize-expense
  const setCardExpenseCategory = (id: string, category: string) => {
    setState(prev => ({
      ...prev,
      cardExpenses: prev.cardExpenses.map(ex => ex.id === id ? { ...ex, category } : ex)
    }));
  };

  // Bulk-update categories returned from the batch endpoint
  const applyCategoryBatch = (results: Record<string, string>) => {
    setState(prev => ({
      ...prev,
      cardExpenses: prev.cardExpenses.map(ex =>
        results[ex.id] ? { ...ex, category: results[ex.id] } : ex
      )
    }));
  };

  const payCreditCard = (cardId: string, amountPaid: number) => {
    setState(prev => {
      const card = prev.creditCards.find(cc => cc.id === cardId);
      if (!card) return prev;

      // Find current active balance
      const expenses = prev.cardExpenses.filter(ex => ex.cardId === cardId);
      const prevBalance = card.manualBalance !== undefined ? card.manualBalance : expenses.reduce((acc, ex) => acc + ex.amount, 0);
      const remainingBalance = Math.max(0, prevBalance - amountPaid);

      return {
        ...prev,
        creditCards: prev.creditCards.map(cc => {
          if (cc.id === cardId) {
            return {
              ...cc,
              manualBalance: remainingBalance,
              nextPeriodOffsetMonths: (cc.nextPeriodOffsetMonths || 0) + 1
            };
          }
          return cc;
        }),
        // Add a payment entry to transaction history (negative expanse reduces balance dynamically if they remove manualBalance)
        cardExpenses: [
          {
            id: `ccex-pay-${Date.now()}`,
            cardId,
            concept: `Pago Registrado (${new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short" })})`,
            amount: -amountPaid,
            date: new Date().toISOString().split("T")[0]
          },
          ...prev.cardExpenses
        ]
      };
    });
  };

  const updateCreditCardBalance = (cardId: string, customBalance: number) => {
    setState(prev => ({
      ...prev,
      creditCards: prev.creditCards.map(cc => {
        if (cc.id === cardId) {
          return {
            ...cc,
            manualBalance: customBalance
          };
        }
        return cc;
      })
    }));
  };

  const updateCreditCardPeriod = (cardId: string, offsetMonths: number) => {
    setState(prev => ({
      ...prev,
      creditCards: prev.creditCards.map(cc => {
        if (cc.id === cardId) {
          return {
            ...cc,
            nextPeriodOffsetMonths: offsetMonths
          };
        }
        return cc;
      })
    }));
  };

  // CUSTOM ASSETS ACTIONS
  const addCustomAsset = (name: string, symbol: string, type: string, initialPriceMxn: number, initialPriceUsd: number) => {
    const asset: CustomAsset = {
      id: `asset-${Date.now()}`,
      name,
      symbol: symbol.toUpperCase(),
      type,
      livePriceMxn: initialPriceMxn,
      livePriceUsd: initialPriceUsd
    };
    setState(prev => ({
      ...prev,
      customAssets: [...(prev.customAssets || []), asset]
    }));
  };

  const deleteCustomAsset = (id: string) => {
    setState(prev => ({
      ...prev,
      customAssets: (prev.customAssets || []).filter(a => a.id !== id),
      customAssetPurchases: (prev.customAssetPurchases || []).filter(p => p.assetId !== id)
    }));
  };

  const addCustomAssetPurchase = (assetId: string, date: string, montoMXN: number, cantidadUnits: number) => {
    const asset = state.customAssets?.find(a => a.id === assetId);
    if (!asset) return;
    const purchasePrice = cantidadUnits > 0 ? Math.round((montoMXN / cantidadUnits) * 100) / 100 : 0;
    const newPurchase: CustomAssetPurchase = {
      id: `buy-${Date.now()}`,
      assetId,
      date,
      montoMXN,
      cantidadUnits,
      purchasePricePerUnit: purchasePrice
    };
    setState(prev => ({
      ...prev,
      customAssetPurchases: [newPurchase, ...(prev.customAssetPurchases || [])]
    }));
  };

  const deleteCustomAssetPurchase = (id: string) => {
    setState(prev => ({
      ...prev,
      customAssetPurchases: (prev.customAssetPurchases || []).filter(p => p.id !== id)
    }));
  };

  const updateCustomAssetPrices = (pricesMap: { [symbol: string]: { mxn: number; usd: number } }) => {
    setState(prev => {
      const updatedAssets = (prev.customAssets || []).map(asset => {
        const match = pricesMap[asset.symbol];
        if (match) {
          return {
            ...asset,
            livePriceMxn: match.mxn,
            livePriceUsd: match.usd
          };
        }
        return asset;
      });
      return {
        ...prev,
        customAssets: updatedAssets
      };
    });
  };

  // HELPERS FOR DYNAMICS & CAPITALIZATION
  // Calculates exactly what has been earned for compound interest daily
  // Takes into account historical deposits and withdrawals made at their respective dates
  const getSimulatedDate = (): Date => {
    const d = new Date();
    d.setDate(d.getDate() + state.currentDateOffsetDays);
    return d;
  };

  const calculateAccruedStateOfInstrument = (inst: FinancialInstrument, targetDate: Date) => {
    const initDate = parseLocalDate(inst.createdDate);
    initDate.setHours(0, 0, 0, 0); // Align initDate to midnight
    const rate = inst.annualRate || 0;
    const dailyRate = (rate / 100) / 365;

    // Filter transactions chronologically for this instrument
    const instTxs = [...state.transactions]
      .filter(tx => tx.instrumentId === inst.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // We start modeling day-by-day from the creation date up to the targetDate
    let currentBalance = inst.initialBalance;
    let totalInterestsEarned = 0;
    
    // Day tracker
    const cursor = new Date(initDate);
    // Align time to midnight
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(0, 0, 0, 0);

    if (cursor > end) {
      return { currentBalance, totalInterestsEarned };
    }

    // Map txs by date for faster lookup [YYYY-MM-DD]: Array of txs
    const txsByDate: { [key: string]: Transaction[] } = {};
    instTxs.forEach(t => {
      const dStr = t.date; // YYYY-MM-DD
      if (!txsByDate[dStr]) txsByDate[dStr] = [];
      txsByDate[dStr].push(t);
    });

    // Simulate each day sequentially
    while (cursor <= end) {
      const cursorStr = cursor.toISOString().split("T")[0];
      
      // 1. Process any transactions made ON this day (before daily compounding handles at end of day)
      const daysTxs = txsByDate[cursorStr] || [];
      daysTxs.forEach(tx => {
        if (tx.type === "DEPOSIT") {
          currentBalance += tx.amount;
        } else if (tx.type === "WITHDRAWAL") {
          currentBalance -= tx.amount;
          if (currentBalance < 0) currentBalance = 0; // Safeguard
        }
      });

      // 2. Compute compound interest for today
      let interestToday = 0;
      const isInitialDay = cursor.getTime() === initDate.getTime();

      if (!isInitialDay) {
        if (inst.id === "inst-revolut" || inst.name.toLowerCase().includes("revolut")) {
          // Revolut Tiered Rates:
          // Hasta $25,000 -> 15.00% Anual (ACT/360)
          // $25,000 a $1,000,000 -> 7.00% Anual (ACT/360)
          // Excedente superior a $1,000,000 -> 4.50% Anual (ACT/360)
          const tier1Limit = 25000;
          const tier2Limit = 1000000;
          const rate1 = 15;
          const rate2 = 7;
          const rate3 = 4.5;

          let grossInterestDaily = 0;
          if (currentBalance <= tier1Limit) {
            grossInterestDaily = (currentBalance * (rate1 / 100)) / 360;
          } else if (currentBalance <= tier2Limit) {
            grossInterestDaily = ((tier1Limit * (rate1 / 100)) / 360) +
                                 (((currentBalance - tier1Limit) * (rate2 / 100)) / 360);
          } else {
            grossInterestDaily = ((tier1Limit * (rate1 / 100)) / 360) +
                                 (((tier2Limit - tier1Limit) * (rate2 / 100)) / 360) +
                                 (((currentBalance - tier2Limit) * (rate3 / 100)) / 360);
          }

          // 0.90% annual withholding tax (Retención fiscal mexicano) on balance (ACT/365)
          const dailyWithholding = (currentBalance * 0.009) / 365;

          interestToday = grossInterestDaily - dailyWithholding;
          if (interestToday < 0) interestToday = 0;
        } else {
          interestToday = currentBalance * dailyRate;
        }
        currentBalance += interestToday;
        totalInterestsEarned += interestToday;
      }

      // Advance 1 day
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      currentBalance: Math.round(currentBalance * 100) / 100,
      totalInterestsEarned: Math.round(totalInterestsEarned * 100) / 100
    };
  };

  // Compile calculations to show current portfolio values
  const getComputedBalances = (simulatedTargetDate: Date) => {
    // 1. Daily compound instruments
    const computedInstruments = state.instruments.map(inst => {
      const { currentBalance, totalInterestsEarned } = calculateAccruedStateOfInstrument(inst, simulatedTargetDate);
      return {
        ...inst,
        currentBalance,
        totalInterestsEarned
      };
    });

    const totalTasaDiariaMxn = computedInstruments.reduce((acc, inst) => acc + inst.currentBalance, 0);
    const totalInteresesGanadosMxn = computedInstruments.reduce((acc, inst) => acc + inst.totalInterestsEarned, 0);

    // 2. Bitcoin purchase summary
    const totalBtc = state.btcPurchases.reduce((acc, buy) => acc + buy.cantidadBTC, 0);
    const totalBtcInvestedMxn = state.btcPurchases.reduce((acc, buy) => acc + buy.montoMXN, 0);

    // 2.5. Custom Variable Assets summary
    const computedCustomAssets = (state.customAssets || []).map(asset => {
      const purchases = (state.customAssetPurchases || []).filter(p => p.assetId === asset.id);
      const totalUnits = purchases.reduce((acc, p) => acc + p.cantidadUnits, 0);
      const totalInvestedMxn = purchases.reduce((acc, p) => acc + p.montoMXN, 0);
      const currentValuationMxn = totalUnits * asset.livePriceMxn;
      const currentValuationUsd = totalUnits * asset.livePriceUsd;
      const profitMxn = currentValuationMxn - totalInvestedMxn;
      const profitPercent = totalInvestedMxn > 0 ? (profitMxn / totalInvestedMxn) * 100 : 0;
      return {
        ...asset,
        purchases,
        totalUnits,
        totalInvestedMxn,
        currentValuationMxn,
        currentValuationUsd,
        profitMxn,
        profitPercent
      };
    });

    const totalCustomAssetsValuationMxn = computedCustomAssets.reduce((acc, asset) => acc + asset.currentValuationMxn, 0);
    const totalCustomAssetsInvestedMxn = computedCustomAssets.reduce((acc, asset) => acc + asset.totalInvestedMxn, 0);

    // 3. Credit cards totals
    const computedCreditCards = state.creditCards.map(cc => {
      // Filter expenses corresponding to this card
      const expenses = state.cardExpenses.filter(ex => ex.cardId === cc.id);
      const usedBalance = cc.manualBalance !== undefined ? cc.manualBalance : expenses.reduce((acc, ex) => acc + ex.amount, 0);
      return {
        ...cc,
        currentBalance: Math.round(usedBalance * 100) / 100
      };
    });

    const totalDeudaTdcMxn = computedCreditCards.reduce((acc, cc) => acc + cc.currentBalance, 0);

    return {
      computedInstruments,
      totalTasaDiariaMxn,
      totalInteresesGanadosMxn,
      totalBtc,
      totalBtcInvestedMxn,
      computedCustomAssets,
      totalCustomAssetsValuationMxn,
      totalCustomAssetsInvestedMxn,
      computedCreditCards,
      totalDeudaTdcMxn
    };
  };

  // Historical net worth series — used by the portfolio chart.
  // btcHistory: array of { date: YYYY-MM-DD, priceMxn }. Use null/empty for "use current price for all days".
  // stockHistory: { [symbol]: [{ date, priceUsd }] }. Same fallback.
  // currentBtcMxn / usdMxn / currentStockMxn used as fallback when no historical price for a given day.
  const getHistoricalNetWorth = (
    daysBack: number,
    btcHistory: { date: string; priceMxn: number }[] | null,
    stockHistory: Record<string, { date: string; priceUsd: number }[]> | null,
    currentBtcMxn: number,
    currentUsdMxn: number
  ) => {
    const series: { date: string; netWorth: number; liquidity: number; investments: number; debt: number }[] = [];
    const today = getSimulatedDate();
    today.setHours(0, 0, 0, 0);

    // Index btc history by date for O(1) lookup, fill gaps via last-known
    const btcByDate: Record<string, number> = {};
    if (btcHistory && btcHistory.length > 0) {
      btcHistory.forEach(p => { btcByDate[p.date] = p.priceMxn; });
    }
    const stocksByDate: Record<string, Record<string, number>> = {}; // symbol -> date -> priceUsd
    if (stockHistory) {
      Object.entries(stockHistory).forEach(([sym, points]) => {
        stocksByDate[sym] = {};
        points.forEach(p => { stocksByDate[sym][p.date] = p.priceUsd; });
      });
    }

    const lookupBtc = (dStr: string): number => {
      if (btcByDate[dStr] != null) return btcByDate[dStr];
      // Fall back to last known historical price before this date
      if (btcHistory && btcHistory.length > 0) {
        for (let i = btcHistory.length - 1; i >= 0; i--) {
          if (btcHistory[i].date <= dStr) return btcHistory[i].priceMxn;
        }
        return btcHistory[0].priceMxn;
      }
      return currentBtcMxn;
    };

    const lookupStockUsd = (sym: string, dStr: string): number | null => {
      const tbl = stocksByDate[sym];
      if (tbl && tbl[dStr] != null) return tbl[dStr];
      if (stockHistory?.[sym]?.length) {
        const arr = stockHistory[sym];
        for (let i = arr.length - 1; i >= 0; i--) {
          if (arr[i].date <= dStr) return arr[i].priceUsd;
        }
        return arr[0].priceUsd;
      }
      return null;
    };

    for (let i = daysBack; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const dStr = day.toISOString().split("T")[0];

      // 1) Liquidity: sum of instrument balances accrued to this day
      let liquidity = 0;
      state.instruments.forEach(inst => {
        const created = parseLocalDate(inst.createdDate);
        created.setHours(0, 0, 0, 0);
        if (created > day) return; // not yet created
        const { currentBalance } = calculateAccruedStateOfInstrument(inst, day);
        liquidity += currentBalance;
      });

      // 2) BTC valuation: total BTC purchased on/before this day × historical BTC price that day
      const btcOnDay = state.btcPurchases
        .filter(p => p.date <= dStr)
        .reduce((acc, p) => acc + p.cantidadBTC, 0);
      const btcValue = btcOnDay * lookupBtc(dStr);

      // 3) Custom assets valuation: per-symbol units on/before that day × historical USD price * USD/MXN
      let customValue = 0;
      (state.customAssets || []).forEach(asset => {
        const units = (state.customAssetPurchases || [])
          .filter(p => p.assetId === asset.id && p.date <= dStr)
          .reduce((acc, p) => acc + p.cantidadUnits, 0);
        if (units === 0) return;
        const priceUsd = lookupStockUsd(asset.symbol, dStr);
        if (priceUsd != null) {
          customValue += units * priceUsd * currentUsdMxn;
        } else {
          // No historical price for this symbol — use current MXN price as approximation
          customValue += units * asset.livePriceMxn;
        }
      });

      // 4) Debt: cumulative card expenses up to this day (positive amounts only count as debt;
      //    payments are stored as negative amounts so net works correctly).
      const debt = Math.max(0, state.cardExpenses
        .filter(ex => ex.date <= dStr)
        .reduce((acc, ex) => acc + ex.amount, 0));

      const investments = btcValue + customValue;
      const netWorth = liquidity + investments - debt;
      series.push({ date: dStr, netWorth, liquidity, investments, debt });
    }

    return series;
  };

  return {
    state,
    getSimulatedDate,
    getComputedBalances,
    getHistoricalNetWorth,
    setTimeOffset,
    resetToDemo,
    clearAllData,
    addInstrument,
    deleteInstrument,
    addTransaction,
    addBitcoinPurchase,
    deleteBitcoinPurchase,
    addCustomAsset,
    deleteCustomAsset,
    addCustomAssetPurchase,
    deleteCustomAssetPurchase,
    updateCustomAssetPrices,
    addCreditCard,
    deleteCreditCard,
    addCardExpense,
    deleteCardExpense,
    setCardExpenseCategory,
    applyCategoryBatch,
    payCreditCard,
    updateCreditCardBalance,
    updateCreditCardPeriod,
    // Sync info
    syncStatus,
    lastSyncedAt
  };
}
