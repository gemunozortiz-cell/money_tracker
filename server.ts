/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// ============================================================
// In-memory TTL cache shared by upstream-API endpoints.
// Protects against rate limits (CoinGecko 30/min, Yahoo, RSS hosts)
// and keeps mobile responses fast and battery-friendly.
// ============================================================
type CacheEntry = { value: any; expiresAt: number };
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}
function cacheSet(key: string, value: any, ttlMs: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function fetchWithTimeout(url: string, timeoutMs = 6000, init?: RequestInit) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// Per-IP rate limit for Gemini endpoints (tokens cost real money).
const geminiHits = new Map<string, number[]>();
function geminiRateLimited(ip: string, maxPerMinute = 8): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  const hits = (geminiHits.get(ip) || []).filter(t => t > windowStart);
  hits.push(now);
  geminiHits.set(ip, hits);
  return hits.length > maxPerMinute;
}

// ============================================================
// Gemini client (lazy)
// ============================================================
let aiClient: any = null;
function getGeminiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY is missing. AI advisor is currently in helper demonstration mode.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: { headers: { 'User-Agent': 'control-de-portafolio' } }
    });
  }
  return aiClient;
}

// `gemini-3.5-flash` does NOT exist — that was the silent bug that kept the
// app stuck in fallback mode. 2.5-flash is current, fast and cheap.
const GEMINI_MODEL_PRIMARY = "gemini-2.5-flash";
const GEMINI_MODEL_FALLBACK = "gemini-2.0-flash-exp";

