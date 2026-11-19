import { useMemo } from "react";

function AnalyticsView({ summary, subscriptions, loading, onAddClick }) {
  // Compute analytics derived from actual subscriptions
  const stats = useMemo(() => {
    if (!subscriptions || subscriptions.length === 0) {
      return {
        avgCost: 0,
        highestSub: null,
        intervalBreakdown: {},
        activeCount: 0,
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
    };
  }, [subscriptions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-[#E8EEEB]">
        <p className="text-sm font-semibold text-[#087F65]">
          Loading financial analytics...
        </p>
      </div>
    );
  }

  const categoryBreakdown = summary?.category_breakdown || [];
  const hasData = (summary?.total_subscriptions || 0) > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#172B2A]">
              Spending Analytics
            </h1>
            <span className="rounded-full bg-[#E5F4EC] px-2.5 py-0.5 text-xs font-semibold text-[#087F65]">
              Real-time Metrics
            </span>
          </div>
          <p className="text-xs text-[#82918B] mt-1">
            Data-driven breakdown of recurring expenditure, category allocations and billing cycles.
          </p>
        </div>

        <button
          onClick={onAddClick}
          className="inline-flex items-center gap-2 rounded-xl bg-[#087F65] hover:bg-[#066A55] text-white px-5 py-2.5 text-sm font-semibold transition shadow-sm shrink-0"
        >
          <span>+</span> Add Subscription
        </button>
      </div>

      {!hasData ? (
        <div className="rounded-2xl border border-[#E8EEEB] bg-white p-10 text-center shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E8F5F0] text-3xl text-[#087F65] mb-4">
            ▥
          </div>
          <h3 className="text-lg font-bold text-[#172B2A]">
            No spending data yet
          </h3>
          <p className="mt-2 text-sm text-[#82918B] max-w-md mx-auto">
            Add your active subscriptions to view real-time monthly burn distributions and category analytics.
          </p>
          <button
            onClick={onAddClick}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#087F65] hover:bg-[#066A55] text-white px-5 py-2.5 text-sm font-semibold transition shadow-sm"
          >
            + Add Your First Subscription
          </button>
        </div>
      ) : (
        <>
          {/* Key Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-[#E8EEEB] bg-white p-5 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#82918B]">
                Monthly Recurring Burn
              </p>
              <p className="mt-2 text-2xl font-bold text-[#172B2A]">
                ₹{(summary?.monthly_recurring_expenditure || 0).toLocaleString(
                  undefined,
                  { minimumFractionDigits: 2 }
                )}
              </p>
              <p className="text-xs text-[#087F65] mt-1">
                {stats.activeCount} active subscriptions
              </p>
            </div>

            <div className="rounded-2xl border border-[#E8EEEB] bg-white p-5 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#82918B]">
                Yearly Projected Cost
              </p>
              <p className="mt-2 text-2xl font-bold text-[#172B2A]">
                ₹{(summary?.yearly_estimated_expenditure || 0).toLocaleString(
                  undefined,
                  { minimumFractionDigits: 2 }
                )}
              </p>
              <p className="text-xs text-[#82918B] mt-1">
                Annual commitment
              </p>
            </div>

            <div className="rounded-2xl border border-[#E8EEEB] bg-white p-5 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#82918B]">
                Average Cost / Service
              </p>
              <p className="mt-2 text-2xl font-bold text-[#172B2A]">
                ₹{stats.avgCost.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-xs text-[#82918B] mt-1">
                Per active service monthly
              </p>
            </div>

            <div className="rounded-2xl border border-[#E8EEEB] bg-white p-5 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#82918B]">
                Highest Monthly Expense
              </p>
              <p className="mt-2 text-lg font-bold text-[#172B2A] truncate">
                {stats.highestSub ? stats.highestSub.name : "None"}
              </p>
              <p className="text-xs text-[#087F65] mt-1 font-semibold">
                {stats.highestSub
                  ? `₹${stats.highestSub.monthly_cost.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}/mo`
                  : "—"}
              </p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Category Spending Distribution */}
            <div className="rounded-2xl border border-[#E8EEEB] bg-white p-6 shadow-xs">
              <div className="mb-6">
                <h3 className="text-base font-bold text-[#172B2A]">
                  Monthly Spending by Category
                </h3>
                <p className="text-xs text-[#82918B]">
                  Percentage and expenditure allocated across service types
                </p>
              </div>

              {categoryBreakdown.length === 0 ? (
                <p className="text-xs text-[#82918B] py-6 text-center">
                  No categorized subscriptions yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {categoryBreakdown.map((cat, idx) => {
                    // Color rotation for bars
                    const barColors = [
                      "bg-[#087F65]",
                      "bg-[#0D9488]",
                      "bg-[#0284C7]",
                      "bg-[#6366F1]",
                      "bg-[#8B5CF6]",
                      "bg-[#EC4899]",
                    ];
                    const color = barColors[idx % barColors.length];

                    return (
                      <div key={cat.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-[#172B2A]">{cat.category}</span>
                          <span className="text-[#718079]">
                            ₹{cat.monthly_amount.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}{" "}
                            ({cat.percentage}%)
                          </span>
                        </div>
                        <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${color} transition-all duration-500`}
                            style={{ width: `${cat.percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chart 2: Billing Cycle Distribution */}
            <div className="rounded-2xl border border-[#E8EEEB] bg-white p-6 shadow-xs">
              <div className="mb-6">
                <h3 className="text-base font-bold text-[#172B2A]">
                  Billing Cycle Breakdown
                </h3>
                <p className="text-xs text-[#82918B]">
                  How your subscriptions are billed over time
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {Object.entries(stats.intervalBreakdown).map(
                  ([interval, data]) => (
                    <div
                      key={interval}
                      className="p-4 rounded-xl border border-[#E8EEEB] bg-[#F7FAF8]"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#718079] capitalize">
                        {interval}
                      </p>
                      <p className="text-xl font-bold text-[#172B2A] mt-1">
                        {data.count}
                      </p>
                      <p className="text-xs text-[#82918B] mt-0.5">
                        ₹{data.total.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}{" "}
                        / mo
                      </p>
                    </div>
                  )
                )}
              </div>

              {/* Status breakdown pills */}
              <div className="border-t border-[#E8EEEB] pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#82918B] mb-2.5">
                  Subscription Status Overview
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                    {summary?.active_subscriptions || 0} Active
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                    {summary?.trial_subscriptions || 0} Trial
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                    {summary?.paused_subscriptions || 0} Paused
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-200 font-semibold">
                    {summary?.cancelled_subscriptions || 0} Cancelled
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AnalyticsView;
