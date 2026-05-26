/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useCallback } from "react";

export interface BtcLiveData {
  priceMxn: number;
  priceUsd: number;
  isLive: boolean;
  source: string;
  loading: boolean;
}

export interface FxLiveData {
  usdMxn: number;
  isLive: boolean;
  source: string;
  loading: boolean;
}

export interface StockPrice {
  symbol: string;
  name: string;
  priceUsd: number;
  priceMxn: number;
  changePercent: number | null;
  marketState: string;
}

export interface StocksLiveData {
  prices: StockPrice[];
  isLive: boolean;
  source: string;
  loading: boolean;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  link: string;
  date: string;
  source: string;
  category: string;
}

export interface NewsLiveData {
  news: NewsItem[];
  isLive: boolean;
  source: string;
  loading: boolean;
}

// Bitcoin: poll every 30s (CoinGecko free-tier safe via backend cache).
export function useLiveBtc() {
  const [data, setData] = useState<BtcLiveData>({
    priceMxn: 1835000,
    priceUsd: 104850,
    isLive: false,
    source: "Sincronizando...",
    loading: true
  });

  const refresh = useCallback(async () => {
    setData(prev => ({ ...prev, loading: true }));
    try {
      const r = await fetch("/api/btc-price");
      const j = await r.json();
      setData({
        priceMxn: j.price,
        priceUsd: j.priceUsd,
        isLive: !!j.isLive,
        source: j.source === "coingecko" ? "CoinGecko" : j.source === "cache-stale" ? "Caché (sin conexión)" : "Simulado",
        loading: false
      });
    } catch (e) {
      setData(prev => ({ ...prev, loading: false, isLive: false, source: "Error de red" }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { ...data, refresh };
}

// USD/MXN: poll every 5 min (rate doesn't change second-by-second).
export function useLiveFx() {
  const [data, setData] = useState<FxLiveData>({
    usdMxn: 17.5,
    isLive: false,
    source: "Sincronizando...",
    loading: true
  });

  const refresh = useCallback(async () => {
    setData(prev => ({ ...prev, loading: true }));
    try {
      const r = await fetch("/api/fx-rate");
      const j = await r.json();
      setData({
        usdMxn: j.usdMxn,
        isLive: !!j.isLive,
        source: j.source || "desconocido",
        loading: false
      });
    } catch {
      setData(prev => ({ ...prev, loading: false, isLive: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5 * 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { ...data, refresh };
}

// Stocks: poll every 60s during market hours (backend already throttles).
export function useLiveStocks(symbols: string[]) {
  const key = symbols.slice().sort().join(",");
  const [data, setData] = useState<StocksLiveData>({
    prices: [],
    isLive: false,
    source: "Sincronizando...",
    loading: true
  });

  const refresh = useCallback(async () => {
    if (symbols.length === 0) {
      setData({ prices: [], isLive: false, source: "sin símbolos", loading: false });
      return;
    }
    setData(prev => ({ ...prev, loading: true }));
    try {
      const r = await fetch(`/api/stock-prices?symbols=${encodeURIComponent(key)}`);
      const j = await r.json();
      setData({
        prices: j.prices || [],
        isLive: !!j.isLive,
        source: j.source || "desconocido",
        loading: false
      });
    } catch {
      setData(prev => ({ ...prev, loading: false, isLive: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { ...data, refresh };
}

// Historical BTC prices (daily). Refreshes hourly.
export interface BtcHistoryPoint { date: string; priceMxn: number; }
export function useBtcHistory(days: number) {
  const [series, setSeries] = useState<BtcHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/btc-history?days=${days}`);
      const j = await r.json();
      setSeries(j.series || []);
      setIsLive(!!j.isLive);
    } catch {
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60 * 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { series, loading, isLive, refresh };
}

// Historical stock prices (daily). Refreshes hourly.
export interface StockHistoryPoint { date: string; priceUsd: number; }
export function useStocksHistory(symbols: string[], days: number) {
  const key = symbols.slice().sort().join(",");
  const [seriesBySymbol, setSeriesBySymbol] = useState<Record<string, StockHistoryPoint[]>>({});
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const refresh = useCallback(async () => {
    if (symbols.length === 0) {
      setSeriesBySymbol({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/stock-history?symbols=${encodeURIComponent(key)}&days=${days}`);
      const j = await r.json();
      setSeriesBySymbol(j.seriesBySymbol || {});
      setIsLive(!!j.isLive);
    } catch {
      setIsLive(false);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, days]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60 * 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { seriesBySymbol, loading, isLive, refresh };
}

// News: poll every 10 min (RSS feeds don't update faster than that).
export function useLiveNews() {
  const [data, setData] = useState<NewsLiveData>({
    news: [],
    isLive: false,
    source: "Sincronizando...",
    loading: true
  });

  const refresh = useCallback(async () => {
    setData(prev => ({ ...prev, loading: true }));
    try {
      const r = await fetch("/api/news");
      const j = await r.json();
      setData({
        news: j.news || [],
        isLive: !!j.isLive,
        source: j.source || "desconocido",
        loading: false
      });
    } catch {
      setData(prev => ({ ...prev, loading: false, isLive: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10 * 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { ...data, refresh };
}
