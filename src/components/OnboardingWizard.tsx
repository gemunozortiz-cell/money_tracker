/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Typeform-style onboarding: one question per screen, tap-to-advance,
 * progress bar, back button, skippable. Collects a financial profile that
 * personalizes the AI advisor.
 */

import { useState } from "react";
import { UserProfile } from "../types";
import { ChevronLeft, Check, Sparkles, X } from "lucide-react";

interface OnboardingWizardProps {
  initial?: UserProfile;
  onComplete: (profile: UserProfile) => void;
  onSkip: () => void;
}

interface Question {
  key: keyof UserProfile;
  title: string;
  subtitle?: string;
  multi?: boolean; // allow multiple selections
  options: { value: string; emoji: string; label: string }[];
}

const QUESTIONS: Question[] = [
  {
    key: "goal",
    title: "¿Para qué quieres usar la app?",
    subtitle: "Puedes elegir varias",
    multi: true,
    options: [
      { value: "ahorrar", emoji: "🐖", label: "Ahorrar más" },
      { value: "salir-deudas", emoji: "💳", label: "Salir de deudas" },
      { value: "invertir", emoji: "📈", label: "Invertir y crecer mi dinero" },
      { value: "organizar", emoji: "🗂️", label: "Organizar mis gastos" },
      { value: "todo", emoji: "🎯", label: "Un poco de todo" },
    ],
  },
  {
    key: "ageRange",
    title: "¿Cuál es tu edad?",
    options: [
      { value: "18-24", emoji: "🌱", label: "18 a 24" },
      { value: "25-34", emoji: "🚀", label: "25 a 34" },
      { value: "35-44", emoji: "💼", label: "35 a 44" },
      { value: "45-54", emoji: "🏡", label: "45 a 54" },
      { value: "55+", emoji: "🌟", label: "55 o más" },
    ],
  },
  {
    key: "occupation",
    title: "¿A qué te dedicas?",
    options: [
      { value: "empleado", emoji: "👔", label: "Empleado / Asalariado" },
      { value: "freelance", emoji: "💻", label: "Freelance / Independiente" },
      { value: "empresario", emoji: "🏢", label: "Empresario / Negocio propio" },
      { value: "estudiante", emoji: "🎓", label: "Estudiante" },
      { value: "otro", emoji: "✨", label: "Otro" },
    ],
  },
  {
    key: "incomeRange",
    title: "¿Cuánto ganas al mes, aproximadamente?",
    subtitle: "Esto queda privado, solo lo usa la IA para aconsejarte mejor",
    options: [
      { value: "<15k", emoji: "💵", label: "Menos de $15,000" },
      { value: "15-30k", emoji: "💵", label: "$15,000 – $30,000" },
      { value: "30-50k", emoji: "💵", label: "$30,000 – $50,000" },
      { value: "50-100k", emoji: "💰", label: "$50,000 – $100,000" },
      { value: "100k+", emoji: "💰", label: "Más de $100,000" },
    ],
  },
  {
    key: "currentSavingsRate",
    title: "¿Cuánto ahorras al mes hoy?",
    subtitle: "Como % de tu ingreso",
    options: [
      { value: "0", emoji: "😬", label: "No logro ahorrar" },
      { value: "<10", emoji: "🙂", label: "Menos del 10%" },
      { value: "10-20", emoji: "😊", label: "Entre 10% y 20%" },
      { value: "20-30", emoji: "😎", label: "Entre 20% y 30%" },
      { value: "30+", emoji: "🏆", label: "Más del 30%" },
    ],
  },
  {
    key: "potentialSavingsRate",
    title: "¿Cuánto crees que PODRÍAS ahorrar?",
    subtitle: "Siendo realista, si te lo propones",
    options: [
      { value: "<10", emoji: "🤏", label: "Menos del 10%" },
      { value: "10-20", emoji: "👍", label: "Entre 10% y 20%" },
      { value: "20-30", emoji: "💪", label: "Entre 20% y 30%" },
      { value: "30+", emoji: "🚀", label: "Más del 30%" },
    ],
  },
  {
    key: "riskTolerance",
    title: "¿Qué tanto riesgo toleras?",
    subtitle: "Al invertir tu dinero",
    options: [
      { value: "conservador", emoji: "🛡️", label: "Conservador — no quiero perder" },
      { value: "moderado", emoji: "⚖️", label: "Moderado — algo de riesgo está bien" },
      { value: "agresivo", emoji: "🔥", label: "Agresivo — busco altos rendimientos" },
    ],
  },
  {
    key: "horizon",
    title: "¿En cuánto tiempo quieres tus metas?",
    options: [
      { value: "corto", emoji: "⚡", label: "Corto plazo (menos de 1 año)" },
      { value: "mediano", emoji: "📅", label: "Mediano plazo (1 a 5 años)" },
      { value: "largo", emoji: "🌳", label: "Largo plazo (5+ años)" },
    ],
  },
];

