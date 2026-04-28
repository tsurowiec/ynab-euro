import { api, planId } from "./client.js";

const { data } = await api.accounts.getAccounts(planId);

for (const a of data.accounts) {
  if (a.closed || a.deleted) continue;
  const balance = (a.balance / 1000).toFixed(2);
  console.log(`${a.id}  ${a.name.padEnd(30)} ${balance.padStart(12)} ${a.type}`);
}
