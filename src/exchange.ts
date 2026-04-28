import { readFileSync, writeFileSync, existsSync } from "fs";
import stringWidth from "string-width";
import select from "@inquirer/select";
import input from "@inquirer/input";
import { ExitPromptError } from "@inquirer/core";
import { api, planId } from "./client.js";
import { convertTransactions } from "./lib/convert.js";

const measureWidth = (s: string) =>
  stringWidth(s.replace(/\p{Regional_Indicator}{2}/gu, "XX"));

const raw = process.env.YNAB_ACCOUNTS ?? "";
if (!raw) {
  console.error("Missing YNAB_ACCOUNTS in .env");
  console.error("Format: accountId|CURRENCY,accountId2|CURRENCY2");
  process.exit(1);
}

const accountConfigs = raw.split(",").map((entry) => {
  const [accountId, currency] = entry.trim().split("|");
  return { accountId, currency };
});

const skCache: Record<string, number> = existsSync(".cache/server_knowledge.json")
  ? JSON.parse(readFileSync(".cache/server_knowledge.json", "utf8"))
  : {};

const namesCacheFile = ".cache/account_names.json";
const namesCache: Record<string, string> = existsSync(namesCacheFile)
  ? JSON.parse(readFileSync(namesCacheFile, "utf8"))
  : {};

const accounts = await Promise.all(
  accountConfigs.map(async ({ accountId, currency }) => {
    const [name, { data: txData }] = await Promise.all([
      namesCache[accountId]
        ? Promise.resolve(namesCache[accountId])
        : api.accounts.getAccountById(planId, accountId).then(({ data }) => {
            const n = data.account.name.replace(/\s+/g, " ").trim().replace(/💶/g, "🇪🇺");
            namesCache[accountId] = n;
            return n;
          }),
      api.transactions.getTransactionsByAccount(planId, accountId, undefined, undefined, skCache[accountId]),
    ]);
    const newCount = txData.transactions.filter((t) => !t.deleted && !(t.memo?.includes("TX") ?? false)).length;
    return { name, accountId, currency, newCount, txData };
  })
);

writeFileSync(namesCacheFile, JSON.stringify(namesCache, null, 2));

accounts.sort((a, b) => b.newCount - a.newCount);

const maxNameLen = Math.max(...accounts.map((a) => measureWidth(a.name)));
const padName = (s: string) => s + " ".repeat(maxNameLen - measureWidth(s));

try {
  const chosen = await select<typeof accounts[0] | null>({
    message: "Select account to convert:",
    loop: false,
    pageSize: 16,
    choices: [
      ...accounts.map((a) => ({
        value: a,
        name: `${padName(a.name)}  (${a.currency})  [${a.newCount} new]`,
      })),
      { value: null, name: "— exit —" },
    ],
  });

  if (chosen === null) process.exit(0);

  const rateRaw = await input({
    message: `Exchange rate for ${chosen.currency}:`,
    validate: (v) => /^\d+(\.\d{1,4})?$/.test(v.trim()) || "Enter a positive number with up to 4 decimal places",
  });
  const rate = parseFloat(rateRaw);

  const dryRun = process.argv.includes("--dry-run");

  await convertTransactions(chosen.accountId, chosen.currency, rate, dryRun, chosen.txData);
} catch (e) {
  if (e instanceof ExitPromptError) process.exit(0);
  throw e;
}
