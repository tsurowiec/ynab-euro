import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { loadAccounts } from "./lib/accounts.js";
import { fetchRateForDate } from "./lib/rates.js";
import { api, planId } from "./client.js";

const app = new Hono();

app.get("/api/accounts", async (c) => {
  try {
    const accounts = await loadAccounts();
    const today = new Date().toISOString().slice(0, 10);
    const currencies = [...new Set(accounts.map((a) => a.currency))];
    const rateMap = new Map<string, { rate: number; rateDate: string } | null>();
    await Promise.all(
      currencies.map(async (currency) => {
        rateMap.set(currency, await fetchRateForDate(currency, today));
      })
    );
    return c.json(accounts.map((a) => ({
      ...a,
      rate: rateMap.get(a.currency)?.rate ?? null,
      rateDate: rateMap.get(a.currency)?.rateDate ?? null,
    })));
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    return c.json({ error: msg }, 500);
  }
});

app.get("/api/transactions/:accountId", async (c) => {
  const { accountId } = c.req.param();
  const currency = c.req.query("currency");
  if (!currency) return c.json({ error: "currency required" }, 400);

  try {
    const skCacheFile = ".cache/server_knowledge.json";
    const skCache: Record<string, number> = existsSync(skCacheFile)
      ? JSON.parse(readFileSync(skCacheFile, "utf8"))
      : {};

    const { data } = await api.transactions.getTransactionsByAccount(
      planId, accountId, undefined, undefined, skCache[accountId]
    );

    const pending = data.transactions
      .filter((t) => !t.deleted && !(t.memo?.includes("TX") ?? false))
      .sort((a, b) => a.date.localeCompare(b.date));

    const uniqueDates = [...new Set(pending.map((t) => t.date))];
    const rateByDate = new Map<string, { rate: number; rateDate: string }>();
    await Promise.all(
      uniqueDates.map(async (date) => {
        const result = await fetchRateForDate(currency, date);
        if (result) rateByDate.set(date, result);
      })
    );

    const transactions = pending
      .filter((t) => rateByDate.has(t.date))
      .map((t) => {
        const { rate, rateDate } = rateByDate.get(t.date)!;
        return {
          id: t.id,
          date: t.date,
          amount: t.amount,
          payeeName: t.payee_name ?? null,
          memo: t.memo ?? null,
          rate,
          rateDate,
          convertedAmount: Math.round(t.amount * rate),
        };
      });

    return c.json({ transactions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    return c.json({ error: msg }, 500);
  }
});

app.post("/api/convert", async (c) => {
  const { accountId, currency, selections, dryRun = false } = await c.req.json<{
    accountId: string;
    currency: string;
    selections: Array<{ id: string; convert: boolean }>;
    dryRun?: boolean;
  }>();

  try {
    const skCacheFile = ".cache/server_knowledge.json";
    const skCache: Record<string, number> = existsSync(skCacheFile)
      ? JSON.parse(readFileSync(skCacheFile, "utf8"))
      : {};

    const { data } = await api.transactions.getTransactionsByAccount(
      planId, accountId, undefined, undefined, skCache[accountId]
    );

    const selectionMap = new Map(selections.map((s) => [s.id, s.convert]));
    const pendingIds = new Set(selections.map((s) => s.id));
    const txToUpdate = data.transactions.filter((t) => pendingIds.has(t.id));

    const uniqueDates = [...new Set(txToUpdate.map((t) => t.date))];
    const rateByDate = new Map<string, { rate: number; rateDate: string }>();
    await Promise.all(
      uniqueDates.map(async (date) => {
        const result = await fetchRateForDate(currency, date);
        if (result) rateByDate.set(date, result);
      })
    );

    const updates = txToUpdate
      .filter((t) => rateByDate.has(t.date))
      .map((t) => {
        const { rate, rateDate } = rateByDate.get(t.date)!;
        const convert = selectionMap.get(t.id) ?? false;
        if (convert) {
          const originalAmount = (t.amount / 1000).toFixed(2);
          const suffix = `TX ${originalAmount}${currency} @ ${rate.toFixed(4)} (${rateDate})`;
          return { id: t.id, amount: Math.round(t.amount * rate), memo: t.memo ? `${t.memo} ${suffix}` : suffix };
        }
        return { id: t.id, amount: t.amount, memo: t.memo ? `${t.memo} TX ignored` : "TX ignored" };
      });

    if (!dryRun) {
      await api.transactions.updateTransactions(planId, { transactions: updates });
      skCache[accountId] = data.server_knowledge;
      writeFileSync(skCacheFile, JSON.stringify(skCache, null, 2));
    }

    const converted = selections.filter((s) => s.convert).length;
    return c.json({ converted, ignored: selections.length - converted, dryRun });
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    return c.json({ error: msg }, 500);
  }
});

// Serve built frontend in production
app.use("/*", serveStatic({ root: "./web/dist" }));
app.get("*", async (c) => {
  try {
    return c.html(readFileSync("./web/dist/index.html", "utf8"));
  } catch {
    return c.text("Frontend not built. Run: npm run build", 404);
  }
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () =>
  console.log(`Server running on http://localhost:${port}`)
);
