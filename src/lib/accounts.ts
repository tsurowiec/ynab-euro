import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { api, planId } from "../client.js";

export type AccountInfo = { accountId: string; name: string; currency: string; newCount: number };

const cacheDir = ".cache";
const namesCacheFile = `${cacheDir}/account_names.json`;
const skCacheFile = `${cacheDir}/server_knowledge.json`;

export function getAccountConfigs(): Array<{ accountId: string; currency: string }> {
  const raw = process.env.YNAB_ACCOUNTS ?? "";
  if (!raw) throw new Error("Missing YNAB_ACCOUNTS env var");
  return raw.split(",").map((entry) => {
    const [accountId, currency] = entry.trim().split("|");
    return { accountId, currency };
  });
}

export async function loadAccounts(): Promise<AccountInfo[]> {
  if (!existsSync(cacheDir)) mkdirSync(cacheDir);

  const configs = getAccountConfigs();

  const namesCache: Record<string, string> = existsSync(namesCacheFile)
    ? JSON.parse(readFileSync(namesCacheFile, "utf8"))
    : {};

  const skCache: Record<string, number> = existsSync(skCacheFile)
    ? JSON.parse(readFileSync(skCacheFile, "utf8"))
    : {};

  const accounts = await Promise.all(
    configs.map(async ({ accountId, currency }) => {
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
      const newCount = txData.transactions.filter(
        (t) => !t.deleted && !(t.memo?.includes("TX") ?? false)
      ).length;
      return { accountId, name, currency, newCount };
    })
  );

  writeFileSync(namesCacheFile, JSON.stringify(namesCache, null, 2));
  return accounts.sort((a, b) => b.newCount - a.newCount);
}
