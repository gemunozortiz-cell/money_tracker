/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownRight, Cpu, Newspaper, RefreshCw, ExternalLink, Globe } from "lucide-react";
import { useLiveNews } from "../hooks/useLiveData";

interface MarketsAndNewsProps {
  portfolioStateForAI: any;
  currentDateOffsetDays: number;
  usdMxn: number;
  usdFluc: number;
  fxIsLive: boolean;
}

function CompactMarkdownRenderer({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div className="space-y-2.5 text-xs text-slate-200 leading-relaxed font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("###")) {
          return (
            <h4 key={idx} className="text-sm font-bold text-white mt-4 mb-1.5 border-b border-white/10 pb-1.5 flex items-center gap-2 font-display">
              <span className="w-1.5 h-4 rounded-xs bg-indigo-500 block"></span>
              {trimmed.substring(3).trim()}
            </h4>
          );
        }
        if (trimmed.startsWith("##") || trimmed.startsWith("#")) {
          return (
            <h3 key={idx} className="text-base font-black text-indigo-300 mt-4 mb-1.5 font-display">
              {trimmed.replace(/^#+\s*/, "").trim()}
            </h3>
          );
        }
        if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
          return (
            <li key={idx} className="ml-4 list-disc pl-1 text-slate-300">
              {parseBold(trimmed.substring(1).trim())}
            </li>
          );
        }
        const m = trimmed.match(/^(\d+)\.\s(.*)/);
        if (m) {
          return (
            <div key={idx} className="flex gap-2 items-start ml-1">
              <span className="font-bold text-indigo-300 flex-shrink-0 text-[10px] w-4 h-4 rounded-full bg-white/10 flex items-center justify-center mt-0.5 font-display">
                {m[1]}
              </span>
              <p className="text-slate-300">{parseBold(m[2])}</p>
            </div>
          );
        }
        if (trimmed.length === 0) return <div key={idx} className="h-1.5" />;
        return <p key={idx} className="text-slate-200">{parseBold(trimmed)}</p>;
      })}
    </div>
  );
}

function parseBold(str: string) {
  const parts = str.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, index) =>
    index % 2 === 1
      ? <strong key={index} className="font-bold text-amber-300 font-display">{part}</strong>
      : <span key={index}>{part}</span>
  );
}

