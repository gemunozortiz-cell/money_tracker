/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum InstrumentType {
  DAILY_COMPOUND = "DAILY_COMPOUND",
  BITCOIN = "BITCOIN",
  OTHER = "OTHER"
}

export interface Transaction {
  id: string;
  instrumentId: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  date: string; // ISO String or YYYY-MM-DD
  concept?: string; // Optional for deposits, required for withdrawals
}

export interface FinancialInstrument {
  id: string;
  name: string;
  type: InstrumentType;
  initialBalance: number;
  currentBalance: number; // Dynamically updated or manual helper
  annualRate?: number; // Only for DAILY_COMPOUND (e.g. 11.5 for 11.5%)
  createdDate: string; // ISO String or YYYY-MM-DD
  isCash?: boolean; // True for physical cash / wallet accounts (no interest)
}

export interface BitcoinPurchase {
  id: string;
  date: string; // YYYY-MM-DD
  montoMXN: number; // Amount spent in MXN
  cantidadBTC: number; // Amount of BTC obtained
  purchasePricePerBTC: number; // MXN per BTC at purchase time
}

export interface CustomAsset {
  id: string;
  name: string; // e.g. "S&P 500", "Apple Inc"
  symbol: string; // e.g. "SP500", "AAPL"
  type: string; // e.g. "Índice", "Acción", "Fondo"
  livePriceMxn: number; // Current simulated price per unit in MXN
  livePriceUsd: number; // Current simulated price per unit in USD
}

export interface CustomAssetPurchase {
  id: string;
  assetId: string;
  date: string; // YYYY-MM-DD
  montoMXN: number; // Cash spent in MXN
  cantidadUnits: number; // Shares/Units obtained
  purchasePricePerUnit: number; // Price per unit at purchase time
}

export interface CreditCard {
  id: string;
  name: string; // e.g., "BBVA Platinum", "RappiCard"
  creditLimit: number;
  cutoffDay: number; // Day of the month (e.g., 5)
  paymentDueDay: number; // Day of the month (e.g., 25)
  currentBalance: number; // Dynamically computed from expenses
  manualBalance?: number; // Optional manual override of the balance
  nextPeriodOffsetMonths?: number; // Shifts due date forward
}

export interface CreditCardExpense {
  id: string;
  cardId: string;
  concept: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category?: string; // id from EXPENSE_CATEGORIES (auto-filled by AI, can be overridden manually)
}
