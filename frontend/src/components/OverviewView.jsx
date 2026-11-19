function OverviewView({
  summary,
  subscriptions,
  loading,
  onAddClick,
  onNavigate,
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-[#E8EEEB]">
        <p className="text-sm font-semibold text-[#087F65]">
          Loading dashboard metrics...
        </p>
      </div>
    );
  }

  const hasSubscriptions = (summary?.total_subscriptions || 0) > 0;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#E5F4EC] px-3 py-1 text-xs font-semibold text-[#087F65]">
              PERSONAL WORKSPACE
            </span>
            <span className="text-xs text-[#82918B]">
              Real-time subscription intelligence
            </span>
          </div>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#172B2A] md:text-4xl">
            Take control of your
            <span className="text-[#087F65]"> subscriptions.</span>
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-[#718079]">
            Understand where your money goes, catch upcoming renewals before they charge, and make smarter subscription decisions.
          </p>
        </div>

        <button
          onClick={onAddClick}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#087F65] hover:bg-[#066A55] text-white px-5 py-3 text-sm font-semibold transition shadow-sm shrink-0"
        >
          <span className="text-lg font-bold leading-none">+</span>
          Add Subscription
        </button>
      </section>

      {/* KPI Statistic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Subscriptions */}
        <div className="rounded-2xl border border-[#E8EEEB] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#82918B]">
              Active Subscriptions
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E8F5F0] text-[#087F65] text-sm">
              ▤
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#172B2A]">
            {summary?.active_subscriptions || 0}
          </p>
          <p className="mt-1 text-xs text-[#82918B]">
            {summary?.total_subscriptions || 0} total tracked
          </p>
        </div>

        {/* Card 2: Monthly Recurring Expenditure */}
        <div className="rounded-2xl border border-[#E8EEEB] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#82918B]">
              Monthly Recurring
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E8F5F0] text-[#087F65] text-sm">
              ₹
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#172B2A]">
            ₹{(summary?.monthly_recurring_expenditure || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="mt-1 text-xs text-[#82918B]">
            Actual normalized recurring burn
          </p>
        </div>

        {/* Card 3: Yearly Estimated Expenditure */}
        <div className="rounded-2xl border border-[#E8EEEB] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#82918B]">
              Yearly Projected
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E8F5F0] text-[#087F65] text-sm">
              ▥
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#172B2A]">
            ₹{(summary?.yearly_estimated_expenditure || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="mt-1 text-xs text-[#82918B]">
            Projected annual cost
          </p>
        </div>

        {/* Card 4: Upcoming Renewals (Next 30 Days) */}
        <div className="rounded-2xl border border-[#E8EEEB] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#82918B]">
              Upcoming Renewals
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E8F5F0] text-[#087F65] text-sm">
              ◷
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#172B2A]">
            {summary?.upcoming_renewals_count || 0}
          </p>
          <p className="mt-1 text-xs text-[#82918B]">
            Due within the next 30 days
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      {!hasSubscriptions ? (
        /* Empty State with Action */
        <section className="rounded-2xl border border-[#E4ECE7] bg-white p-6 shadow-sm md:p-10">
          <div className="mx-auto flex max-w-lg flex-col items-center py-6 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#E8F5F0] text-4xl text-[#087F65]">
              ◈
            </div>

            <span className="rounded-full bg-[#F0F7F3] px-3 py-1 text-xs font-semibold text-[#087F65]">
              YOUR JOURNEY STARTS HERE
            </span>

            <h2 className="mt-5 text-2xl font-bold text-[#172B2A]">
              Your workspace is ready.
            </h2>

            <p className="mt-3 text-sm leading-6 text-[#82918B]">
              Add your first recurring subscription to calculate real monthly burn, monitor renewal deadlines, and discover waste savings.
            </p>

            <button
              onClick={onAddClick}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#087F65] hover:bg-[#066A55] text-white px-6 py-3 text-sm font-semibold transition shadow-sm"
            >
              + Add Your First Subscription
            </button>

            <div className="mt-8 grid w-full gap-3 text-left sm:grid-cols-2">
              <div className="rounded-xl border border-[#E8EEEB] p-4">
                <span className="text-xl text-[#087F65]">▤</span>
                <h3 className="mt-2 text-sm font-semibold text-[#172B2A]">
                  Subscription tracking
                </h3>
                <p className="mt-1 text-xs leading-5 text-[#82918B]">
                  Centralize all your recurring subscriptions.
                </p>
              </div>

              <div className="rounded-xl border border-[#E8EEEB] p-4">
                <span className="text-xl text-[#087F65]">✧</span>
                <h3 className="mt-2 text-sm font-semibold text-[#172B2A]">
                  AI intelligence
                </h3>
                <p className="mt-1 text-xs leading-5 text-[#82918B]">
                  Discover waste and understand subscription value.
                </p>
              </div>

              <div className="rounded-xl border border-[#E8EEEB] p-4">
                <span className="text-xl text-[#087F65]">◷</span>
                <h3 className="mt-2 text-sm font-semibold text-[#172B2A]">
                  Renewal monitoring
                </h3>
                <p className="mt-1 text-xs leading-5 text-[#82918B]">
                  Keep track of upcoming subscription renewals.
                </p>
              </div>

              <div className="rounded-xl border border-[#E8EEEB] p-4">
                <span className="text-xl text-[#087F65]">▥</span>
                <h3 className="mt-2 text-sm font-semibold text-[#172B2A]">
                  Spending analytics
                </h3>
                <p className="mt-1 text-xs leading-5 text-[#82918B]">
                  Understand recurring costs and potential savings.
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* Populated Overview: Two-column split */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Subscriptions (2 cols) */}
          <div className="lg:col-span-2 rounded-2xl border border-[#E8EEEB] bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#172B2A]">
                  Recent Subscriptions
                </h3>
                <p className="text-xs text-[#82918B]">
                  Your active and tracked recurring subscriptions
                </p>
              </div>
              <button
                onClick={() => onNavigate("Subscriptions")}
                className="text-xs font-semibold text-[#087F65] hover:underline"
              >
                View all ({subscriptions.length}) →
              </button>
            </div>

            <div className="divide-y divide-[#F4F7F5]">
              {subscriptions.slice(0, 5).map((sub) => (
                <div
                  key={sub.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8F5F0] text-base font-bold text-[#087F65]">
                      {sub.name ? sub.name[0].toUpperCase() : "S"}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#172B2A]">
                        {sub.name}
                      </h4>
                      <p className="text-xs text-[#82918B]">
                        {sub.category_name} • <span className="capitalize">{sub.billing_interval}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-[#172B2A]">
                      ₹{sub.monthly_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      <span className="text-xs font-normal text-[#82918B]">/mo</span>
                    </p>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full capitalize">
                      {sub.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Renewals Panel (1 col) */}
          <div className="rounded-2xl border border-[#E8EEEB] bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#172B2A]">
                  Upcoming Renewals
                </h3>
                <p className="text-xs text-[#82918B]">
                  Next scheduled renewal charges
                </p>
              </div>
              <button
                onClick={() => onNavigate("Renewals")}
                className="text-xs font-semibold text-[#087F65] hover:underline"
              >
                View calendar →
              </button>
            </div>

            {summary?.upcoming_renewals?.length === 0 ? (
              <p className="text-xs text-[#82918B] py-6 text-center">
                No upcoming renewals scheduled in the near future.
              </p>
            ) : (
              <div className="space-y-3">
                {summary?.upcoming_renewals?.slice(0, 4).map((r) => {
                  const isUrgent = r.days_until <= 3;
                  return (
                    <div
                      key={r.id}
                      className={`p-3 rounded-xl border transition ${
                        isUrgent
                          ? "border-red-200 bg-red-50/50"
                          : "border-[#E8EEEB] bg-[#FAFBFB]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-[#172B2A]">
                          {r.name}
                        </span>
                        <span className="text-xs font-bold text-[#172B2A]">
                          ₹{r.monthly_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <span className="text-[#82918B]">
                          {r.next_billing_date}
                        </span>
                        <span
                          className={`font-semibold ${
                            isUrgent ? "text-red-600" : "text-[#087F65]"
                          }`}
                        >
                          {r.days_until === 0
                            ? "Today"
                            : r.days_until === 1
                            ? "Tomorrow"
                            : `In ${r.days_until} days`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default OverviewView;
