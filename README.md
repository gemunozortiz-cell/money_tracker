<div align="center">

# 💰 Control de Portafolio

**Personal finance manager for the Mexican market — real-time prices, AI advisor, cross-device sync, and zero bank-aggregator dependency.**

[**🚀 Live Demo →**](https://money-tracker-2eil.onrender.com)

![Stack](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres_%2B_Auth_%2B_Realtime-3FCF8E?style=flat-square&logo=supabase&logoColor=white)
![Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-4285F4?style=flat-square&logo=google&logoColor=white)
![License](https://img.shields.io/badge/license-Apache_2.0-yellow?style=flat-square)

</div>

A mobile-first PWA for tracking Mexican savings instruments (Nu, Revolut, CETES), credit cards with cycle calendars, Bitcoin, and equities — with AI-powered expense categorization, live market data, and personalized financial advice. Designed for daily use from the iPhone home screen.

---

## ✨ Highlights

### Real-time financial dashboard
- Net-worth tracker with live BTC/MXN, USD/MXN, and stock prices
- Daily compound-interest accrual on Mexican savings, honoring Revolut's **tiered rate structure** (15% / 7% / 4.5%) and Mexican withholding tax
- Time-machine simulator: project portfolio value N days forward
- Historical net-worth chart (7d / 30d / 90d) using real CoinGecko and Yahoo Finance back-history

### AI advisor (Google Gemini)
- Personalized financial advice from your real portfolio data
- Automatic expense categorization (15 categories), with manual override via bottom-sheet picker
- Market opportunity reports that quote live news headlines
- Resilient: automatic retry + fallback model on 503 overloads, with clear UX states

### Credit-card cycle management
- Monthly calendar with cutoff (○) and payment (●) dots per card
- Smart 7-day alerts for upcoming payments
- "Mark period as paid" workflow that doesn't break balance tracking

### Investment tracking
- Bitcoin transactions with real-time P&L in MXN and USD
- Stocks / ETFs with **ticker autocomplete** from Yahoo Finance (`AAPL`, `SPY`, `NVDA`, Mexican `WALMEX.MX`, etc.) — name, type, exchange, and current price auto-filled

### Multi-device cloud sync
- Email/password auth via Supabase
- **Realtime subscription**: a change captured on PC appears on iPhone in < 2 seconds without refresh
- Row-level security: each user only reads their own row
- localStorage offline cache + `beforeunload` flush safety net

### Onboarding & personalization
- Typeform-style onboarding wizard (8 questions, multi-select) collected after signup
- Financial profile (goals, age, income, savings capacity, risk tolerance, horizon) is injected into the Gemini prompt so advice is tailored to each user
- Editable anytime from Settings

### Configurable savings instruments
- Per-instrument **tiered rates**: e.g. Nu Caja Turbo earns 13% only up to a $25k cap, the excess earns a configurable lower rate
- Edit name, rate, cap and excess rate of any account in place
- **Cash accounts** for wallet money (counts toward net worth, no interest)
- Smart surplus optimizer that respects each destination's cap before suggesting a transfer

### Daily reminders (Web Push)
- Native push notifications via VAPID + service worker — arrive even when the app is closed
- Per-user reminder hour stored in UTC; an external cron hits the server hourly and notifies only the users due at that hour
- In-app fallback banner when no expense/income was logged today
- Expired subscriptions auto-pruned (404/410 cleanup)

### iPhone-native feel
- PWA installable on home screen
- Bottom tab bar with safe-area insets for the notch
- Modals use `dvh` + safe-area insets so nothing clips under the notch or home indicator
- 100% dark theme, smooth animations
- Service worker (network-first for HTML, cache for hashed assets)

---

## 🛠 Tech stack

| Layer | Tools |
|---|---|
| **Frontend** | React 19 · TypeScript · Vite 6 · Tailwind CSS v4 · Lucide icons |
| **Backend** | Node.js · Express · esbuild (server bundling) |
| **Cloud data** | Supabase (Postgres + Auth + Realtime + RLS) |
| **AI** | Google Gemini 2.5 Flash + 2.0 Flash (fallback model) |
| **Live market data** | CoinGecko · Yahoo Finance · exchangerate.host |
| **News** | RSS aggregation (Bloomberg, CoinDesk, El Economista, Investing.com) |
| **Push** | Web Push API + VAPID (`web-push`) · external cron scheduler |
| **Hosting** | Render.com (auto-deploy from GitHub `main`) |
| **Caching** | In-memory TTL cache (30s–10min) + per-IP rate limiter on AI endpoints |

---

## 🏗 Architecture

```
                  iPhone (Safari PWA)        PC (Chrome PWA)
                          │                        │
                          └────────────┬───────────┘
                                       ▼
                  ┌──────────────────────────────────┐
                  │  Render.com — Node + Express     │
                  │  ───────────────────────────     │
                  │  /api/btc-price   (CoinGecko)    │
                  │  /api/fx-rate     (exchangerate) │
                  │  /api/stock-*     (Yahoo)        │
                  │  /api/news        (RSS)          │
                  │  /api/financial-advisor (Gemini) │
                  │  /api/categorize-expense (Gemini)│
                  │  /api/push/* (Web Push / VAPID)  │
                  └──────────────────────────────────┘
                          │                  ▲
                          │                  │ hourly POST
                          ▼                  │
       Upstream third-party APIs    External cron (cron-job.org)
       + Supabase (Postgres)        → fires daily 9pm reminders
       ↕ Realtime websocket ↕
       (state sync across devices)
```

### Key design decisions

- **Single-document state** stored as `jsonb` per user — simpler than normalizing 7 entity tables, fast enough for personal-scale data, atomic writes
- **Optimistic sync**: 150ms debounce + `beforeunload` flush + Realtime echo-loop guard via state comparison
- **API resilience**: every upstream has stale-cache fallback. Gemini calls have automatic retry + alternate model. Yahoo `/v7/finance/quote` (deprecated 2024) replaced with `/v8/finance/chart` per-symbol pattern
- **Compound interest engine** simulates day-by-day balance evolution honoring historical deposit/withdrawal transactions, Revolut's tiered rate structure, and Mexican retención fiscal — see [`src/hooks/usePortfolioState.ts`](src/hooks/usePortfolioState.ts)
- **Local-first design**: app works fully offline using localStorage; cloud sync is additive when signed in

---

## 🚀 Local development

```bash
# Clone
git clone https://github.com/gemunozortiz-cell/money_tracker.git
cd money_tracker

# Install
npm install

# Configure
cp .env.example .env
#  Then edit .env with:
#  GEMINI_API_KEY=...               (aistudio.google.com/apikey — free)
#  VITE_SUPABASE_URL=...            (your Supabase project URL)
#  VITE_SUPABASE_ANON_KEY=...       (anon public key)
#  --- optional, for push notifications ---
#  VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY   (npx web-push generate-vapid-keys)
#  SUPABASE_SERVICE_ROLE_KEY=...    (server reads push subs for the cron)
#  CRON_SECRET=...                  (protects the reminder endpoint)

# Run
npm run dev    # http://localhost:3000
```

### Supabase one-time setup

```sql
create table public.portfolios (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.portfolios enable row level security;
create policy "Users read own portfolio"   on public.portfolios for select using (auth.uid() = user_id);
create policy "Users insert own portfolio" on public.portfolios for insert with check (auth.uid() = user_id);
create policy "Users update own portfolio" on public.portfolios for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Required for live cross-device updates
alter publication supabase_realtime add table public.portfolios;
grant select, insert, update on table public.portfolios to authenticated;

-- Push notification subscriptions (server writes via service_role)
create table public.push_subscriptions (
  endpoint          text primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  subscription      jsonb not null,
  reminder_hour_utc int not null default 3,
  updated_at        timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
grant all on table public.push_subscriptions to service_role;
```

### Daily reminder scheduler

Point any cron service (e.g. [cron-job.org](https://cron-job.org), free) to fire **hourly**:

```
POST https://<your-app>.onrender.com/api/push/send-reminders?secret=<CRON_SECRET>
```

The endpoint sends the reminder only to users whose `reminder_hour_utc` matches the current UTC hour.

---

## 📦 Production build

```bash
npm run build   # Vite frontend + esbuild server bundle (dist/server.cjs)
npm start       # Single Node process serves API + static assets
```

The server binds to `process.env.PORT` (set by Render) or `3000` locally. Configuration is read entirely from environment variables — no secrets in code.

---

## 🗺 Roadmap

- [x] Real-time cross-device sync (Supabase Realtime)
- [x] AI advisor personalized via onboarding profile
- [x] Configurable tiered savings rates + cash accounts
- [x] Daily push-notification reminders (Web Push + VAPID + cron)
- [ ] Mexican bank integration via [Belvo API](https://belvo.com)
- [ ] Income tracking + savings-rate calculation
- [ ] Recurring expense auto-detection (subscriptions)
- [ ] CSV import from common bank exports
- [ ] AI advisor that uses full categorized expense history

---

## 📁 Project structure

```
.
├── server.ts                            # Express + API routes (BTC, FX, stocks, news, Gemini)
├── src/
│   ├── App.tsx                          # Layout + bottom tab navigation
│   ├── main.tsx                         # Entry point + AuthGate wrap
│   ├── hooks/
│   │   ├── usePortfolioState.ts         # State, compound interest engine, Supabase sync
│   │   ├── useAuth.ts                   # Session management
│   │   └── useLiveData.ts               # BTC, FX, stocks, news polling hooks
│   ├── components/
│   │   ├── HomeDashboard.tsx            # Hero + actionable alerts
│   │   ├── BottomTabBar.tsx             # iOS-style 5-tab navigation
│   │   ├── AuthGate.tsx                 # Login / signup screen
│   │   ├── InstrumentCard.tsx           # Daily-compound account card
│   │   ├── BitcoinTracker.tsx           # BTC live price + transactions
│   │   ├── CustomInvestmentsTracker.tsx # Stocks/ETFs + ticker autocomplete
│   │   ├── CreditCardsTracker.tsx       # Cards with cycle logic
│   │   ├── CreditCardsCalendar.tsx      # Monthly cutoff/payment calendar
│   │   ├── ExpenseCategoryChart.tsx     # Category breakdown bars
│   │   ├── GeminiAdvisor.tsx            # AI advisor panel
│   │   ├── MarketsAndNews.tsx           # USD/MXN ticker + RSS news + Gemini opportunities
│   │   ├── PortfolioCharts.tsx          # Donut + forward projection
│   │   └── PortfolioHistoryChart.tsx    # Historical net-worth line
│   └── lib/
│       ├── categories.ts                # Expense taxonomy (15 categories with colors)
│       └── supabase.ts                  # Supabase client singleton
└── public/
    ├── manifest.webmanifest             # PWA manifest
    ├── sw.js                            # Service worker
    └── icon.svg                         # App icon
```

---

## 📄 License

Apache-2.0
