/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";

interface GeminiAdvisorProps {
  portfolioState: any; // Entire computed portfolio data
}

/// Simple custom markdown renderer to format text elements cleanly without crash-prone npm imports
function CompactMarkdownRenderer({ text }: { text: string }) {
  if (!text) return null;
  
  const lines = text.split("\n");
  
  return (
    <div className="space-y-3 text-sm text-slate-200 leading-relaxed font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        
        // Headers ###
        if (trimmed.startsWith("###")) {
          const content = trimmed.substring(3).trim();
          return (
            <h4 key={idx} className="text-base font-bold text-white mt-4 mb-2 border-b border-white/10 pb-1.5 flex items-center gap-2 font-display">
              <span className="w-1.5 h-4 rounded-xs bg-indigo-500 block"></span>
              {content}
            </h4>
          );
        }
        
        // Headers ## or #
        if (trimmed.startsWith("##") || trimmed.startsWith("#")) {
          const content = trimmed.replace(/^#+\s*/, "").trim();
          return (
            <h3 key={idx} className="text-lg font-black text-indigo-300 mt-5 mb-2 font-display">
              {content}
            </h3>
          );
        }
        
        // Unordered list items -
        if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
          const content = trimmed.substring(1).trim();
          return (
            <li key={idx} className="ml-4 list-disc pl-1 text-slate-300">
              {parseBold(content)}
            </li>
          );
        }

        // Ordered list items (e.g. 1. )
        const matchNumStr = trimmed.match(/^(\d+)\.\s(.*)/);
        if (matchNumStr) {
          const content = matchNumStr[2];
          return (
            <div key={idx} className="flex gap-2 items-start ml-2 pl-1 mb-1">
              <span className="font-bold text-indigo-300 flex-shrink-0 text-xs w-4 h-4 rounded-full bg-white/10 flex items-center justify-center mt-0.5 font-display">
                {matchNumStr[1]}
              </span>
              <p className="text-slate-300">{parseBold(content)}</p>
            </div>
          );
        }
        
        // Regular paragraph
        if (trimmed.length === 0) return <div key={idx} className="h-2" />;
        
        return <p key={idx} className="text-slate-200">{parseBold(trimmed)}</p>;
      })}
    </div>
  );
}

// Helper to convert **text** to <strong>text</strong> in elements
function parseBold(str: string) {
  const parts = str.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return <strong key={index} className="font-bold text-amber-300 font-display">{part}</strong>;
    }
    return part;
  });
}

