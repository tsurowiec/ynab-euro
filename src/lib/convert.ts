import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import checkbox from "@inquirer/checkbox";
import { api, planId } from "../client.js";
import { fetchRateForDate } from "./rates.js";

const cacheDir = ".cache";
const cacheFile = `${cacheDir}/server_knowledge.json`;

const truncate = (s: string, max: number) =>
  s.length > max ? s.slice(0, max - 1) + "…" : s;

type TxData = Awaited<ReturnType<typeof api.transactions.getTransactionsByAccount>>["data"];

export async function convertTransactions(
  accountId: string,
  currency: string,
  dryRun = false,
  prefetched?: TxData
) {
  if (!existsSync(cacheDir)) mkdirSync(cacheDir);

  const cache: Record<string, number> = existsSync(cacheFile)
    ? JSON.parse(readFileSync(cacheFile, "utf8"))
    : {};

  const data = prefetched ?? (await api.transactions.getTransactionsByAccount(
    planId,
    accountId,
    undefined,
    undefined,
    cache[accountId]
  )).data;

  const pending = data.transactions
    .filter((t) => !t.deleted && !(t.memo?.includes("TX") ?? false))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (pending.length === 0) {
    console.log("No unprocessed transactions.");
    return;
  }

  // Fetch rates for all unique transaction dates in parallel
  const uniqueDates = [...new Set(pending.map((t) => t.date))];
  const rateByDate = new Map<string, { rate: number; rateDate: string }>();
  await Promise.all(
    uniqueDates.map(async (date) => {
      const result = await fetchRateForDate(currency, date);
      if (result) rateByDate.set(date, result);
    })
  );

  const missingDates = uniqueDates.filter((d) => !rateByDate.has(d));
  if (missingDates.length > 0) {
    console.warn(`Warning: no NBP rate found for: ${missingDates.join(", ")} — those transactions will be skipped.`);
  }

  const processable = pending.filter((t) => rateByDate.has(t.date));
  if (processable.length === 0) {
    console.log("No transactions with available rates.");
    return;
  }

  const checkedIds = await checkbox({
    message: `Select transactions to convert (${currency} → PLN). Unchecked → ignored.`,
    theme: { style: { renderSelectedChoices: () => "" } },
    choices: processable.map((t) => {
      const { rate, rateDate } = rateByDate.get(t.date)!;
      const amount = (t.amount / 1000).toFixed(2).padStart(10);
      const converted = (Math.round(t.amount * rate) / 1000).toFixed(2).padStart(10);
      const rateStr = rate.toFixed(4).padStart(7);
      const payee = (t.payee_name ?? "—").padEnd(30);
      const memo = t.memo ? `  ${truncate(t.memo, 40)}` : "";
      return {
        value: t.id,
        name: `${t.date}  ${amount} ${currency} → ${converted} PLN  @${rateStr} (${rateDate})  ${payee}${memo}`,
        checked: true,
      };
    }),
  });

  const updates = processable.map((t) => {
    const { rate, rateDate } = rateByDate.get(t.date)!;
    if (checkedIds.includes(t.id)) {
      const originalAmount = (t.amount / 1000).toFixed(2);
      const suffix = `TX ${originalAmount}${currency} @ ${rate.toFixed(4)} (${rateDate})`;
      return { id: t.id, amount: Math.round(t.amount * rate), memo: t.memo ? `${t.memo} ${suffix}` : suffix };
    } else {
      return { id: t.id, amount: t.amount, memo: t.memo ? `${t.memo} TX ignored` : "TX ignored" };
    }
  });

  console.log();
  for (const t of processable) {
    const u = updates.find((u) => u.id === t.id)!;
    const after = (u.amount / 1000).toFixed(2).padStart(10);
    const payee = (t.payee_name ?? "—").padEnd(30);
    const action = checkedIds.includes(t.id) ? "exchanged" : "ignored  ";
    console.log(`[${action}]  ${t.date}  ${after} PLN  ${payee}  ${u.memo}`);
  }

  const converted = processable.filter((t) => checkedIds.includes(t.id));
  if (converted.length > 0) {
    const totalOrig = converted.reduce((sum, t) => sum + t.amount, 0) / 1000;
    const totalPln = converted.reduce((sum, t) => sum + Math.round(t.amount * rateByDate.get(t.date)!.rate), 0) / 1000;
    console.log(`\nTotal: ${totalOrig.toFixed(2)} ${currency} → ${totalPln.toFixed(2)} PLN`);
  }

  if (dryRun) {
    console.log("Dry run complete. No changes posted.");
  } else {
    await api.transactions.updateTransactions(planId, { transactions: updates });
    cache[accountId] = data.server_knowledge;
    writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
    console.log(`Done. ${updates.length} transaction(s) updated.`);
  }
}
