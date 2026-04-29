# ynab-euro

CLI tool for converting foreign-currency transactions in [YNAB](https://www.youneedabudget.com/) to PLN. Fetches the current exchange rate from the [NBP (National Bank of Poland) API](https://api.nbp.pl/), lets you review and select transactions interactively, then updates their amounts and adds a memo stamp.

## How it works

1. Loads unprocessed transactions from each configured account (transactions without a `TX` memo marker).
2. Displays accounts sorted by number of pending transactions.
3. Fetches the current NBP mid-rate for the account's currency and pre-fills the rate prompt.
4. Shows a checkbox list of pending transactions with original and converted amounts.
5. Posts the selected updates to YNAB — converting the amount to PLN and stamping the memo (e.g. `TX 42.50EUR @ 4.2531`). Unchecked transactions are marked `TX ignored`.

## Setup

```bash
npm install
cp .env.example .env
# edit .env with your values
```

### `.env` variables

| Variable | Description |
|---|---|
| `YNAB_TOKEN` | YNAB personal access token (from [app.youneedabudget.com/settings/developer](https://app.youneedabudget.com/settings/developer)) |
| `YNAB_PLAN_ID` | Budget ID, or `last-used` to pick the most recently used budget |
| `YNAB_ACCOUNTS` | Comma-separated list of `accountId\|CURRENCY` pairs, e.g. `abc123\|EUR,def456\|USD` |

### Finding your budget (plan) ID

Set `YNAB_TOKEN` in `.env`, then run:

```bash
npm run list-plans
```

This prints all your budgets with their IDs:

```
a1b2c3d4-...  My Budget
```

Copy the ID into `YNAB_PLAN_ID`, or just leave it as `last-used` to auto-select the most recently opened budget.

### Finding account IDs

With `YNAB_TOKEN` and `YNAB_PLAN_ID` set, run:

```bash
npm run list-accounts
```

This lists all active accounts with their IDs, names, balances, and types:

```
e5f6a7b8-...  Revolut EUR                   1234.56   otherAsset
c9d0e1f2-...  Wise USD                        99.00   otherAsset
```

Copy the relevant IDs into `YNAB_ACCOUNTS`, paired with their currency codes.

## Usage

```bash
# interactive — prompts for account, rate, and transactions
npm run exchange

# dry run — shows what would be updated without posting to YNAB
npm run exchange:dry
```

## Caching

Account names and YNAB server-knowledge values are cached in `.cache/` to minimise API calls on repeated runs. Delete this directory to force a fresh fetch.