// Calls Gemini with: 1 retry on 503/UNAVAILABLE → swap to a different model.
// Surfaces structured errors so the client can show precise messages.
async function callGeminiResilient(opts: { contents: string; systemInstruction: string }): Promise<{ text: string; modelUsed: string }> {
  const ai = getGeminiClient();
  const errors: string[] = [];

  for (const model of [GEMINI_MODEL_PRIMARY, GEMINI_MODEL_FALLBACK]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: opts.contents,
          config: { systemInstruction: opts.systemInstruction }
        });
        return { text: response.text, modelUsed: model };
      } catch (err: any) {
        const msg = err?.message || String(err);
        const isOverloaded = /503|UNAVAILABLE|overloaded|high demand/i.test(msg);
        errors.push(`${model}/attempt${attempt + 1}: ${msg.slice(0, 200)}`);
        if (!isOverloaded) {
          // Not a retryable error — bubble up immediately
          throw err;
        }
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }
  }
  const e = new Error(`Gemini overloaded on both models. Details: ${errors.join(" | ")}`);
  (e as any).isOverloaded = true;
  throw e;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "1mb" }));

  // ============================================================
  // /api/btc-price — real CoinGecko, honest isLive flag
  // ============================================================
  app.get("/api/btc-price", async (_req, res) => {
    const cached = cacheGet("btc-price");
    if (cached) return res.json(cached);

    try {
      const response = await fetchWithTimeout(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=mxn,usd",
        5000
      );
      if (response.ok) {
        const data: any = await response.json();
        if (data?.bitcoin?.mxn) {
          const payload = {
            price: data.bitcoin.mxn,
            priceUsd: data.bitcoin.usd,
            source: "coingecko",
            isLive: true,
            timestamp: new Date().toISOString()
          };
          cacheSet("btc-price", payload, 30_000);
          cacheSet("btc-price-last", payload, 24 * 60 * 60_000);
          return res.json(payload);
        }
      }
      throw new Error("Invalid CoinGecko response");
    } catch (error: any) {
      const last = cacheGet("btc-price-last");
      if (last) return res.json({ ...last, source: "cache-stale", isLive: false });
      return res.json({
        price: 1835000,
        priceUsd: 104850,
        source: "fallback",
        isLive: false,
        error: error?.message || "upstream-failed",
        timestamp: new Date().toISOString()
      });
    }
  });

  // ============================================================
  // /api/fx-rate — real USD/MXN. exchangerate.host with er-api backup. No key.
  // ============================================================
  app.get("/api/fx-rate", async (_req, res) => {
    const cached = cacheGet("fx-rate");
    if (cached) return res.json(cached);

    const sources = [
      { url: "https://api.exchangerate.host/latest?base=USD&symbols=MXN", path: ["rates", "MXN"], name: "exchangerate.host" },
      { url: "https://open.er-api.com/v6/latest/USD", path: ["rates", "MXN"], name: "open-er-api" },
    ];

    for (const src of sources) {
      try {
        const r = await fetchWithTimeout(src.url, 5000);
        if (!r.ok) continue;
        const data: any = await r.json();
        let val: any = data;
        for (const k of src.path) val = val?.[k];
        if (typeof val === "number" && val > 5 && val < 100) {
          const payload = {
            usdMxn: Math.round(val * 10000) / 10000,
            source: src.name,
            isLive: true,
            timestamp: new Date().toISOString()
          };
          cacheSet("fx-rate", payload, 5 * 60_000);
          cacheSet("fx-rate-last", payload, 24 * 60 * 60_000);
          return res.json(payload);
        }
      } catch { /* try next */ }
    }

    const last = cacheGet("fx-rate-last");
    if (last) return res.json({ ...last, source: "cache-stale", isLive: false });
    return res.json({ usdMxn: 17.5, source: "fallback", isLive: false, timestamp: new Date().toISOString() });
  });

  // ============================================================
  // /api/stock-prices?symbols=SPY,AAPL,NVDA — Yahoo Finance unofficial.
  // Returns USD and MXN (converted via cached FX).
  // ============================================================
  app.get("/api/stock-prices", async (req, res) => {
    const symbolsRaw = String(req.query.symbols || "SPY,AAPL,NVDA").toUpperCase();
    const symbols = symbolsRaw.split(",").map(s => s.trim()).filter(Boolean).slice(0, 12);
    const cacheKey = `stocks:${symbols.join(",")}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    let usdMxn = 17.5;
    let fxLive = false;
    const fx = cacheGet("fx-rate") || cacheGet("fx-rate-last");
    if (fx?.usdMxn) { usdMxn = fx.usdMxn; fxLive = fx.isLive ?? false; }

    try {
      // Use the chart endpoint per symbol (still works without auth, unlike /v7/finance/quote).
      const settled = await Promise.allSettled(symbols.map(s => fetchYahooMeta(s)));
      const prices = settled.flatMap((r) => {
        if (r.status !== "fulfilled") return [];
        const meta = r.value;
        const priceUsd: number | null = meta.regularMarketPrice ?? null;
        if (priceUsd == null) return [];
        const previousClose: number | null = meta.previousClose ?? meta.chartPreviousClose ?? null;
        const changePercent = (previousClose != null && previousClose > 0)
          ? ((priceUsd - previousClose) / previousClose) * 100
          : null;
        const isMxnQuoted = String(meta.currency || "").toUpperCase() === "MXN";
        return [{
          symbol: meta.symbol,
          name: meta.longName || meta.shortName || meta.symbol,
          priceUsd: isMxnQuoted ? (usdMxn > 0 ? Math.round((priceUsd / usdMxn) * 100) / 100 : priceUsd) : priceUsd,
          priceMxn: isMxnQuoted ? priceUsd : Math.round(priceUsd * usdMxn * 100) / 100,
          changePercent,
          currency: meta.currency || "USD",
          marketState: meta.marketState || "UNKNOWN"
        }];
      });

      if (prices.length === 0) throw new Error("No prices returned from upstream");

      const payload = {
        prices,
        usdMxn,
        fxIsLive: fxLive,
        source: "yahoo-chart",
        isLive: true,
        timestamp: new Date().toISOString()
      };
      const anyOpen = prices.some(p => p.marketState === "REGULAR");
      cacheSet(cacheKey, payload, anyOpen ? 60_000 : 5 * 60_000);
      cacheSet(`${cacheKey}:last`, payload, 24 * 60 * 60_000);
      return res.json(payload);
    } catch (error: any) {
      const last = cacheGet(`${cacheKey}:last`);
      if (last) return res.json({ ...last, source: "cache-stale", isLive: false });
      return res.json({
        prices: [],
        usdMxn,
        fxIsLive: fxLive,
        source: "fallback",
        isLive: false,
        error: error?.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // ============================================================
  // /api/btc-history?days=30 — daily BTC/MXN history from CoinGecko
  // ============================================================
  app.get("/api/btc-history", async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const cacheKey = `btc-history:${days}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    try {
      const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=mxn&days=${days}&interval=daily`;
      const r = await fetchWithTimeout(url, 8000);
      if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
      const data: any = await r.json();
      const points: { date: string; priceMxn: number }[] = (data?.prices || []).map((p: [number, number]) => ({
        date: new Date(p[0]).toISOString().split("T")[0],
        priceMxn: Math.round(p[1])
      }));
      const payload = { series: points, source: "coingecko", isLive: true, timestamp: new Date().toISOString() };
      cacheSet(cacheKey, payload, 60 * 60_000); // 1 hour
      cacheSet(`${cacheKey}:last`, payload, 24 * 60 * 60_000);
      return res.json(payload);
    } catch (error: any) {
      const last = cacheGet(`${cacheKey}:last`);
      if (last) return res.json({ ...last, source: "cache-stale", isLive: false });
      return res.json({ series: [], source: "fallback", isLive: false, error: error?.message });
    }
  });

  // ============================================================
  // Yahoo chart endpoint helper. /v8/finance/chart still works without
  // the crumb/cookie dance that broke /v7/finance/quote in 2024.
  // ============================================================
  const QUOTE_TYPE_MAP: Record<string, string> = {
    EQUITY: "Acción",
    ETF: "Índice",
    MUTUALFUND: "Fondo",
    CRYPTOCURRENCY: "Cripto",
    INDEX: "Índice",
    CURRENCY: "Divisa",
    FUTURE: "Futuro",
    OPTION: "Opción",
  };

  async function fetchYahooMeta(symbol: string, timeoutMs = 5500) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
    const r = await fetchWithTimeout(url, timeoutMs, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
      }
    });
    if (!r.ok) throw new Error(`Yahoo chart ${r.status}`);
    const data: any = await r.json();
    if (data?.chart?.error) {
      throw new Error(data.chart.error.description || data.chart.error.code || "Yahoo error");
    }
    const result = data?.chart?.result?.[0];
    if (!result?.meta) throw new Error("No meta in response");
    return result.meta;
  }

  // /api/stock-lookup?symbol=SPY — autocomplete metadata for one ticker.
  app.get("/api/stock-lookup", async (req, res) => {
    const symbol = String(req.query.symbol || "").toUpperCase().trim();
    if (!symbol || symbol.length > 20) {
      return res.status(400).json({ error: "Missing or invalid symbol" });
    }
    const cacheKey = `stock-lookup:${symbol}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    let usdMxn = 17.5;
    let fxIsLive = false;
    const fx = cacheGet("fx-rate") || cacheGet("fx-rate-last");
    if (fx?.usdMxn) { usdMxn = fx.usdMxn; fxIsLive = fx.isLive ?? false; }

    try {
      const meta = await fetchYahooMeta(symbol);
      const priceUsd: number | null = meta.regularMarketPrice ?? null;
      const previousClose: number | null = meta.previousClose ?? meta.chartPreviousClose ?? null;
      const changePercent = (priceUsd != null && previousClose != null && previousClose > 0)
        ? ((priceUsd - previousClose) / previousClose) * 100
        : null;
      // MXN-quoted symbols (e.g. WALMEX.MX) already report in MXN; don't double-convert
      const isMxnQuoted = String(meta.currency || "").toUpperCase() === "MXN";

      const payload = {
        found: true,
        symbol: meta.symbol || symbol,
        name: meta.longName || meta.shortName || symbol,
        type: QUOTE_TYPE_MAP[meta.instrumentType] || "Otro",
        priceUsd: isMxnQuoted ? (priceUsd != null && usdMxn > 0 ? Math.round((priceUsd / usdMxn) * 100) / 100 : null) : priceUsd,
        priceMxn: isMxnQuoted ? priceUsd : (priceUsd != null ? Math.round(priceUsd * usdMxn * 100) / 100 : null),
        exchange: meta.fullExchangeName || meta.exchangeName || null,
        currency: meta.currency || "USD",
        changePercent,
        marketState: meta.marketState || null,
        fxIsLive,
      };
      cacheSet(cacheKey, payload, 5 * 60_000);
      return res.json(payload);
    } catch (error: any) {
      return res.json({ found: false, symbol, error: error?.message });
    }
  });

  // ============================================================
  // /api/stock-history?symbols=SPY,AAPL&days=30 — Yahoo chart endpoint
  // ============================================================
  app.get("/api/stock-history", async (req, res) => {
    const symbolsRaw = String(req.query.symbols || "").toUpperCase();
    const symbols = symbolsRaw.split(",").map(s => s.trim()).filter(Boolean).slice(0, 8);
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 365);
    const cacheKey = `stock-history:${symbols.join(",")}:${days}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const range = days <= 7 ? "5d" : days <= 30 ? "1mo" : days <= 90 ? "3mo" : days <= 180 ? "6mo" : "1y";

    try {
      const results = await Promise.allSettled(
        symbols.map(async (sym) => {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=1d`;
          const r = await fetchWithTimeout(url, 7000, {
            headers: { "User-Agent": "Mozilla/5.0 (control-de-portafolio)" }
          });
          if (!r.ok) throw new Error(`Yahoo ${sym} ${r.status}`);
          const data: any = await r.json();
          const result = data?.chart?.result?.[0];
          const timestamps: number[] = result?.timestamp || [];
          const closes: number[] = result?.indicators?.quote?.[0]?.close || [];
          const points = timestamps.map((ts, idx) => ({
            date: new Date(ts * 1000).toISOString().split("T")[0],
            priceUsd: closes[idx]
          })).filter(p => p.priceUsd != null);
          return { symbol: sym, series: points };
        })
      );

      const seriesBySymbol: Record<string, any[]> = {};
      results.forEach((r) => {
        if (r.status === "fulfilled") seriesBySymbol[r.value.symbol] = r.value.series;
      });

      const payload = { seriesBySymbol, source: "yahoo", isLive: true, timestamp: new Date().toISOString() };
      cacheSet(cacheKey, payload, 60 * 60_000);
      cacheSet(`${cacheKey}:last`, payload, 24 * 60 * 60_000);
      return res.json(payload);
    } catch (error: any) {
      const last = cacheGet(`${cacheKey}:last`);
      if (last) return res.json({ ...last, source: "cache-stale", isLive: false });
      return res.json({ seriesBySymbol: {}, source: "fallback", isLive: false, error: error?.message });
    }
  });

  // ============================================================
  // /api/news — RSS aggregation, financial focus, no API key
  // ============================================================
  const RSS_FEEDS = [
    { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", source: "CoinDesk", category: "Cripto" },
    { url: "https://www.investing.com/rss/news_25.rss", source: "Investing.com", category: "Mercados" },
    { url: "https://www.investing.com/rss/news_1.rss", source: "Investing.com", category: "Macroeconomía" },
    { url: "https://feeds.bloomberg.com/markets/news.rss", source: "Bloomberg", category: "Mercados" },
    { url: "https://www.eleconomista.com.mx/rss/finanzas-personales.xml", source: "El Economista", category: "México" },
    { url: "https://www.eleconomista.com.mx/rss/mercados.xml", source: "El Economista", category: "México" },
  ];

  function decodeXmlEntities(s: string): string {
    return s
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/<[^>]+>/g, "")
      .trim();
  }

  function parseRssItems(xml: string, source: string, category: string): any[] {
    const items: any[] = [];
    const itemRegex = /<item[\s\S]*?<\/item>/gi;
    const matches = xml.match(itemRegex) || [];
    for (const item of matches.slice(0, 8)) {
      const title = item.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
      const link = item.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || "";
      const desc = item.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] || "";
      const pubDate = item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] || "";
      const cleanTitle = decodeXmlEntities(title);
      if (!cleanTitle) continue;
      items.push({
        id: `${source}-${cleanTitle.slice(0, 40)}`,
        title: cleanTitle,
        summary: decodeXmlEntities(desc).slice(0, 280),
        link: decodeXmlEntities(link),
        date: pubDate ? new Date(pubDate.trim()).toISOString() : new Date().toISOString(),
        source,
        category,
      });
    }
    return items;
  }

  app.get("/api/news", async (_req, res) => {
    const cached = cacheGet("news");
    if (cached) return res.json(cached);

    const results = await Promise.allSettled(
      RSS_FEEDS.map(async feed => {
        const r = await fetchWithTimeout(feed.url, 6000, {
          headers: { "User-Agent": "Mozilla/5.0 (control-de-portafolio)" }
        });
        if (!r.ok) throw new Error(`${feed.source} ${r.status}`);
        const xml = await r.text();
        return parseRssItems(xml, feed.source, feed.category);
      })
    );

    const all = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
    const seen = new Set<string>();
    const deduped = all.filter(n => {
      const k = n.title.toLowerCase().slice(0, 50);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    deduped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const top = deduped.slice(0, 24);

    if (top.length === 0) {
      const last = cacheGet("news-last");
      if (last) return res.json({ ...last, source: "cache-stale", isLive: false });
      return res.json({ news: [], isLive: false, source: "fallback", timestamp: new Date().toISOString() });
    }

    const payload = { news: top, isLive: true, source: "rss", timestamp: new Date().toISOString() };
    cacheSet("news", payload, 10 * 60_000);
    cacheSet("news-last", payload, 24 * 60 * 60_000);
    return res.json(payload);
  });

  // ============================================================
  // /api/financial-advisor — Gemini personalized
  // ============================================================
  app.post("/api/financial-advisor", async (req, res) => {
    const ip = req.ip || "unknown";
    if (geminiRateLimited(ip)) {
      return res.status(429).json({ error: "Demasiadas solicitudes. Intenta en un minuto." });
    }

    try {
      const { portfolioData } = req.body;
      if (!portfolioData) return res.status(400).json({ error: "Missing portfolioData" });

      const ai = getGeminiClient();

      const customAssetsStr = (portfolioData.computedCustomAssets || []).map((asset: any) => {
        return `  * ${asset.name} (${asset.symbol}): Tipo: ${asset.type} | Unidades: ${asset.totalUnits} | Invertido: $${asset.totalInvestedMxn.toLocaleString('es-MX')} MXN | Valuación: $${asset.currentValuationMxn.toLocaleString('es-MX')} MXN | Ganancia: $${asset.profitMxn.toLocaleString('es-MX')} (${asset.profitPercent.toFixed(2)}%)`;
      }).join("\n");

      const prompt = `Analiza mi portafolio financiero en México y dame consejos concisos.

DATOS:
- Instrumentos de capitalización diaria:
${portfolioData.instruments.map((inst: any) => `  * ${inst.name}: $${inst.currentBalance.toLocaleString('es-MX')} MXN @ ${inst.annualRate}% anual`).join("\n")}

- Renta variable (acciones, ETFs):
${customAssetsStr || "  * Sin posiciones aparte de Bitcoin."}

- Bitcoin:
  * Total: ${portfolioData.totalBtc} BTC
  * Invertido: $${portfolioData.totalBtcInvestedMxn.toLocaleString('es-MX')} MXN
  * Valor actual: $${portfolioData.currentBtcValueMxn.toLocaleString('es-MX')} MXN
  * Rendimiento: $${portfolioData.btcPerformanceMxn.toLocaleString('es-MX')} (${portfolioData.btcPerformancePercent.toFixed(2)}%)

- Tarjetas de crédito:
${portfolioData.creditCards.map((cc: any) => `  * ${cc.name}: Saldo $${cc.currentBalance.toLocaleString('es-MX')} | Límite $${cc.creditLimit.toLocaleString('es-MX')} | Corte día ${cc.cutoffDay} | Pago día ${cc.paymentDueDay}`).join("\n")}

Como asesor financiero experto en México:
1. Evalúa salud de deuda (saldo TDC vs liquidez, riesgo de intereses según fechas).
2. Analiza diversificación (renta fija vs renta variable vs cripto).
3. Recomendaciones por nivel de riesgo (Bajo / Medio / Alto) citando tasas reales (CETES, Banxico, S&P 500 CAGR ~10%, volatilidad BTC).
4. Español de México, Markdown con viñetas, máximo 600 palabras.`;

      const { text, modelUsed } = await callGeminiResilient({
        contents: prompt,
        systemInstruction: "Eres un asesor financiero personal experto en México: CETES/SOFIPOs de capitalización diaria, tarjetas de crédito (totalero, evitar pago mínimo), S&P 500, acciones tech y Bitcoin. Español de México, Markdown organizado.",
      });

      return res.json({ advice: text, model: modelUsed });
    } catch (err: any) {
      const message = err?.message || "";
      const isKeyMissing = message.includes("GEMINI_API_KEY");
      const isOverloaded = !!err?.isOverloaded;
      return res.json({
        advice: buildLocalFallbackAdvice(),
        isFallback: true,
        errorKind: isKeyMissing ? "no-key" : isOverloaded ? "overloaded" : "other",
        debugError: isKeyMissing
          ? "GEMINI_API_KEY no configurada en .env"
          : isOverloaded
          ? "Los servidores de Gemini están saturados. Vuelve a intentar en unos segundos."
          : message
      });
    }
  });

  // ============================================================
  // /api/market-opportunities — Gemini market commentary with REAL news
  // ============================================================
  app.post("/api/market-opportunities", async (req, res) => {
    const ip = req.ip || "unknown";
    if (geminiRateLimited(ip)) {
      return res.status(429).json({ error: "Demasiadas solicitudes. Intenta en un minuto." });
    }

    try {
      const { portfolioData, usdMxn, currentDateOffsetDays } = req.body;
      if (!portfolioData) return res.status(400).json({ error: "Missing portfolioData" });

      const ai = getGeminiClient();

      const customAssetsText = (portfolioData.computedCustomAssets || []).map((asset: any) => {
        return `  * ${asset.name} (${asset.symbol}): ${asset.totalUnits} u | Inv $${asset.totalInvestedMxn.toLocaleString('es-MX')} | Val $${asset.currentValuationMxn.toLocaleString('es-MX')} | ${asset.profitPercent.toFixed(1)}%`;
      }).join("\n");

      const newsCached = cacheGet("news");
      const newsLines = (newsCached?.news || []).slice(0, 8)
        .map((n: any) => `  - [${n.source}] ${n.title}`).join("\n") || "  (sin feed disponible)";

      const prompt = `Como analista financiero, evalúa mi portafolio considerando noticias reales actuales.

CONTEXTO MACRO HOY:
- USD/MXN: $${usdMxn} MXN/USD
- Días simulados: +${currentDateOffsetDays || 0}

NOTICIAS REALES DE HOY:
${newsLines}

MI PORTAFOLIO:
- Capital tasa diaria: $${(portfolioData.totalTasaDiariaMxn || 0).toLocaleString('es-MX')} MXN
- Bitcoin: ${portfolioData.totalBtc || 0} BTC | $${(portfolioData.currentBtcValueMxn || 0).toLocaleString('es-MX')} MXN
- Renta variable:
${customAssetsText || "  * Sin posiciones."}

Por favor:
1. Conecta noticias específicas con mi portafolio (¿qué cambia para mí?).
2. Impacto del tipo de cambio en activos en dólares.
3. 3 recomendaciones accionables hoy.
4. Markdown, español de México, máximo 500 palabras.`;

      const { text, modelUsed } = await callGeminiResilient({
        contents: prompt,
        systemInstruction: "Analista financiero senior en México estilo Bloomberg/El Economista. USD/MXN, S&P 500, tech, Bitcoin. Markdown profesional, español de México.",
      });

      return res.json({ report: text, model: modelUsed });
    } catch (err: any) {
      const message = err?.message || "Failed generating market report";
      const isKeyMissing = message.includes("GEMINI_API_KEY");
      const isOverloaded = !!err?.isOverloaded;
      return res.status(500).json({
        error: message,
        errorKind: isKeyMissing ? "no-key" : isOverloaded ? "overloaded" : "other"
      });
    }
  });

  // ============================================================
  // /api/categorize-expense — single or batch classification
  // Body single: { concept: string, amount?: number }
  // Body batch:  { items: [{ id: string, concept: string, amount?: number }] }
  // Returns: { category: string } or { results: { [id]: string } }
  // ============================================================
  const CATEGORY_IDS = [
    "restaurantes","supermercado","comida-bebida","servicios","suscripciones",
    "transporte","gasolina","entretenimiento","fiesta","ropa",
    "belleza","salud","hogar","educacion","otro"
  ];
  const CATEGORY_GUIDE = `
- restaurantes: comer fuera sentado, restaurantes, pizzerías, taquerías, sushi, comida formal con mesero
- supermercado: despensa, super (Walmart, HEB, Soriana, Costco, Chedraui, Bodega Aurrera)
- comida-bebida: café, snacks, OXXO, 7-Eleven, Starbucks, comida rápida, McDonald's, antojitos, food truck
- servicios: luz, agua, internet, gas, teléfono, celular, renta, predial, mantenimiento
- suscripciones: Netflix, Spotify, Claude, ChatGPT, Apple, Adobe, software, plataformas digitales
- transporte: Uber, DiDi, taxi, metro, autobús, vuelos, estacionamiento, Cabify (NO gasolina)
- gasolina: gasolina, gasolinera, Pemex, Shell, BP, peajes, casetas
- entretenimiento: cine, conciertos, libros, videojuegos, eventos, museos, teatro, parques
- fiesta: antro, antros, disco, discoteca, club, bar, bares, cervezas, alcohol, table service, cantina, vida nocturna, after, rave, sauna disco (en México "sauna" como sufijo refiere a antro/club nocturno gay), reuniones con alcohol
- ropa: ropa, zapatos, tenis, bolsas, accesorios de moda, Zara, H&M
- belleza: peluquería, salón de belleza, manicure, pedicure, skincare, perfumería, Sephora, spa (relajante, no nocturno)
- salud: medicinas, farmacia, doctor, dentista, gimnasio, vitaminas, consultas médicas
- hogar: muebles, electrodomésticos, decoración, ferretería, Home Depot, IKEA
- educacion: cursos, libros académicos, colegiaturas, plataformas educativas, Coursera
- otro: cualquier cosa que no encaje claramente arriba

IMPORTANTE: Si el concepto incluye antro, disco, sauna disco, club nocturno, bar o cantina → SIEMPRE "fiesta", aunque mencione spa o sauna.`;

  function sanitizeCategory(raw: string): string {
    const clean = (raw || "").toLowerCase().trim().replace(/[^a-z\-]/g, "").trim();
    return CATEGORY_IDS.includes(clean) ? clean : "otro";
  }

  app.post("/api/categorize-expense", async (req, res) => {
    const ip = req.ip || "unknown";
    if (geminiRateLimited(ip, 30)) {
      return res.status(429).json({ error: "Demasiadas solicitudes." });
    }

    const { concept, items } = req.body || {};

    // BATCH MODE
    if (Array.isArray(items) && items.length > 0) {
      try {
        const lines = items.map((it: any, i: number) => `${i + 1}. "${String(it.concept || "").slice(0, 120)}"`).join("\n");
        const prompt = `Categoriza estos gastos. Responde SOLO con una línea por gasto en el formato "N: id-categoria".

CATEGORÍAS VÁLIDAS:${CATEGORY_GUIDE}

GASTOS:
${lines}

Responde ÚNICAMENTE las líneas "N: id", sin comentar. Si dudas, usa "otro".`;
        const { text } = await callGeminiResilient({
          contents: prompt,
          systemInstruction: "Clasificador de gastos de tarjeta en México. Responde solo con ids exactos de categorías, sin texto extra."
        });
        const results: Record<string, string> = {};
        const lineRegex = /^(\d+)\s*[:.\-]\s*([a-z\-]+)/gim;
        let m: RegExpExecArray | null;
        while ((m = lineRegex.exec(text)) != null) {
          const idx = Number(m[1]) - 1;
          if (idx >= 0 && idx < items.length) {
            results[items[idx].id] = sanitizeCategory(m[2]);
          }
        }
        // Fill any missing with "otro"
        items.forEach((it: any) => { if (!results[it.id]) results[it.id] = "otro"; });
        return res.json({ results });
      } catch (err: any) {
        const fallback: Record<string, string> = {};
        items.forEach((it: any) => { fallback[it.id] = "otro"; });
        return res.json({ results: fallback, isFallback: true, error: err?.message });
      }
    }

    // SINGLE MODE
    if (!concept || typeof concept !== "string") {
      return res.status(400).json({ error: "Missing concept" });
    }

    try {
      const prompt = `Categoriza este gasto en UNA SOLA palabra-id de la lista.

CATEGORÍAS VÁLIDAS:${CATEGORY_GUIDE}

GASTO: "${concept.slice(0, 160)}"

Responde SOLO el id (ej. "restaurantes"), sin explicar. Si dudas, usa "otro".`;
      const { text } = await callGeminiResilient({
        contents: prompt,
        systemInstruction: "Clasificador de gastos de tarjeta en México. Responde solo con un id exacto, sin texto extra."
      });
      return res.json({ category: sanitizeCategory(text) });
    } catch (err: any) {
      return res.json({ category: "otro", isFallback: true, error: err?.message });
    }
  });

  // ============================================================
  // Static / Vite
  // ============================================================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on http://localhost:${PORT}`);
  });
}

