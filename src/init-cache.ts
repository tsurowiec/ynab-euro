import { writeFileSync, mkdirSync, existsSync } from "fs";
import { api, planId } from "./client.js";

const raw = process.env.YNAB_ACCOUNTS ?? "";
if (!raw) {
  console.error("Missing YNAB_ACCOUNTS in .env");
  process.exit(1);
}

const accountIds = raw.split(",").map((entry) => entry.trim().split("|")[0]);

const cacheDir = ".cache";
if (!existsSync(cacheDir)) mkdirSync(cacheDir);

const cache: Record<string, number> = {};

for (const accountId of accountIds) {
  const { data } = await api.transactions.getTransactionsByAccount(planId, accountId);
  cache[accountId] = data.server_knowledge;
  console.log(`${accountId}  server_knowledge: ${data.server_knowledge}`);
}

writeFileSync(`${cacheDir}/server_knowledge.json`, JSON.stringify(cache, null, 2));
console.log("\nCache initialised.");