export function OnboardingWizard({ initial, onComplete, onSkip }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<UserProfile>(initial || {});

  const isLast = step === QUESTIONS.length - 1;
  const q = QUESTIONS[step];
  const progress = ((step + 1) / QUESTIONS.length) * 100;

  // For multi-select questions, the value is a comma-separated string.
  const currentValue = (answers[q.key] as string) || "";
  const selectedSet = new Set(currentValue ? currentValue.split(",") : []);

  const advance = (updated: UserProfile) => {
    if (isLast) {
      onComplete({ ...updated, completedAt: new Date().toISOString(), skipped: false });
    } else {
      setStep(step + 1);
    }
  };

  const choose = (value: string) => {
    if (q.multi) {
      // Toggle within the set; do NOT auto-advance (user taps "Continuar")
      if (selectedSet.has(value)) selectedSet.delete(value);
      else selectedSet.add(value);
      setAnswers({ ...answers, [q.key]: Array.from(selectedSet).join(",") });
    } else {
      const updated = { ...answers, [q.key]: value };
      setAnswers(updated);
      setTimeout(() => advance(updated), 180); // brief highlight before advancing
    }
  };

  const continueMulti = () => {
    if (selectedSet.size === 0) return;
    advance(answers);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[#0c1221] flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Top bar: progress + skip */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        {step > 0 ? (
          <button onClick={() => setStep(step - 1)} className="text-slate-400 hover:text-white p-1 -ml-1">
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : (
          <span className="w-5" />
        )}
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <button onClick={onSkip} className="text-[11px] text-slate-400 hover:text-white font-bold whitespace-nowrap flex items-center gap-1">
          Saltar <X className="w-3 h-3" />
        </button>
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto px-5 pt-6 flex flex-col">
        <div className="max-w-md w-full mx-auto">
          <span className="text-[11px] uppercase font-extrabold tracking-widest text-indigo-400 font-display">
            Pregunta {step + 1} de {QUESTIONS.length}
          </span>
          <h2 className="text-2xl font-black text-white font-display mt-2 leading-tight">{q.title}</h2>
          {q.subtitle && <p className="text-sm text-slate-400 mt-1.5">{q.subtitle}</p>}

          <div className="space-y-2.5 mt-6">
            {q.options.map(opt => {
              const selected = q.multi ? selectedSet.has(opt.value) : answers[q.key] === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => choose(opt.value)}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                    selected
                      ? "bg-indigo-500/20 border-indigo-400 ring-1 ring-indigo-400"
                      : "bg-white/[0.04] border-white/10 hover:bg-white/[0.08] hover:border-white/20"
                  }`}
                >
                  <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
                  <span className="text-sm font-bold text-white flex-1">{opt.label}</span>
                  {selected && <Check className="w-5 h-5 text-indigo-300 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Continue button for multi-select questions */}
          {q.multi && (
            <button
              onClick={continueMulti}
              disabled={selectedSet.size === 0}
              className="w-full mt-5 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 disabled:bg-white/10 disabled:text-slate-500 text-white font-bold text-sm py-3 rounded-xl transition-colors"
            >
              {selectedSet.size === 0 ? "Elige al menos una" : isLast ? "Terminar" : `Continuar (${selectedSet.size})`}
            </button>
          )}
        </div>
      </div>

      {/* Footer hint */}
      <div className="px-5 py-3 text-center">
        <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          {q.multi ? "Elige todas las que apliquen" : isLast ? "Toca una opción para terminar" : "Toca tu respuesta para continuar"}
        </p>
      </div>
    </div>
  );
}
