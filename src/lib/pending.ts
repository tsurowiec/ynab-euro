import type { TransactionDetail } from "ynab";

// A transaction awaits conversion if it has no TX marker in its memo.
// The unapproved half of a YNAB match (the bank import paired with a
// manually entered transaction) is skipped so the pair isn't converted twice.
export function isPending(t: TransactionDetail): boolean {
  if (t.deleted) return false;
  if (t.memo?.includes("TX")) return false;
  if (t.matched_transaction_id && !t.approved) return false;
  return true;
}
