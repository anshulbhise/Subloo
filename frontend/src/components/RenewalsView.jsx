import { useState, useEffect } from "react";
import api from "../services/api";

function RenewalsView({ onAddClick, onEditClick }) {
  const [renewalsData, setRenewalsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchRenewals = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getRenewals();
      setRenewalsData(data);
    } catch (err) {
      setError(err.message || "Failed to load renewals calendar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRenewals();
  }, []);

  const renderSection = (title, items, badgeClass, emptyMessage) => (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <h3 className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${badgeClass}`}
          >
            {items.length}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] py-4 text-center">{emptyMessage}</p>
      ) : (
        <div className="grid gap-3">
          {items.map((sub) => {
            const isUrgent = sub.days_until <= 3;
            return (
              <div
                key={sub.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border transition ${
                  isUrgent
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
                      {sub.name}
                    </h4>
                    <p className="text-xs text-[var(--text-muted)]">
                      {sub.category_name} •{" "}
                      <span className="capitalize">{sub.billing_interval}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                      {sub.currency === "USD" ? "$" : sub.currency === "EUR" ? "€" : sub.currency === "GBP" ? "£" : "₹"}
                      {sub.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {sub.next_billing_date}
                    </p>
                  </div>

                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${
                      sub.days_until === 0
                        ? "bg-red-500/15 text-red-500 font-bold animate-pulse"
                        : sub.days_until <= 3
                        ? "bg-red-500/15 text-red-500 font-bold"
                        : sub.days_until <= 7
                        ? "bg-amber-500/15 text-amber-500 font-semibold"
                        : "bg-[var(--accent-subtle)] text-[var(--accent-text)]"
                    }`}
                  >
                    {sub.days_until === 0
                      ? "Renews Today!"
                      : sub.days_until === 1
                      ? "Tomorrow"
                      : `In ${sub.days_until} days`}
                  </span>

                  <button
                    onClick={() => onEditClick(sub)}
                    className="p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] text-xs transition"
                    title="Edit Subscription"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
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
              {renewalsData?.total_renewals_tracked || 0} Tracked
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Real-time renewal timeline to prevent surprise charges and unwanted auto-renewals.
          </p>
        </div>

        <button
          onClick={onAddClick}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-5 py-2.5 text-sm font-semibold transition shadow-xs shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          Add Subscription
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
          <p className="text-sm font-medium text-[var(--accent-text)]">
            Calculating upcoming renewal deadlines...
          </p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-500 text-sm">
          {error}
        </div>
      ) : !renewalsData || renewalsData.total_renewals_tracked === 0 ? (
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
          {/* Section: Due in Next 7 Days */}
          {renderSection(
            "Due Within 7 Days",
            renewalsData.due_in_7_days || [],
            "bg-red-500/15 text-red-500",
            "No charges scheduled within the next 7 days."
          )}

          {/* Section: Due in Next 30 Days */}
          {renderSection(
            "Due Later This Month (Next 30 Days)",
            renewalsData.due_in_30_days || [],
            "bg-amber-500/15 text-amber-500",
            "No other renewals due in the next 30 days."
          )}

          {/* Section: Future Renewals */}
          {renderSection(
            "Future Scheduled Renewals",
            renewalsData.due_future || [],
            "bg-[var(--accent-subtle)] text-[var(--accent-text)]",
            "No future renewals on calendar."
          )}
        </div>
      )}
    </div>
  );
}

export default RenewalsView;
