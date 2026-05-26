/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Canonical taxonomy of expense categories used both by the Gemini classifier
 * and by the UI (badges + chart). Adding a new category here makes it
 * automatically available everywhere.
 */

export interface ExpenseCategory {
  id: string;
  label: string;
  emoji: string;
  hex: string;       // for inline styles (avoids Tailwind purge issues)
  description: string; // hint shown in the legend (and used in the AI prompt)
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: "restaurantes",    label: "Restaurantes",      emoji: "🍽️", hex: "#f43f5e", description: "Comer fuera: restaurantes, pizzerías, taquerías" },
  { id: "supermercado",    label: "Supermercado",      emoji: "🛒", hex: "#10b981", description: "Despensa: Walmart, HEB, Soriana, Costco" },
  { id: "comida-bebida",   label: "Comida y bebida",   emoji: "☕", hex: "#f59e0b", description: "Café, snacks, OXXO, 7-Eleven, comida casual" },
  { id: "servicios",       label: "Servicios",         emoji: "🔌", hex: "#06b6d4", description: "Luz, agua, internet, gas, teléfono, renta" },
  { id: "suscripciones",   label: "Suscripciones",     emoji: "📺", hex: "#8b5cf6", description: "Netflix, Spotify, Claude, Apple, software" },
  { id: "transporte",      label: "Transporte",        emoji: "🚇", hex: "#3b82f6", description: "Uber, taxi, metro, autobús, vuelos, estacionamiento" },
  { id: "gasolina",        label: "Gasolina",          emoji: "⛽", hex: "#f97316", description: "Gasolina y peajes" },
  { id: "entretenimiento", label: "Entretenimiento",   emoji: "🎬", hex: "#d946ef", description: "Cine, conciertos, libros, juegos, eventos" },
  { id: "fiesta",          label: "Fiesta",            emoji: "🍻", hex: "#ec4899", description: "Bares, antros, alcohol, reuniones nocturnas" },
  { id: "ropa",            label: "Ropa y accesorios", emoji: "👕", hex: "#6366f1", description: "Ropa, zapatos, bolsas, accesorios" },
  { id: "belleza",         label: "Belleza",           emoji: "💅", hex: "#fb7185", description: "Peluquería, manicure, skincare, perfumería" },
  { id: "salud",           label: "Salud",             emoji: "💊", hex: "#14b8a6", description: "Medicinas, doctor, dentista, gimnasio" },
  { id: "hogar",           label: "Hogar",             emoji: "🏠", hex: "#eab308", description: "Muebles, electrodomésticos, decoración" },
  { id: "educacion",       label: "Educación",         emoji: "📚", hex: "#0ea5e9", description: "Cursos, libros académicos, colegiaturas" },
  { id: "otro",            label: "Otro",              emoji: "📦", hex: "#64748b", description: "Lo demás que no encaje" },
];

export const CATEGORY_BY_ID: Record<string, ExpenseCategory> = Object.fromEntries(
  EXPENSE_CATEGORIES.map(c => [c.id, c])
);

export function getCategory(id?: string): ExpenseCategory | null {
  if (!id) return null;
  return CATEGORY_BY_ID[id] || null;
}