function buildLocalFallbackAdvice(): string {
  return `### 💡 Recomendaciones por nivel de riesgo (modo local — sin API key de Gemini)

Para activar el asesor IA real, agrega tu \`GEMINI_API_KEY\` en \`.env\` (gratis en aistudio.google.com/apikey).

- **🟢 Bajo / Conservador (renta fija mexicana)**
  - Mantén tu liquidez en Nu Caja Turbo (13%) y Revolut (15% hasta 25k MXN).
  - Datos: Banxico, CETES Directo. Tasas nominales >11% vs. inflación ~4.5% (INEGI).
  - Acción: nunca pagues mínimos de TDC. CATs ~70%+ según CONDUSEF — ser totalero rinde garantizado.

- **🟡 Medio / Moderado (renta variable diversificada)**
  - Compras programadas (DCA) en S&P 500 (SPY, IVVPESO) para horizontes 3-5 años.
  - Datos: S&P Dow Jones Indices — CAGR histórico ~10% nominal, ~7% real.
  - Acción: aporta mensualmente, ignora la volatilidad diaria.

- **🔴 Alto / Agresivo (Bitcoin + tech)**
  - Solo con capital de riesgo que no necesites en 5+ años.
  - Datos: Bitcoin con drawdowns 50-80% (Bloomberg Galaxy Crypto Index, Glassnode).
  - Acción: jamás te apalanques en cripto, mantén tu fondo de emergencia intacto.`;
}

startServer().catch((err) => {
  console.error("Critical server failure:", err);
});
