import { useState, useMemo, useEffect } from "react";
import api from "../services/api";
import FinancialReportModal from "./FinancialReportModal";

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

const formatCurrency = (val, symbol = "₹") => {
  const num = Number(val);
  if (isNaN(num)) return `${symbol}0.00`;
  return `${symbol}${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

function AnalyticsView({ summary: initialSummary, subscriptions = [], loading: initialLoading, onAddClick }) {
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [localSummary, setLocalSummary] = useState(initialSummary || null);
  const [localLoading, setLocalLoading] = useState(false);

  // Sync or fetch summary if not supplied by parent
  useEffect(() => {
    if (initialSummary) {
      setLocalSummary(initialSummary);
    } else if (!initialLoading) {
      setLocalLoading(true);
      api.getAnalyticsSummary()
        .then((res) => {
          if (res) setLocalSummary(res);
        })
        .catch(() => {})
        .finally(() => setLocalLoading(false));
    }
  }, [initialSummary, initialLoading]);

  // Compute analytics derived safely from actual subscriptions
  const stats = useMemo(() => {
    const list = Array.isArray(subscriptions) ? subscriptions : [];
    if (list.length === 0) {
      return {
        avgCost: 0,
        highestSub: null,
        highestCost: 0,
        intervalBreakdown: {},
        activeCount: 0,
        totalMonthly: 0,
      };
    }

    const activeSubs = list.filter(
      (s) => s.status === "active" || s.status === "trial"
    );

    const totalMonthly = activeSubs.reduce(
      (acc, s) => acc + Number(s.monthly_cost ?? s.amount ?? 0),
      0
    );

    const avgCost = activeSubs.length > 0 ? totalMonthly / activeSubs.length : 0;

    let highestSub = null;
    let highestCost = 0;
    activeSubs.forEach((s) => {
      const cost = Number(s.monthly_cost ?? s.amount ?? 0);
      if (!highestSub || cost > highestCost) {
        highestSub = s;
        highestCost = cost;
      }
    });

    // Billing interval breakdown
    const intervalMap = {};
    activeSubs.forEach((s) => {
      const key = String(s.billing_interval || "monthly").toLowerCase();
      if (!intervalMap[key]) {
        intervalMap[key] = { count: 0, total: 0 };
      }
      intervalMap[key].count += 1;
      intervalMap[key].total += Number(s.monthly_cost ?? s.amount ?? 0);
    });

    return {
      avgCost,
      highestSub,
      highestCost,
      intervalBreakdown: intervalMap,
      activeCount: activeSubs.length,
      totalMonthly,
    };
  }, [subscriptions]);

  const loading = initialLoading || localLoading;
  const summary = localSummary || initialSummary;

  if (loading && !summary && (!subscriptions || subscriptions.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] text-center px-4">
        <div className="h-10 w-10 border-3 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          Aggregating financial spend analytics...
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Calculating monthly burn distributions and category allocations.
        </p>
      </div>
    );
  }

  const currencySymbol = getCurrencySymbol(summary?.currency);
  const monthlyRecurring = Number(summary?.monthly_recurring_expenditure ?? stats.totalMonthly ?? 0);
  const yearlyProjected = Number(summary?.yearly_estimated_expenditure ?? (monthlyRecurring * 12));
  const hasData = (summary?.total_subscriptions || subscriptions.length || 0) > 0;

  // Normalize category breakdown safely from backend
  const categoryBreakdown = (summary?.category_breakdown || []).map((cat, idx) => {
    const name = cat.category_name || cat.category || `Category ${idx + 1}`;
    const monthlyCost = Number(cat.monthly_cost ?? cat.monthly_amount ?? 0);
    const percentage = Number(
      cat.percentage ?? (monthlyRecurring > 0 ? (monthlyCost / monthlyRecurring) * 100 : 0)
    );
    return { name, monthlyCost, percentage };
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Spending Analytics
            </h1>
            <span className="rounded-full bg-[var(--accent-subtle)] text-[var(--accent-text)] border border-[var(--accent-border)] px-2.5 py-0.5 text-xs font-semibold">
              Real-time Metrics
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Data-driven breakdown of recurring expenditure, category allocations and billing cycles.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setReportModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-4 py-2.5 text-xs font-semibold shadow-2xs transition"
          >
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Financial Report</span>
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

      {!hasData ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 text-center shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent-primary)] mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">
            No spending data yet
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-[var(--text-muted)] max-w-md mx-auto">
            Add your active subscriptions to view real-time monthly burn distributions and category analytics.
          </p>
          <button
            onClick={onAddClick}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-5 py-2.5 text-sm font-semibold transition shadow-xs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Your First Subscription</span>
          </button>
        </div>
      ) : (
        <>
          {/* Key Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Monthly Recurring Burn
              </p>
              <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
                {formatCurrency(monthlyRecurring, currencySymbol)}
              </p>
              <p className="text-xs text-[var(--accent-text)] mt-1">
                {stats.activeCount || summary?.active_subscriptions || 0} active subscriptions
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Yearly Projected Cost
              </p>
              <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
                {formatCurrency(yearlyProjected, currencySymbol)}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Annual commitment
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Average Cost / Service
              </p>
              <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
                {formatCurrency(stats.avgCost, currencySymbol)}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Per active subscription
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Highest Single Cost
              </p>
              <p className="mt-2 text-2xl font-bold text-[var(--text-primary)] truncate">
                {stats.highestSub ? (stats.highestSub.name || stats.highestSub.custom_name || "Subscription") : "None"}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {stats.highestSub ? `${formatCurrency(stats.highestCost, currencySymbol)} / mo` : "No data"}
              </p>
            </div>
          </div>

          {/* Breakdown Section: 2 Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xs">
              <div className="mb-5">
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Category Distribution
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Monthly recurring expenditure by category
                </p>
              </div>

              {categoryBreakdown.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-6 text-center">
                  No categorized subscriptions available.
                </p>
              ) : (
                <div className="space-y-4">
                  {categoryBreakdown.map((cat, idx) => {
                    const pct = Math.max(0, Math.min(100, cat.percentage));
                    return (
                      <div key={cat.name || idx}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold text-[var(--text-primary)]">
                            {cat.name}
                          </span>
                          <div className="text-right">
                            <span className="font-bold text-[var(--text-primary)]">
                              {formatCurrency(cat.monthlyCost, currencySymbol)}
                            </span>
                            <span className="text-[var(--text-muted)] ml-1.5">
                              ({pct.toFixed(0)}%)
                            </span>
                          </div>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[var(--bg-surface-secondary)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Billing Interval Breakdown */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xs">
              <div className="mb-5">
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Billing Cycle Breakdown
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Subscription distribution across billing intervals
                </p>
              </div>

              <div className="space-y-3">
                {Object.keys(stats.intervalBreakdown).length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] py-6 text-center">
                    No active billing cycles.
                  </p>
                ) : (
                  Object.entries(stats.intervalBreakdown).map(([interval, data]) => (
                    <div
                      key={interval}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)]">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-bold capitalize text-[var(--text-primary)]">
                            {interval.replace("_", " ")}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {data.count} subscription{data.count === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-bold text-[var(--text-primary)]">
                          {formatCurrency(data.total, currencySymbol)}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          monthly equivalent
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <FinancialReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
      />
    </div>
  );
}

export default AnalyticsView;
