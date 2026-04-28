import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import checkbox from "@inquirer/checkbox";
import { api, planId } from "../client.js";

const cacheDir = ".cache";
const cacheFile = `${cacheDir}/server_knowledge.json`;

export async function convertTransactions(
  accountId: string,
  currency: string,
  rate: number,
  dryRun = false
) {
  if (!existsSync(cacheDir)) mkdirSync(cacheDir);

  const cache: Record<string, number> = existsSync(cacheFile)
    ? JSON.parse(readFileSync(cacheFile, "utf8"))
    : {};

  const { data } = await api.transactions.getTransactionsByAccount(
    planId,
    accountId,
    undefined,
    undefined,
    cache[accountId]
  );

  if (!dryRun) {
    cache[accountId] = data.server_knowledge;
    writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
  }

  const pending = data.transactions.filter((t) => !(t.memo?.includes("TX") ?? false));

  if (pending.length === 0) {
    console.log("No unprocessed transactions.");
    return;
  }

  const checkedIds = await checkbox({
    message: `Select transactions to convert (${currency} @ ${rate}). Unchecked → ignored.`,
    theme: { style: { renderSelectedChoices: () => "" } },
    choices: pending.map((t) => {
      const amount = (t.amount / 1000).toFixed(2).padStart(10);
      const converted = (Math.round(t.amount * rate) / 1000).toFixed(2).padStart(10);
      const payee = (t.payee_name ?? "—").padEnd(30);
      const memo = t.memo ? `  ${t.memo}` : "";
      return {
        value: t.id,
        name: `${t.date}  ${amount} → ${converted}  ${payee}${memo}`,
        checked: true,
      };
    }),
  });

  const updates = pending.map((t) => {
    if (checkedIds.includes(t.id)) {
      const originalAmount = (t.amount / 1000).toFixed(2);
      const suffix = `TX ${originalAmount}${currency} @ ${rate}`;
      return { id: t.id, amount: Math.round(t.amount * rate), memo: t.memo ? `${t.memo} ${suffix}` : suffix };
    } else {
      return { id: t.id, amount: t.amount, memo: t.memo ? `${t.memo} TX ignored` : "TX ignored" };
    }
  });

  console.log();
  for (const t of pending) {
    const u = updates.find((u) => u.id === t.id)!;
    const before = (t.amount / 1000).toFixed(2).padStart(10);
    const after = (u.amount / 1000).toFixed(2).padStart(10);
    const payee = (t.payee_name ?? "—").padEnd(30);
    const action = checkedIds.includes(t.id) ? "exchanged" : "ignored  ";
    console.log(`[${action}]  ${t.date}  ${before} → ${after}  ${payee}  ${u.memo}`);
  }

  if (dryRun) {
    console.log("\nDry run complete. No changes posted.");
  } else {
    await api.transactions.updateTransactions(planId, { transactions: updates });
    console.log(`\nDone. ${updates.length} transaction(s) updated.`);
  }
}
