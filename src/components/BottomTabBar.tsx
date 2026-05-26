/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Home, PiggyBank, CreditCard, TrendingUp, Newspaper } from "lucide-react";

export type TabId = "inicio" | "cuentas" | "tarjetas" | "inversiones" | "mercados";

interface BottomTabBarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  debtAlertCount?: number;
}

const TABS: { id: TabId; label: string; Icon: any }[] = [
  { id: "inicio",      label: "Inicio",      Icon: Home },
  { id: "cuentas",     label: "Cuentas",     Icon: PiggyBank },
  { id: "tarjetas",    label: "Tarjetas",    Icon: CreditCard },
  { id: "inversiones", label: "Inversiones", Icon: TrendingUp },
  { id: "mercados",    label: "Mercados",    Icon: Newspaper },
];

export function BottomTabBar({ active, onChange, debtAlertCount = 0 }: BottomTabBarProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#0c1221]/95 backdrop-blur-xl border-t border-white/10"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      id="bottom-tab-bar"
    >
      <div className="max-w-3xl mx-auto px-1 grid grid-cols-5">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          const showBadge = id === "tarjetas" && debtAlertCount > 0;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex flex-col items-center justify-center py-2.5 gap-0.5 transition-all relative ${
                isActive ? "text-indigo-400" : "text-slate-400 hover:text-slate-200"
              }`}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? "scale-110" : ""} transition-transform`} strokeWidth={isActive ? 2.5 : 2} />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {debtAlertCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold tracking-tight ${isActive ? "text-indigo-300" : ""}`}>
                {label}
              </span>
              {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-indigo-400" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
