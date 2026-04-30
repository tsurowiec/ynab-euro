import { useState, useEffect, useRef, useMemo } from "react";
import type { AccountInfo, Transaction } from "../api";

type Selection = { id: string; convert: boolean };

type Props = {
  account: AccountInfo;
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  converting: boolean;
  onConvert: (selections: Selection[], dryRun: boolean) => void;
  onBack: () => void;
};

export default function TransactionList({
  account, transactions, loading, error, converting, onConvert, onBack,
}: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const didSwipe = useRef(false);
  const gestureDir = useRef<"h" | "v" | null>(null);
  const rowRefs = useRef<Map<string, HTMLLabelElement>>(new Map());

  useEffect(() => {
    setChecked(new Set(transactions.map((t) => t.id)));
  }, [transactions]);

  const allChecked = checked.size === transactions.length && transactions.length > 0;

  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(transactions.map((t) => t.id)));
  }

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    didSwipe.current = false;
    gestureDir.current = null;
  }

  function handleTouchMove(e: React.TouchEvent, id: string) {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    if (!gestureDir.current) {
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5)
        gestureDir.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      return;
    }
    if (gestureDir.current !== "h") return;

    const el = rowRefs.current.get(id);
    if (!el) return;
    const absDx = Math.max(0, -dx); // only left swipe
    const offset = absDx / (1 + absDx / 80);
    el.style.transition = "none";
    el.style.transform = `translateX(${-offset}px)`;
  }

  function handleTouchEnd(e: React.TouchEvent, id: string) {
    const el = rowRefs.current.get(id);
    if (el) {
      el.style.transition = "transform 0.25s ease";
      el.style.transform = "translateX(0)";
    }

    if (gestureDir.current !== "h") return;

    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      didSwipe.current = true;
      toggle(id);
    }
  }

  function handleChange(id: string) {
    if (didSwipe.current) { didSwipe.current = false; return; }
    toggle(id);
  }

  const totals = useMemo(() => {
    const selected = transactions.filter((t) => checked.has(t.id));
    const ignored = transactions.filter((t) => !checked.has(t.id));
    return {
      convertCount: selected.length,
      ignoreCount: ignored.length,
      totalOrig: selected.reduce((s, t) => s + t.amount, 0) / 1000,
      totalPln: selected.reduce((s, t) => s + t.convertedAmount, 0) / 1000,
    };
  }, [transactions, checked]);

  function buildButtonLabel() {
    const parts = [];
    if (totals.convertCount > 0) parts.push(`Convert ${totals.convertCount}`);
    if (totals.ignoreCount > 0) parts.push(`Ignore ${totals.ignoreCount}`);
    return parts.join(", ") || "Nothing to do";
  }

  function handleConfirm() {
    navigator.vibrate?.(50);
    setConfirming(false);
    onConvert(
      transactions.map((t) => ({ id: t.id, convert: checked.has(t.id) })),
      false
    );
  }

  if (loading) {
    return (
      <>
        <button className="btn btn-primary tx-back-btn" onClick={onBack}>← Back</button>
        <div className="loading"><div className="spinner" />Loading transactions…</div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <button className="btn btn-primary tx-back-btn" onClick={onBack}>← Back</button>
        <div className="error"><p>{error}</p></div>
      </>
    );
  }

  if (transactions.length === 0) {
    return (
      <>
        <button className="btn btn-primary tx-back-btn" onClick={onBack}>← Back</button>
        <div className="empty">No unprocessed transactions.</div>
      </>
    );
  }

  const nothingToDo = totals.convertCount === 0 && totals.ignoreCount === 0;

  return (
    <>
      <div className="transaction-view">
        <div className="tx-header">
          <button className="btn btn-primary tx-back-btn" onClick={onBack}>← Back</button>
          <h2 className="tx-account-name">{account.name}</h2>
          {account.rate && (
            <p className="tx-rate-header">
              1.00 {account.currency} → {account.rate.toFixed(4)} PLN
            </p>
          )}
        </div>

        <div className="tx-controls">
          <label className="check-all">
            <input type="checkbox" checked={allChecked} onChange={toggleAll} />
            Select all
          </label>
          <span className="tx-count">{transactions.length} transactions</span>
        </div>

        <div className="tx-list">
          {transactions.map((t) => (
            <label
              key={t.id}
              ref={(el) => { if (el) rowRefs.current.set(t.id, el); else rowRefs.current.delete(t.id); }}
              className={`tx-row ${checked.has(t.id) ? "" : "tx-unchecked"}`}
              onTouchStart={handleTouchStart}
              onTouchMove={(e) => handleTouchMove(e, t.id)}
              onTouchEnd={(e) => handleTouchEnd(e, t.id)}
            >
              <input
                type="checkbox"
                checked={checked.has(t.id)}
                onChange={() => handleChange(t.id)}
              />
              <div className="tx-details">
                <div className="tx-top">
                  <span className="tx-date">{t.date}</span>
                  <span className="tx-payee">{t.payeeName ?? "—"}</span>
                  {t.memo && <span className="tx-memo">{t.memo}</span>}
                </div>
                <div className="tx-bottom">
                  <span className="tx-orig">{(t.amount / 1000).toFixed(2)} {account.currency}</span>
                  <span className="tx-arrow">→</span>
                  <span className="tx-converted">{(t.convertedAmount / 1000).toFixed(2)} PLN</span>
                </div>
                <div className="tx-rate">@ {t.rate.toFixed(4)} ({t.rateDate})</div>
              </div>
            </label>
          ))}
        </div>

        <div className="tx-footer">
          <div className="tx-summary">
            {totals.convertCount > 0 && (
              <span>
                {totals.totalOrig.toFixed(2)} {account.currency} → <strong>{totals.totalPln.toFixed(2)} PLN</strong>
              </span>
            )}
          </div>
          <div className="tx-actions">
            <button
              className="btn btn-primary"
              onClick={() => setConfirming(true)}
              disabled={converting || nothingToDo}
            >
              {buildButtonLabel()}
            </button>
          </div>
        </div>
      </div>

      {confirming && (
        <div className="modal-overlay" onClick={() => setConfirming(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm</h3>
            <ul className="confirm-list">
              {totals.convertCount > 0 && (
                <li>
                  <strong>Convert {totals.convertCount}</strong> transaction{totals.convertCount !== 1 ? "s" : ""}
                  <div className="confirm-amounts">
                    <span className="confirm-orig">{totals.totalOrig.toFixed(2)} {account.currency}</span>
                    <span className="confirm-arrow">→</span>
                    <span className="confirm-converted">{totals.totalPln.toFixed(2)} PLN</span>
                  </div>
                </li>
              )}
              {totals.ignoreCount > 0 && (
                <li>
                  <strong>Ignore {totals.ignoreCount}</strong> transaction{totals.ignoreCount !== 1 ? "s" : ""}
                </li>
              )}
            </ul>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirm} disabled={converting}>
                {converting ? "Posting…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
