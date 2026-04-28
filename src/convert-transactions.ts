import { convertTransactions } from "./lib/convert.js";

const args = process.argv.slice(2).filter((a) => a !== "--dry-run");
const dryRun = process.argv.includes("--dry-run");
const [accountId, currency, rateArg] = args;

if (!accountId || !currency || !rateArg) {
  console.error("Usage: npx tsx src/convert-transactions.ts <account-id> <currency> <rate> [--dry-run]");
  console.error("Example: npx tsx src/convert-transactions.ts abc-123 EUR 4.25 --dry-run");
  process.exit(1);
}
const rate = parseFloat(rateArg);
if (isNaN(rate)) {
  console.error(`Invalid rate: ${rateArg}`);
  process.exit(1);
}

await convertTransactions(accountId, currency, rate, dryRun);
