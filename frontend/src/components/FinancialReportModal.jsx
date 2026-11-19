import { useState, useEffect } from "react";
import api from "../services/api";

export default function FinancialReportModal({ isOpen, onClose }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    async function loadReport() {
      setLoading(true);
      setError("");
      try {
        const data = await api.getFinancialReport();
        setReport(data);
      } catch (err) {
        setError(err.message || "Failed to generate financial report.");
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
      <div className="relative w-full max-w-4xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-2xl my-8 print:border-none print:shadow-none print:p-0 print:my-0">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-xl font-bold text-white shadow-xs">
              S
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Subscription & Financial Report
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Generated {report?.generated_at ? new Date(report.generated_at).toLocaleString() : new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handlePrint}
              disabled={loading || !report}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-primary)] mx-auto mb-3 animate-spin">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Compiling financial analytics...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-500">
            {error}
          </div>
        ) : report ? (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Active Services</p>
                <p className="text-xl font-extrabold text-[var(--text-primary)] mt-1">
                  {report.active_subscriptions}
                  <span className="text-xs font-normal text-[var(--text-muted)] ml-1">/ {report.total_subscriptions}</span>
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Monthly Burn</p>
                <p className="text-xl font-extrabold text-[var(--accent-primary)] mt-1">
                  {report.currency} {report.monthly_recurring_expenditure.toFixed(2)}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Yearly Projected</p>
                <p className="text-xl font-extrabold text-[var(--text-primary)] mt-1">
                  {report.currency} {report.yearly_projected_expenditure.toFixed(2)}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Budget Utilization</p>
                <p className="text-xl font-extrabold text-[var(--text-primary)] mt-1">
                  {report.monthly_budget ? `${report.budget_percentage_utilized}%` : "Not set"}
                </p>
              </div>
            </div>

            {/* Category Breakdown */}
            {report.category_breakdown && report.category_breakdown.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                  Expenditure By Category
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {report.category_breakdown.map((cat, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-xs"
                    >
                      <span className="font-semibold text-[var(--text-primary)]">{cat.category_name}</span>
                      <div className="text-right">
                        <span className="font-bold text-[var(--accent-primary)]">{report.currency} {cat.monthly_cost.toFixed(2)}/mo</span>
                        <span className="text-[10px] text-[var(--text-muted)] ml-1.5">({cat.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subscriptions Table */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                All Active & Tracked Subscriptions ({report.subscriptions.length})
              </h3>
              <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] text-[var(--text-muted)]">
                    <tr>
                      <th className="p-3 font-semibold">Service</th>
                      <th className="p-3 font-semibold">Category</th>
                      <th className="p-3 font-semibold">Interval</th>
                      <th className="p-3 font-semibold text-right">Cost</th>
                      <th className="p-3 font-semibold text-right">Monthly Eq.</th>
                      <th className="p-3 font-semibold">Next Renewal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {report.subscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-[var(--bg-surface-secondary)]/50">
                        <td className="p-3 font-semibold text-[var(--text-primary)]">{sub.name}</td>
                        <td className="p-3 text-[var(--text-secondary)]">{sub.category}</td>
                        <td className="p-3 capitalize text-[var(--text-muted)]">{sub.billing_interval}</td>
                        <td className="p-3 text-right font-medium text-[var(--text-primary)]">
                          {sub.currency} {sub.amount.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-bold text-[var(--accent-primary)]">
                          {sub.currency} {sub.monthly_cost.toFixed(2)}
                        </td>
                        <td className="p-3 text-[var(--text-secondary)]">
                          {sub.next_billing_date || "—"}
                          {sub.days_until !== null && (
                            <span className="text-[10px] text-[var(--text-muted)] ml-1">
                              ({sub.days_until >= 0 ? `${sub.days_until}d` : "overdue"})
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
