export type AccountInfo = {
  accountId: string;
  name: string;
  currency: string;
  newCount: number;
  rate: number | null;
  rateDate: string | null;
};

export type Transaction = {
  id: string;
  date: string;
  amount: number;
  payeeName: string | null;
  memo: string | null;
  rate: number;
  rateDate: string;
  convertedAmount: number;
};

export type ConvertResult = {
  converted: number;
  ignored: number;
  dryRun: boolean;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body as T;
}

const base = import.meta.env.BASE_URL;

export const fetchAccounts = (): Promise<AccountInfo[]> =>
  request(`${base}api/accounts`);

export const fetchTransactions = (accountId: string, currency: string): Promise<{ transactions: Transaction[] }> =>
  request(`${base}api/transactions/${accountId}?currency=${encodeURIComponent(currency)}`);

export const convertTransactions = (
  accountId: string,
  currency: string,
  selections: Array<{ id: string; convert: boolean }>,
  dryRun = false
): Promise<ConvertResult> =>
  request(`${base}api/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, currency, selections, dryRun }),
  });