function timeAgo(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD}d`;
}

export function MarketsAndNews({ portfolioStateForAI, currentDateOffsetDays, usdMxn, usdFluc, fxIsLive }: MarketsAndNewsProps) {
  const [aiReport, setAiReport] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState<boolean>(false);
  const { news, isLive: newsIsLive, loading: newsLoading, refresh: refreshNews } = useLiveNews();

  const fetchAiOpportunities = async () => {
    setLoadingAi(true);
    setAiReport("");
    try {
      const res = await fetch("/api/market-opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioData: portfolioStateForAI,
          usdMxn,
          currentDateOffsetDays
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.report) {
        setAiReport(data.report);
        return;
      }

      // Diagnose the failure precisely from the backend errorKind
      const kind = data?.errorKind || "other";
      const headlineByKind: Record<string, string> = {
        "no-key": "### ⚠️ Falta tu GEMINI_API_KEY\n\nAgrega tu key en `.env` y reinicia `npm run dev`. Consíguela gratis en aistudio.google.com/apikey.",
        "overloaded": "### ⏳ Gemini saturado\n\nLos servidores de Gemini están con alta demanda en este momento (free tier). Reintentamos con un modelo de respaldo pero también falló. Vuelve a tocar **Actualizar** en 30-60 segundos.",
        "other": `### ⚠️ Error al llamar a Gemini\n\n\`${(data?.error || "error desconocido").slice(0, 200)}\`\n\nRevisa la consola del servidor para más detalle.`
      };

      setAiReport(`${headlineByKind[kind]}

---

**Mientras tanto, recordatorios estáticos:**

1. **S&P 500 vía SPY/IVVPESO**: ~10% CAGR histórico. DCA mensual.
2. **CETES y SOFIPOs**: ~11-13% nominal en MXN, libre de riesgo nominal.
3. **Bitcoin**: alta volatilidad. Solo capital con horizonte de 5+ años.

Tipo de cambio actual: $${usdMxn} MXN/USD.`);
    } catch (e: any) {
      setAiReport(`### ⚠️ Sin conexión al servidor

No se pudo contactar al backend. Verifica que \`npm run dev\` siga corriendo.

\`${e?.message || "network error"}\``);
    } finally {
      setLoadingAi(false);
    }
  };

  // Auto-load AI report on mount only
  useEffect(() => {
    fetchAiOpportunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      {/* TICKERS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[#0b101c] p-4 rounded-2xl border border-white/10">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] uppercase font-extrabold text-indigo-400 tracking-wider font-display">USD/MXN en tiempo real</span>
            <span className={`w-2 h-2 rounded-full ${fxIsLive ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
          </div>
          <h3 className="text-xs font-bold text-slate-300">Dólar americano</h3>
          <div className="mt-2">
            <span className="text-2xl font-black text-white font-mono block">
              ${usdMxn.toFixed(4)} <span className="text-xs text-slate-400 font-medium">MXN</span>
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              {usdFluc >= 0 ? (
                <span className="text-[10px] text-emerald-400 font-bold flex items-center font-mono">
                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                  +{usdFluc.toFixed(2)}%
                </span>
              ) : (
                <span className="text-[10px] text-rose-400 font-bold flex items-center font-mono">
                  <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                  {usdFluc.toFixed(2)}%
                </span>
              )}
              <span className="text-[9px] text-slate-500 font-medium">
                {fxIsLive ? "• Mercado interbancario" : "• Sin conexión"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[#0b101c] p-4 rounded-2xl border border-white/10">
          <span className="text-[10px] uppercase font-extrabold text-amber-400 tracking-wider font-display block">Sentimiento general</span>
          <h3 className="text-xs font-bold text-slate-300 mt-0.5">Mercados</h3>
          <div className="mt-2">
            <span className="text-base font-black text-white font-display block">Riesgo activo</span>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
              Renta variable de tecnología con tracción institucional sostenida.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-500/10 to-blue-600/10 p-4 rounded-2xl border border-indigo-500/30">
          <span className="text-[10px] uppercase font-extrabold text-indigo-300 tracking-wider font-display block">IA Financiera</span>
          <h3 className="text-xs font-bold text-white mt-0.5">Oportunidades</h3>
          <p className="text-[10px] text-slate-300 mt-1.5">Gemini analiza tu portafolio.</p>
          <button
            onClick={fetchAiOpportunities}
            disabled={loadingAi}
            className="w-full mt-2.5 py-1.5 px-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 disabled:bg-indigo-600/40 border border-indigo-400/20 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAi ? "animate-spin" : ""}`} />
            {loadingAi ? "Analizando..." : "Actualizar"}
          </button>
        </div>
      </section>

      {/* NEWS + AI REPORT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white/[0.04] rounded-3xl p-5 border border-white/10 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-white text-sm font-display">Noticias financieras</h3>
              {newsIsLive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            </div>
            <button
              onClick={refreshNews}
              disabled={newsLoading}
              className="text-slate-400 hover:text-white transition-colors p-1"
              aria-label="Refrescar noticias"
            >
              <RefreshCw className={`w-4 h-4 ${newsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {newsLoading && news.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-slate-400 text-xs">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Cargando feed...
            </div>
          ) : news.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-xs">
              <Globe className="w-6 h-6 mb-2 opacity-40" />
              <p>Sin noticias por ahora</p>
              <p className="text-[10px] mt-1">Verifica tu conexión a internet</p>
            </div>
          ) : (
            <div className="space-y-3 divide-y divide-white/5 max-h-[550px] overflow-y-auto pr-1">
              {news.map((item) => (
                <a
                  key={item.id}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block pt-3 first:pt-0 group hover:bg-white/[0.02] -mx-1 px-1 rounded-lg transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[9px] uppercase font-extrabold text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/15">
                      {item.category}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono font-bold">
                      {item.source} • {timeAgo(item.date)}
                    </span>
                  </div>
                  <h4 className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors leading-snug flex items-start gap-1">
                    <span className="flex-1">{item.title}</span>
                    <ExternalLink className="w-3 h-3 text-slate-500 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h4>
                  {item.summary && (
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">{item.summary}</p>
                  )}
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white/[0.04] rounded-3xl p-5 border border-white/10 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Cpu className={`w-5 h-5 text-indigo-400 ${loadingAi ? "animate-pulse" : ""}`} />
              <h3 className="font-bold text-white text-sm font-display">Oportunidades con Gemini AI</h3>
            </div>
            {loadingAi && <span className="text-[10px] text-indigo-400 font-bold uppercase">Generando...</span>}
          </div>

          <div className="bg-[#0b101c] border border-white/5 rounded-2xl p-4 max-h-[550px] overflow-y-auto">
            {loadingAi ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin" />
                <p className="text-xs text-slate-400 font-medium px-4">
                  Gemini está analizando tu portafolio con las noticias reales de hoy...
                </p>
              </div>
            ) : (
              <CompactMarkdownRenderer text={aiReport} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
