import { useState, useEffect } from "react";
import api from "../services/api";

const getCurrencySymbol = (c) => {
  switch (String(c || "").toUpperCase()) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    default:
      return "₹";
  }
};

const formatAmount = (val, currency = "INR") => {
  const num = Number(val);
  const symbol = getCurrencySymbol(currency);
  if (isNaN(num)) return `${symbol}0.00`;
  return `${symbol}${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

function RenewalsView({ onAddClick, onEditClick }) {
  const [renewalsData, setRenewalsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchRenewals = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getRenewals();
      setRenewalsData(data || {});
    } catch (err) {
      setError(err.message || "Failed to load renewals calendar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRenewals();
  }, []);

  const overdue = renewalsData?.overdue || [];
  const dueSoon = renewalsData?.due_soon || renewalsData?.due_in_7_days || [];
  const dueThisMonth = renewalsData?.due_in_30_days || [
    ...(renewalsData?.next_two_weeks || []),
    ...(renewalsData?.this_month || []),
  ];
  const dueFuture = renewalsData?.future || renewalsData?.due_future || [];

  const totalTracked = Number(
    renewalsData?.total_renewals_tracked ??
      (overdue.length + dueSoon.length + dueThisMonth.length + dueFuture.length)
  );

  const renderSection = (title, items, badgeClass, emptyMessage, isDanger = false) => (
    <div className={`rounded-2xl border ${isDanger ? "border-red-500/30 bg-red-500/5" : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"} p-6 shadow-xs`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <h3 className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${badgeClass}`}>
            {items.length}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] py-4 text-center">{emptyMessage}</p>
      ) : (
        <div className="grid gap-3">
          {items.map((sub, idx) => {
            const daysUntil = Number(sub.days_until ?? 0);
            const isUrgent = daysUntil <= 3 && daysUntil >= 0;
            const isPast = daysUntil < 0;

            return (
              <div
                key={sub.id || idx}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border transition ${
                  isPast
                    ? "border-red-500/40 bg-red-500/10"
                    : isUrgent
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] hover:border-[var(--accent-primary)]/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-sm font-bold text-[var(--accent-primary)]">
                    {sub.name ? sub.name[0].toUpperCase() : "S"}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[var(--text-primary)]">
                      {sub.name || "Subscription"}
                    </h4>
                    <p className="text-xs text-[var(--text-muted)]">
                      {sub.category_name || "General"} •{" "}
                      <span className="capitalize">{sub.billing_interval || "Monthly"}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                      {formatAmount(sub.amount, sub.currency)}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {sub.next_billing_date || "Upcoming"}
                    </p>
                  </div>

                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${
                      isPast
                        ? "bg-red-500/20 text-red-600 font-bold"
                        : daysUntil === 0
                        ? "bg-red-500/20 text-red-600 font-bold animate-pulse"
                        : daysUntil <= 3
                        ? "bg-red-500/15 text-red-500 font-bold"
                        : daysUntil <= 7
                        ? "bg-amber-500/15 text-amber-500 font-semibold"
                        : "bg-[var(--accent-subtle)] text-[var(--accent-text)]"
                    }`}
                  >
                    {isPast
                      ? `${Math.abs(daysUntil)} days overdue`
                      : daysUntil === 0
                      ? "Renews Today!"
                      : daysUntil === 1
                      ? "Tomorrow"
                      : `In ${daysUntil} days`}
                  </span>

                  {onEditClick && (
                    <button
                      onClick={() => onEditClick(sub)}
                      className="p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] text-xs transition"
                      title="Edit Subscription"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Renewals Schedule
            </h1>
            <span className="rounded-full bg-[var(--accent-subtle)] text-[var(--accent-text)] border border-[var(--accent-border)] px-2.5 py-0.5 text-xs font-semibold">
              {totalTracked} Tracked
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Real-time renewal timeline to prevent surprise charges and unwanted auto-renewals.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={fetchRenewals}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] transition shadow-2xs"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>

          <button
            onClick={onAddClick}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-5 py-2.5 text-sm font-semibold transition shadow-xs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Subscription</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] text-center px-4">
          <div className="h-10 w-10 border-3 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Calculating upcoming renewal deadlines...
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Matching next billing dates against calendar schedules.
          </p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-500 text-sm flex items-center justify-between gap-4">
          <div>
            <p className="font-bold">Failed to load renewals calendar</p>
            <p className="text-xs mt-1 text-red-400">{error}</p>
          </div>
          <button
            onClick={fetchRenewals}
            className="px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition shrink-0"
          >
            Retry
          </button>
        </div>
      ) : totalTracked === 0 ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 text-center shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent-primary)] mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">
            No upcoming renewals found
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-[var(--text-muted)] max-w-md mx-auto">
            Add recurring subscriptions with scheduled next billing dates to build your personalized renewal timeline.
          </p>
          <button
            onClick={onAddClick}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-5 py-2.5 text-sm font-semibold transition shadow-xs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            Add Subscription
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section: Overdue Auto-Renewals (if any) */}
          {overdue.length > 0 &&
            renderSection(
              "Overdue / Action Needed",
              overdue,
              "bg-red-500/20 text-red-600 font-bold",
              "",
              true
            )}

          {/* Section: Due in Next 7 Days */}
          {renderSection(
            "Due Within 7 Days",
            dueSoon,
            "bg-red-500/15 text-red-500",
            "No charges scheduled within the next 7 days."
          )}

          {/* Section: Due in Next 30 Days */}
          {renderSection(
            "Due Later This Month (Next 30 Days)",
            dueThisMonth,
            "bg-amber-500/15 text-amber-500",
            "No other renewals due in the next 30 days."
          )}

          {/* Section: Future Renewals */}
          {renderSection(
            "Future Scheduled Renewals",
            dueFuture,
            "bg-[var(--accent-subtle)] text-[var(--accent-text)]",
            "No future renewals on calendar."
          )}
        </div>
      )}
    </div>
  );
}

export default RenewalsView;