export function GeminiAdvisor({ portfolioState }: GeminiAdvisorProps) {
  const [advice, setAdvice] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [isFallback, setIsFallback] = useState<boolean>(false);
  const [debugError, setDebugError] = useState<string>("");
  const [loadingTipIndex, setLoadingTipIndex] = useState<number>(0);

  const loadingTips = [
    "Evaluando balances y liquidez de tasa diaria...",
    "Analizando días restantes para la fecha límite de tus tarjetas...",
    "Consultando la cotización en tiempo real del par Bitcoin/MXN...",
    "Generando recomendaciones totaleras contra cargos de intereses...",
    "Diseñando plan de ahorro y optimización de interés compuesto...",
    "Generando informe ejecutivo de finanzas mexicanas..."
  ];

  const handleGetGeneralAdvisorInput = async () => {
    setLoading(true);
    setAdvice("");
    setIsFallback(false);
    setDebugError("");
    setLoadingTipIndex(0);

    // Rotate loading tips every 3 seconds for maximum delight
    const tipInterval = setInterval(() => {
      setLoadingTipIndex((prev) => (prev + 1) % loadingTips.length);
    }, 2800);

    try {
      const response = await fetch("/api/financial-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioData: portfolioState }),
      });
      
      const data = await response.json();
      if (data && data.advice) {
        setAdvice(data.advice);
        if (data.isFallback) {
          setIsFallback(true);
          setDebugError(data.debugError || "");
        }
      } else {
        throw new Error("Empty advice response");
      }
    } catch (error: any) {
      // Direct local fallback advice if the API/Express route fails physically
      setAdvice(`### 💡 Recomendaciones según Nivel de Riesgo (Modo de Simulación Local)

Aquí tienes algunas pautas estratégicas excelentes adaptadas por nivel de riesgo con base en fuentes y datos históricos reales de mercado:

- **🟢 Nivel de Riesgo: Bajo / Conservador (Preservación de Capital y Liquidez)**
  - **Recomendación:** Conserva tus aportaciones para compromisos y tarjetas en cuentas de rendimiento diario de capitalización automática (como Nu México a tasa de 13.0% y Revolut al 15.0%).
  - **El porqué:** En este nivel, la meta es la cobertura patrimonial contra la inflación y la absoluta seguridad de tu capital líquido, evitando incurrir en gastos financieros accidentales.
  - **Datos y Fuentes:** Conforme a los informes vigentes del **Banco de México (Banxico)** y de **CETESDirecto**, la renta fija nacional permite resguardar liquidez con tasas superiores al 11% nominal anual, superando ampliamente el nivel inflacionario de ~4.5% reportado por el **INEGI**, logrando crecimiento compuesto estable con volatilidad nominal nula.
  - **Acción sugerida:** ¡La mejor inversión conservadora es liquidar deudas de tarjetas! Con CATs promedio superiores al 70% según reportes trimestrales de **CONDUSEF**, ser "totalero" pagando tus cuentas completas desde tu cuenta diaria antes de la fecha límite rinde un ahorro de intereses garantizado inmediato.

- **🟡 Nivel de Riesgo: Medio / Moderado (Crecimiento Global en Renta Variable)**
  - **Recomendación:** Destina capital con horizonte mayor a 3-5 años a fondos indexados diversificados sobre el **S&P 500** (por ejemplo, los ETFs SPY o IVVPESO).
  - **El porqué:** Al invertir en índices, participas del valor creado por las 500 compañías más grandes de EE.UU. a largo plazo, amortiguando caídas individuales mediante una amplia diversificación tecnológica e industrial.
  - **Datos y Fuentes:** El índice benchmark **S&P 500** ha obtenido un rendimiento promedio histórico de aproximadamente **10% nominal anual** (CAGR) durante el transcurso de las últimas 5 décadas (de acuerdo con estadísticas de **S&P Dow Jones Indices**), superando consistentemente a los instrumentos tradicionales de ahorro de mediano plazo.
  - **Acción sugerida:** Adopta una estrategia de Compras Promediadas Periódicas (DCA) de manera mensual e ignora las oscilaciones diarias de valor.

- **🔴 Nivel de Riesgo: Alto / Agresivo (Asimetría en Cripto y Títulos Tecnológicos)**
  - **Recomendación:** Mantén depósitos moderados (dinero que no necesites para tus gastos en el mediano plazo) en activos de alto alfa como **Bitcoin** o acciones tecnológicas de IA de alto crecimiento.
  - **El porqué:** Capturas un potencial de revalorización exponencial a cambio de soportar la fuerte volatilidad y devaluaciones temporales extremas.
  - **Datos y Fuentes:** Históricamente, Bitcoin experimenta drawdowns que superan habitualmente el **50% al 80%** en sus inviernos cíclicos y una volatilidad anual mayor al **100%**, según datos históricos de Glassnode y el **Bloomberg Galaxy Crypto Index**, requiriendo un estómago fuerte y paciencia de largo plazo.
  - **Acción sugerida:** Sostén tu posición de Bitcoin a un plazo mínimo de 5 años y mantén tu fondo líquido de liquidez diario en Nu/Revolut intacto para emergencias.`);
      setIsFallback(true);
      setDebugError(error?.message || "No se pudo establecer conexión con el servidor");
    } finally {
      clearInterval(tipInterval);
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/[0.04] backdrop-blur-md text-white rounded-3xl p-6 shadow-2xl border border-white/10 relative overflow-hidden mb-8" id="gemini-advisor-section">
      {/* Decorative ambient backgrounds */}
      <div className="absolute -right-16 -bottom-16 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl"></div>
      <div className="absolute -left-12 -top-12 w-40 h-40 rounded-full bg-emerald-500/10 blur-3xl"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5 mb-5 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/25">
              <Sparkles className="w-4 h-4 text-indigo-300 animate-pulse animate-duration-1000" />
            </span>
            <span className="text-xs font-bold text-indigo-305 uppercase tracking-widest font-display">
              Tecnología Gemini 2.0 AI
            </span>
          </div>
          <h2 className="text-xl font-bold font-display text-white">Asesor Financiero Personal Inteligente</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl font-sans">
            Sincroniza tus instrumentos, saldos de Bitcoin de hoy, deudas de tarjetas y calendario de pagos para recibir consejos personalizados de salud financiera.
          </p>
        </div>

        <button
          onClick={handleGetGeneralAdvisorInput}
          disabled={loading}
          className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm shadow-lg transition-all duration-200 relative z-10 flex-shrink-0 ${
            loading 
              ? "bg-[#1e293b]/70 text-slate-400 cursor-not-allowed border border-white/10" 
              : "bg-indigo-500 hover:bg-indigo-400 text-white hover:scale-[1.02] cursor-pointer"
          }`}
          id="btn-get-advisor"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-indigo-350" />
              <span>Analizando datos...</span>
            </>
          ) : advice ? (
            <>
              <RefreshCw className="w-4 h-4" />
              <span>Actualizar Asesoría</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <span>Obtener Consejos de IA</span>
            </>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10" id="advisor-advice-content">
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-in">
            <Loader2 className="w-10 h-10 animate-spin text-[#6366f1] mb-4" />
            <p className="text-sm font-semibold text-slate-205">{loadingTips[loadingTipIndex]}</p>
            <p className="text-xs text-slate-400 mt-1.5 max-w-sm">
              Esto puede tardar un momento, estructurando un diagnóstico completo de salud financiera mexicana...
            </p>
          </div>
        )}

        {!loading && !advice && (
          <div className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
            <Sparkles className="w-8 h-8 text-indigo-400 mb-3" />
            <p className="text-sm font-bold text-white font-display">¿Listo para optimizar tus finanzas?</p>
            <p className="text-xs text-slate-405 mt-1 max-w-sm">
              Haz clic en el botón de arriba para generar tu plan detallado. El modelo calculará tus intereses cruzados y te dará un orden óptimo de pagos.
            </p>
          </div>
        )}

        {!loading && advice && (
          <div className="bg-white/[0.06] backdrop-blur-md text-slate-100 rounded-2xl p-5 md:p-6 shadow-2xl border border-white/15 animate-fade-in" id="advisor-response-box">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
              <span className="text-xs font-bold text-indigo-300 bg-white/5 px-2.5 py-1 rounded-md border border-white/5 font-display">
                Diagnóstico IA Generativo
              </span>
              {isFallback && (
                <span className="text-[10px] bg-amber-500/10 text-amber-350 border border-amber-500/20 font-semibold px-2 py-0.5 rounded font-display">
                  Modo Asistente de Recuperación
                </span>
              )}
            </div>

            <CompactMarkdownRenderer text={advice} />

            {isFallback && debugError && (
              <div className="mt-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                <p className="font-semibold mb-0.5">Detalles de conexión / Advertencia del servidor:</p>
                <code className="text-[11px] font-mono text-red-300 block break-all">{debugError}</code>
              </div>
            )}

            <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
              <span>Asesoría provista en base a tasas capturadas y cotizaciones actuales.</span>
              <span className="font-bold text-indigo-400 font-display">Portafolio Inteligente 2026</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
