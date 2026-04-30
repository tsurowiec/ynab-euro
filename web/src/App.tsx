import { useState, useEffect, useRef } from "react";
import { fetchAccounts, fetchTransactions, convertTransactions } from "./api";
import type { AccountInfo, Transaction, ConvertResult } from "./api";
import AccountList from "./components/AccountList";
import TransactionList from "./components/TransactionList";

type Screen = "accounts" | "transactions" | "result";

export default function App() {
  const [screen, setScreen] = useState<Screen>("accounts");

  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [selectedAccount, setSelectedAccount] = useState<AccountInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const [result, setResult] = useState<ConvertResult | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  const loadAccountsRef = useRef(loadAccounts);
  loadAccountsRef.current = loadAccounts;

  useEffect(() => {
    loadAccounts();
    function onVisibilityChange() {
      if (document.visibilityState === "visible") loadAccountsRef.current();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  async function loadAccounts() {
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      setAccounts(await fetchAccounts());
      setLastRefreshed(new Date());
    } catch (e) {
      setAccountsError(String(e));
    } finally {
      setAccountsLoading(false);
    }
  }

  async function selectAccount(account: AccountInfo) {
    setSelectedAccount(account);
    setTransactions([]);
    setTxError(null);
    setTxLoading(true);
    setScreen("transactions");
    try {
      const { transactions } = await fetchTransactions(account.accountId, account.currency);
      setTransactions(transactions);
    } catch (e) {
      setTxError(String(e));
    } finally {
      setTxLoading(false);
    }
  }

  async function handleConvert(
    selections: Array<{ id: string; convert: boolean }>,
    dryRun: boolean
  ) {
    if (!selectedAccount) return;
    setConverting(true);
    setConvertError(null);
    try {
      const res = await convertTransactions(selectedAccount.accountId, selectedAccount.currency, selections, dryRun);
      setResult(res);
      setScreen("result");
      loadAccounts();
    } catch (e) {
      setConvertError(e instanceof Error ? e.message : String(e));
    } finally {
      setConverting(false);
    }
  }

  function goBack() {
    setScreen("accounts");
    setSelectedAccount(null);
    setTransactions([]);
    setConvertError(null);
  }

  const headerSubtitle =
    screen === "transactions" && !txLoading && transactions.length > 0
      ? `${transactions.length} transaction${transactions.length !== 1 ? "s" : ""}`
      : null;

  return (
    <div className="app">
      <header className="header">
        <h1>YNAB Converter</h1>
        {headerSubtitle && <p className="header-subtitle">{headerSubtitle}</p>}
      </header>
      <main className="main">
        {screen === "accounts" && (
          <AccountList
            accounts={accounts}
            loading={accountsLoading}
            error={accountsError}
            lastRefreshed={lastRefreshed}
            onSelect={selectAccount}
            onRetry={loadAccounts}
          />
        )}
        {screen === "transactions" && selectedAccount && (
          <TransactionList
            account={selectedAccount}
            transactions={transactions}
            loading={txLoading}
            error={txError ?? convertError}
            converting={converting}
            onConvert={handleConvert}
            onBack={goBack}
          />
        )}
        {screen === "result" && result && (
          <div className="result">
            <div className="result-icon">✓</div>
            <h2>{result.dryRun ? "Dry run complete" : "Done!"}</h2>
            <p>
              {result.converted} converted, {result.ignored} ignored.
            </p>
            <button className="btn btn-primary" onClick={goBack}>
              Back to accounts
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
