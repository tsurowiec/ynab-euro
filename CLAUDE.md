# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run exchange          # interactive conversion flow
npm run exchange:dry      # dry run — shows changes without posting to YNAB
npm run list-plans        # list all YNAB budgets with their IDs
npm run list-accounts     # list all active accounts in the configured budget
```

There are no build, lint, or test scripts. Scripts run directly via `tsx` (no compilation step).

## Architecture

This is a CLI tool for converting foreign-currency YNAB transactions to PLN using the NBP (National Bank of Poland) exchange rate API.

**Entry points:**
- `src/exchange.ts` — main interactive flow: loads accounts, prompts user to select account and confirm rate, calls `convertTransactions`
- `src/list-plans.ts` / `src/list-accounts.ts` — utility scripts for initial setup

**Core logic:**
- `src/lib/convert.ts` — `convertTransactions()`: filters unprocessed transactions (those without `TX` in memo), shows an interactive checkbox list, and either posts updates to YNAB or dry-runs. Converted transactions get a memo stamp like `TX 42.50EUR @ 4.2531`; skipped ones get `TX ignored`.
- `src/lib/rates.ts` — `fetchRateToPln()`: fetches the NBP mid-rate for a currency code.
- `src/client.ts` — initialises the YNAB API client from env vars; exported as `api` and `planId`.

**YNAB amounts** are stored in milliunits (integer, divide by 1000 for display). Conversion: `Math.round(t.amount * rate)` preserves milliunits.

**Caching** (`.cache/` directory):
- `account_names.json` — maps account IDs to display names, avoids repeated API calls
- `server_knowledge.json` — maps account IDs to YNAB server_knowledge values, used for delta fetches (only new/changed transactions since last run)

**Configuration** (`.env`):
- `YNAB_TOKEN` — personal access token
- `YNAB_PLAN_ID` — budget ID or `last-used`
- `YNAB_ACCOUNTS` — comma-separated `accountId|CURRENCY` pairs
