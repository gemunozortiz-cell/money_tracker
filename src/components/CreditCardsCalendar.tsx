/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Scissors, DollarSign, X } from "lucide-react";
import { CreditCard } from "../types";

interface CreditCardsCalendarProps {
  creditCards: (CreditCard & { currentBalance: number })[];
  simulatedDate: Date;
}

// 5 distinct hues, cycled through cards in their order of creation.
const CARD_COLORS = [
  { name: "indigo",  border: "border-indigo-400", bg: "bg-indigo-500",  text: "text-indigo-300", soft: "bg-indigo-500/20" },
  { name: "emerald", border: "border-emerald-400", bg: "bg-emerald-500", text: "text-emerald-300", soft: "bg-emerald-500/20" },
  { name: "amber",   border: "border-amber-400", bg: "bg-amber-500",   text: "text-amber-300", soft: "bg-amber-500/20" },
  { name: "rose",    border: "border-rose-400", bg: "bg-rose-500",    text: "text-rose-300", soft: "bg-rose-500/20" },
  { name: "violet",  border: "border-violet-400", bg: "bg-violet-500",  text: "text-violet-300", soft: "bg-violet-500/20" },
];

interface DayEvent {
  cardId: string;
  cardName: string;
  type: "corte" | "pago";
  balance: number;
  colorIdx: number;
}

function clampToDaysInMonth(day: number, year: number, month: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(day, lastDay);
}

export function CreditCardsCalendar({ creditCards, simulatedDate }: CreditCardsCalendarProps) {
  const [viewYear, setViewYear] = useState(simulatedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(simulatedDate.getMonth()); // 0-11
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  // Map of day-of-month → events
  const eventsByDay = useMemo(() => {
    const map: Record<number, DayEvent[]> = {};
    creditCards.forEach((card, idx) => {
      const colorIdx = idx % CARD_COLORS.length;
      const corteDay = clampToDaysInMonth(card.cutoffDay, viewYear, viewMonth);
      const pagoDay = clampToDaysInMonth(card.paymentDueDay, viewYear, viewMonth);

      if (!map[corteDay]) map[corteDay] = [];
      map[corteDay].push({
        cardId: card.id,
        cardName: card.name,
        type: "corte",
        balance: card.currentBalance,
        colorIdx
      });

      if (!map[pagoDay]) map[pagoDay] = [];
      map[pagoDay].push({
        cardId: card.id,
        cardName: card.name,
        type: "pago",
        balance: card.currentBalance,
        colorIdx
      });
    });
    return map;
  }, [creditCards, viewYear, viewMonth]);

  // Days grid: Monday=0 ... Sunday=6
  const grid = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    // JS getDay: Sun=0, Mon=1 ... — convert so Monday=0
    const startWeekday = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    // Pad end to complete the last week
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const isCurrentMonth = simulatedDate.getFullYear() === viewYear && simulatedDate.getMonth() === viewMonth;
  const todayDay = isCurrentMonth ? simulatedDate.getDate() : null;

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };
  const goNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };
  const goToday = () => {
    setViewYear(simulatedDate.getFullYear());
    setViewMonth(simulatedDate.getMonth());
  };

  const selectedEvents = selectedDay != null ? eventsByDay[selectedDay] || [] : [];

  return (
    <div className="bg-white/[0.04] rounded-3xl border border-white/10 p-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-indigo-400" />
          <h3 className="font-bold text-white text-sm font-display capitalize">{monthLabel}</h3>
        </div>
        <div className="flex items-center gap-1">
          {!isCurrentMonth && (
            <button
              onClick={goToday}
              className="text-[10px] font-bold px-2 py-1 rounded-md bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 transition-colors"
            >
              Hoy
            </button>
          )}
          <button onClick={goPrev} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-300 transition-colors" aria-label="Mes anterior">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={goNext} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-300 transition-colors" aria-label="Mes siguiente">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-3 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <Scissors className="w-3 h-3" />
          Corte
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="w-3 h-3" />
          Pago
        </span>
        <span className="text-slate-500">·</span>
        {creditCards.map((card, idx) => {
          const c = CARD_COLORS[idx % CARD_COLORS.length];
          return (
            <span key={card.id} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${c.bg}`} />
              <span className={c.text}>{card.name}</span>
            </span>
          );
        })}
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <div key={i} className="text-[10px] text-slate-500 font-bold text-center py-1">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {grid.map((day, i) => {
          if (day == null) return <div key={i} />;
          const events = eventsByDay[day] || [];
          const isToday = day === todayDay;
          const hasEvents = events.length > 0;

          return (
            <button
              key={i}
              onClick={() => setSelectedDay(day)}
              disabled={!hasEvents}
              className={`aspect-square flex flex-col items-center justify-start py-1 rounded-lg relative transition-colors ${
                isToday
                  ? "bg-indigo-500/20 ring-1 ring-indigo-400"
                  : hasEvents
                  ? "bg-white/[0.03] hover:bg-white/10 cursor-pointer"
                  : "text-slate-600"
              }`}
            >
              <span className={`text-xs font-bold ${isToday ? "text-indigo-200" : hasEvents ? "text-white" : "text-slate-600"}`}>
                {day}
              </span>
              {hasEvents && (
                <div className="flex flex-wrap justify-center gap-0.5 mt-1 max-w-full px-0.5">
                  {events.slice(0, 4).map((ev, j) => {
                    const c = CARD_COLORS[ev.colorIdx];
                    return ev.type === "corte" ? (
                      <span
                        key={j}
                        className={`w-1.5 h-1.5 rounded-full border ${c.border} bg-transparent`}
                        title={`Corte ${ev.cardName}`}
                      />
                    ) : (
                      <span
                        key={j}
                        className={`w-1.5 h-1.5 rounded-full ${c.bg}`}
                        title={`Pago ${ev.cardName}`}
                      />
                    );
                  })}
                  {events.length > 4 && (
                    <span className="text-[7px] text-slate-400 font-bold">+{events.length - 4}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Day detail bottom sheet */}
      {selectedDay != null && selectedEvents.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="bg-[#0e1424] rounded-t-3xl border-t border-white/10 w-full max-w-md p-5 shadow-2xl animate-fade-in max-h-[85dvh] overflow-y-auto"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] uppercase font-extrabold text-indigo-300 tracking-widest">{monthLabel}</span>
                <h3 className="text-lg font-black text-white font-display">Día {selectedDay}</h3>
              </div>
              <button onClick={() => setSelectedDay(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {selectedEvents.map((ev, i) => {
                const c = CARD_COLORS[ev.colorIdx];
                const Icon = ev.type === "corte" ? Scissors : DollarSign;
                return (
                  <div key={i} className={`rounded-2xl border ${c.border}/40 ${c.soft} p-3.5 flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${c.bg}/30 border ${c.border}/30 flex items-center justify-center`}>
                        <Icon className={`w-4 h-4 ${c.text}`} />
                      </div>
                      <div>
                        <span className={`text-[10px] uppercase font-bold ${c.text} tracking-wider block`}>
                          {ev.type === "corte" ? "Fecha de corte" : "Fecha límite de pago"}
                        </span>
                        <h4 className="text-sm font-extrabold text-white">{ev.cardName}</h4>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Saldo</span>
                      <span className={`text-sm font-black font-mono ${ev.balance > 0 ? "text-rose-300" : "text-slate-400"}`}>
                        ${ev.balance.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] text-slate-500 mt-4 text-center leading-relaxed">
              <strong className="text-amber-300">Tip:</strong> paga el día de corte (no el de vencimiento) para que ese mes te ahorres intereses si fuiste totalero.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
