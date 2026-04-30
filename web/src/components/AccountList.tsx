import { useState, useEffect } from "react";
import type { AccountInfo } from "../api";

type Props = {
  accounts: AccountInfo[];
  loading: boolean;
  error: string | null;
  lastRefreshed: Date | null;
  onSelect: (account: AccountInfo) => void;
  onRetry: () => void;
};

function formatRefreshed(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

function formatRate(account: AccountInfo): string | null {
  if (!account.rate) return null;
  const date = new Date(account.rateDate + "T00:00:00").toLocaleDateString("en", { month: "short", day: "numeric" });
  return `${account.rate.toFixed(4)} PLN · ${date}`;
}

export default function AccountList({ accounts, loading, error, lastRefreshed, onSelect, onRetry }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading accounts…
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        <p>{error}</p>
        <button className="btn btn-primary" onClick={onRetry}>Retry</button>
      </div>
    );
  }

  return (
    <>
      <div className="account-list">
        {lastRefreshed && (
          <p className="subtitle">Updated {formatRefreshed(lastRefreshed)}</p>
        )}
        {accounts.map((account) => (
          <button
            key={account.accountId}
            className="account-card"
            onClick={() => onSelect(account)}
            disabled={account.newCount === 0}
          >
            <div className="account-card-top">
              <span className="account-name">
                {account.name} <span className="account-currency">[{account.currency}]</span>
              </span>
              <span className={`badge ${account.newCount > 0 ? "badge-active" : "badge-empty"}`}>
                {account.newCount} pending
              </span>
            </div>
            {formatRate(account) && (
              <div className="account-rate">{formatRate(account)}</div>
            )}
          </button>
        ))}
      </div>
      <div className="accounts-footer">
        <button className="btn btn-primary accounts-refresh" onClick={onRetry}>
          Refresh
        </button>
      </div>
    </>
  );
}
