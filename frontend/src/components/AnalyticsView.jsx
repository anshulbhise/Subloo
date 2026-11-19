import { useMemo } from "react";

function AnalyticsView({ summary, subscriptions = [], loading, onAddClick }) {
  // Compute analytics derived from actual subscriptions
  const stats = useMemo(() => {
    if (!subscriptions || subscriptions.length === 0) {
      return {
        avgCost: 0,
        highestSub: null,
        intervalBreakdown: {},
        activeCount: 0,
        totalMonthly: 0,
      };
    }

    const activeSubs = subscriptions.filter(
      (s) => s.status === "active" || s.status === "trial"
    );

    const totalMonthly = activeSubs.reduce(
      (acc, s) => acc + (s.monthly_cost || 0),
      0
    );

    const avgCost =
      activeSubs.length > 0 ? totalMonthly / activeSubs.length : 0;

    let highestSub = null;
    activeSubs.forEach((s) => {
      if (!highestSub || s.monthly_cost > highestSub.monthly_cost) {
        highestSub = s;
      }
    });

    // Billing interval breakdown
    const intervalMap = {};
    activeSubs.forEach((s) => {
      const key = s.billing_interval || "monthly";
      if (!intervalMap[key]) {
        intervalMap[key] = { count: 0, total: 0 };
      }
      intervalMap[key].count += 1;
      intervalMap[key].total += s.monthly_cost || 0;
    });

    return {
      avgCost,
      highestSub,
      intervalBreakdown: intervalMap,
      activeCount: activeSubs.length,
      totalMonthly,
    };
  }, [subscriptions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
        <p className="text-sm font-semibold text-[var(--accent-text)]">
          Aggregating financial spend analytics...
        </p>
      </div>
    );
  }

  const categoryBreakdown = summary?.category_breakdown || [];
  const hasData = (summary?.total_subscriptions || subscriptions.length || 0) > 0;
  const monthlyRecurring = summary?.monthly_recurring_expenditure || stats.totalMonthly || 0;

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
            Add Your First Subscription
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
                ₹{monthlyRecurring.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-[var(--accent-text)] mt-1">
                {stats.activeCount} active subscriptions
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Yearly Projected Cost
              </p>
              <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
                ₹{(summary?.yearly_estimated_expenditure || monthlyRecurring * 12).toLocaleString(
                  undefined,
                  { minimumFractionDigits: 2 }
                )}
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
                ₹{stats.avgCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                {stats.highestSub ? stats.highestSub.name : "None"}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {stats.highestSub
                  ? `₹${stats.highestSub.monthly_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })} / mo`
                  : "No data"}
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
                    const pct = monthlyRecurring > 0
                      ? Math.min((cat.monthly_cost / monthlyRecurring) * 100, 100)
                      : 0;
                    return (
                      <div key={cat.category_name || idx}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold text-[var(--text-primary)]">
                            {cat.category_name}
                          </span>
                          <div className="text-right">
                            <span className="font-bold text-[var(--text-primary)]">
                              ₹{cat.monthly_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                          ₹{data.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
    </div>
  );
}

export default AnalyticsView;
