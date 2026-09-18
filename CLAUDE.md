# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# CLI
npm run exchange          # interactive conversion flow
npm run exchange:dry      # dry run — shows changes without posting to YNAB
npm run list-plans        # list all YNAB budgets with their IDs
npm run list-accounts     # list all active accounts in the configured budget

# Web app
npm run dev               # API server (tsx watch) + Vite dev server, concurrently
npm run dev:server        # Hono API on http://localhost:3000
npm run dev:web           # Vite dev server, proxies /api → :3000
npm run build             # vite build → web/dist
npm run serve             # production: Hono serves API + built web/dist
```

There are no lint or test scripts. Backend scripts run directly via `tsx` (no compilation step); only the frontend has a build step.

## Architecture

A tool for converting foreign-currency YNAB transactions to PLN using the NBP (National Bank of Poland) exchange rate API. It has two front-ends — an interactive CLI and a React PWA — sharing the same backend library code in `src/lib/`.

**Shared core (`src/lib/`):**
- `accounts.ts` — `loadAccounts()`: reads `YNAB_ACCOUNTS`, resolves account names (cached), counts unprocessed transactions per account via delta fetch.
- `rates.ts` — `fetchRateForDate(currency, date)`: NBP mid-rate for a specific date (falls back to the most recent rate in the preceding 7 days, e.g. for weekends). Results cached in `.cache/rates.json`. Returns `{ rate, rateDate }` or `null`.
- `convert.ts` — `convertTransactions()` (CLI only): filters unprocessed transactions, shows an interactive checkbox list, posts updates or dry-runs.
- `src/client.ts` — initialises the YNAB API client from env vars; exported as `api` and `planId`.

**CLI entry points (`src/`):**
- `exchange.ts` — main interactive flow: loads accounts, prompts for account, calls `convertTransactions`.
- `list-plans.ts` / `list-accounts.ts` / `init-cache.ts` — setup utilities.
- `convert-transactions.ts` — legacy non-interactive script; its call signature no longer matches `convertTransactions` (stale).

**Web app:**
- `src/server.ts` — Hono server. Endpoints: `GET /api/accounts`, `GET /api/transactions/:accountId?currency=`, `POST /api/convert` (`{ accountId, currency, selections: [{id, convert}], dryRun }`). The conversion logic here is duplicated from `lib/convert.ts` rather than shared. In production it also serves `web/dist` as static files with an SPA fallback.
- `web/` — React 19 + Vite frontend (`web/src/App.tsx`, `components/AccountList.tsx`, `components/TransactionList.tsx`, `api.ts` for fetch wrappers). Configured as a PWA via `vite-plugin-pwa`; `vite.config.ts` sets `base: '/ynab-euro/'`, so all API URLs are prefixed with `import.meta.env.BASE_URL` and `start_url`/icon paths include `/ynab-euro/`.

**Transaction semantics:**
- A transaction is "unprocessed" if its memo does not contain `TX`.
- Converted: amount becomes `Math.round(t.amount * rate)` (milliunits preserved), memo gets `TX 42.50EUR @ 4.2531 (2024-01-15)` appended.
- Skipped: memo gets `TX ignored` appended, amount unchanged.
- Rates are per transaction date, not a single rate for the batch.

**YNAB amounts** are stored in milliunits (integer, divide by 1000 for display).

**Caching** (`.cache/` directory):
- `account_names.json` — maps account IDs to display names.
- `server_knowledge.json` — maps account IDs to YNAB server_knowledge values, used for delta fetches (only new/changed transactions since last run). Updated after a successful (non-dry-run) post.
- `rates.json` — `CURRENCY:YYYY-MM-DD` → `{ rate, rateDate }`.

**Configuration** (`.env`):
- `YNAB_TOKEN` — personal access token
- `YNAB_PLAN_ID` — budget ID or `last-used`
- `YNAB_ACCOUNTS` — comma-separated `accountId|CURRENCY` pairs
- `PORT` — server port (default 3000)
- `APP_KEY` — shared secret required on every `/api/*` request (`X-App-Key` header or `?key=`); the web app reads it from `?key=` on first visit and keeps it in `localStorage`
