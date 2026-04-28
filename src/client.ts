import "dotenv/config";
import * as ynab from "ynab";

const token = process.env.YNAB_TOKEN;
if (!token) {
  console.error("Missing YNAB_TOKEN in environment (.env)");
  process.exit(1);
}

export const api = new ynab.API(token);
export const planId = process.env.YNAB_PLAN_ID || "last-used";
