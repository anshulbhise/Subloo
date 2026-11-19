import { useState, useEffect } from "react";
import api from "../services/api";

function AIInsightsView({ onAddClick, onCheckInClick, onEditClick }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchInsights = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getRecommendations();
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load subscription insights.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const getRiskBadge = (risk) => {
    switch (risk) {
      case "high":
        return "bg-red-500/15 text-red-500 border border-red-500/20";
      case "medium":
        return "bg-amber-500/15 text-amber-500 border border-amber-500/20";
      default:
        return "bg-emerald-500/15 text-[var(--accent-text)] border border-[var(--accent-border)]";
    }
  };

  const getActionBadge = (action) => {
    switch (action) {
      case "cancel":
        return "bg-red-600 text-white";
      case "downgrade":
        return "bg-amber-600 text-white";
      default:
        return "bg-[var(--accent-primary)] text-white";
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              AI Waste Intelligence
            </h1>
            <span className="rounded-full bg-[var(--accent-subtle)] text-[var(--accent-text)] border border-[var(--accent-border)] px-2.5 py-0.5 text-xs font-semibold">
              Deterministic Analytics
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Data-driven waste detection and cost reduction recommendations based strictly on your usage and billing data.
          </p>
        </div>

        <button
          onClick={fetchInsights}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] transition shadow-2xs shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Re-Analyze
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
          <p className="text-sm font-semibold text-[var(--accent-text)]">
            Analyzing subscription usage and waste patterns...
          </p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-500 text-sm">
          {error}
        </div>
      ) : !data || data.recommendations.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 text-center shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent-primary)] mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">
            No subscriptions to analyze
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-[var(--text-muted)] max-w-md mx-auto">
            Add your active subscriptions and check in on how frequently you use them to reveal personalized cost-cutting recommendations.
          </p>
          <button
            onClick={onAddClick}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-5 py-2.5 text-sm font-semibold transition shadow-xs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            Add Your First Subscription
          </button>
        </div>
      ) : (
        <>
          {/* Potential Savings Banner */}
          <div className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-subtle)] p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 text-[var(--accent-text)]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Total Potential Savings Identified
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-3xl md:text-4xl font-extrabold text-[var(--text-primary)]">
                    ₹{data.total_potential_yearly_savings.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-xs sm:text-sm font-medium text-[var(--text-secondary)]">
                    / year (≈ ₹{data.total_potential_monthly_savings.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}/mo)
                  </span>
                </div>
                <p className="mt-2 text-xs text-[var(--text-secondary)] max-w-lg leading-relaxed">
                  Based on {data.waste_count} underutilized or overpaying subscription{data.waste_count === 1 ? "" : "s"} detected across your workspace.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[var(--bg-surface)] px-4 py-3 border border-[var(--border-subtle)] text-center shadow-xs">
                  <span className="block text-xl font-bold text-red-500">
                    {data.waste_count}
                  </span>
                  <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
                    Waste Alerts
                  </span>
                </div>
                {data.duplicate_count > 0 && (
                  <div className="rounded-xl bg-[var(--bg-surface)] px-4 py-3 border border-amber-500/30 text-center shadow-xs">
                    <span className="block text-xl font-bold text-amber-500">
                      {data.duplicate_count}
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
                      Duplicates
                    </span>
                  </div>
                )}
                <div className="rounded-xl bg-[var(--bg-surface)] px-4 py-3 border border-[var(--border-subtle)] text-center shadow-xs">
                  <span className="block text-xl font-bold text-[var(--accent-primary)]">
                    {data.recommendations.length}
                  </span>
                  <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
                    Insights
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Budget Intelligence Card */}
          {data.budget_insights && (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-2 text-[var(--accent-text)]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-bold uppercase tracking-wider">
                  Target Budget Utilization Forecast
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {data.budget_insights.explanation}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-[var(--border-subtle)]">
                <div>
                  <p className="text-[10px] uppercase text-[var(--text-muted)] font-semibold">Monthly Budget</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">₹{data.budget_insights.budget.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-[var(--text-muted)] font-semibold">Current Burn</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">₹{data.budget_insights.current_monthly_burn.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-[var(--text-muted)] font-semibold">Current Utilization</p>
                  <p className={`text-sm font-bold ${data.budget_insights.is_exceeded ? 'text-red-500' : 'text-[var(--accent-primary)]'}`}>
                    {data.budget_insights.utilization_percentage}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-[var(--text-muted)] font-semibold">Post-Savings Burn</p>
                  <p className="text-sm font-bold text-emerald-600">
                    ₹{data.budget_insights.projected_monthly_burn_after_savings.toFixed(2)} ({data.budget_insights.projected_utilization_percentage}%)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Overlapping Duplicates Detection */}
          {data.duplicates && data.duplicates.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/10 text-amber-500 text-xs">!</span>
                Detected Duplicate Subscriptions ({data.duplicates.length})
              </h2>
              <div className="grid gap-3">
                {data.duplicates.map((dup, idx) => (
                  <div key={idx} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">{dup.name} ({dup.count} active instances)</h4>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{dup.reason}</p>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)] block">Save by Cancelling Duplicate</span>
                        <span className="text-sm font-extrabold text-emerald-600">+₹{dup.potential_monthly_savings.toFixed(2)}/mo</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations List */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Subscription Recommendations
            </h2>

            <div className="grid gap-4">
              {data.recommendations.map((rec) => (
                <div
                  key={rec.subscription_id}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs transition hover:border-[var(--border-strong)]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Left details */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-[var(--text-primary)]">
                          {rec.name}
                        </h3>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getActionBadge(
                            rec.recommended_action
                          )}`}
                        >
                          {rec.recommended_action}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getRiskBadge(
                            rec.risk_level
                          )}`}
                        >
                          {rec.risk_level} risk
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                        {rec.reason}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)] pt-1">
                        <span>
                          Current burn:{" "}
                          <strong className="text-[var(--text-primary)]">
                            ₹{rec.current_monthly_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}/mo
                          </strong>
                        </span>
                        {rec.usage_score !== null && (
                          <span>
                            Usage:{" "}
                            <strong className="text-[var(--text-primary)]">
                              {rec.usage_score}%
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right savings + actions */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-[var(--border-subtle)]">
                      {rec.potential_savings > 0 && (
                        <div className="text-left sm:text-right">
                          <p className="text-xs text-[var(--text-muted)]">Potential Savings</p>
                          <p className="text-base font-bold text-[var(--accent-text)]">
                            ₹{rec.potential_savings.toLocaleString(undefined, { minimumFractionDigits: 2 })}/mo
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onCheckInClick({ id: rec.subscription_id, name: rec.name, usage_score: rec.usage_score })}
                          className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-text)] hover:bg-[var(--accent-subtle)] transition"
                        >
                          Check-in
                        </button>
                        <button
                          onClick={() => onEditClick({ id: rec.subscription_id, name: rec.name })}
                          className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-secondary)] transition"
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AIInsightsView;
