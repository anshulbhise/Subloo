import { useMemo } from "react";

function OverviewView({
  summary,
  subscriptions = [],
  loading,
  onAddClick,
  onNavigate,
  user,
}) {
  const currencySymbol = useMemo(() => {
    const c = user?.profile?.currency || "INR";
    if (c === "USD") return "$";
    if (c === "EUR") return "€";
    if (c === "GBP") return "£";
    return "₹";
  }, [user]);

  const budget = user?.profile?.monthly_budget;
  const monthlyExpenditure = summary?.monthly_recurring_expenditure || 0;
  const budgetRatio = budget && budget > 0 ? (monthlyExpenditure / budget) * 100 : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-primary)] mb-3 animate-pulse">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Aggregating financial metrics...
        </p>
      </div>
    );
  }

  const hasSubscriptions = (summary?.total_subscriptions || subscriptions.length || 0) > 0;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--accent-subtle)] text-[var(--accent-text)] border border-[var(--accent-border)] px-2.5 py-0.5 text-xs font-semibold">
              PERSONAL WORKSPACE
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              Real-time recurring burn intelligence
            </span>
          </div>

          <h1 className="mt-2.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Welcome back{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
          </h1>

          <p className="mt-1 max-w-xl text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            Monitor real recurring spend, track upcoming renewals before billing, and optimize your monthly commitments.
          </p>
        </div>

        <button
          onClick={onAddClick}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-5 py-2.5 text-sm font-semibold transition shadow-xs shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          Add Subscription
        </button>
      </section>

      {/* KPI Statistic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Subscriptions */}
        <div 
          onClick={() => onNavigate("Subscriptions")}
          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs transition hover:border-[var(--accent-primary)]/50 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition">
              Active Services
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-primary)] group-hover:scale-105 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
            {summary?.active_subscriptions || 0}
          </p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-[var(--text-muted)]">
              {summary?.total_subscriptions || subscriptions.length || 0} total tracked
            </p>
            <span className="text-[11px] text-[var(--accent-text)] font-semibold group-hover:underline">View all →</span>
          </div>
        </div>

        {/* Card 2: Monthly Recurring Burn */}
        <div 
          onClick={() => onNavigate("Analytics")}
          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs transition hover:border-[var(--accent-primary)]/50 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition">
              Monthly Recurring
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-primary)] font-bold text-xs group-hover:scale-105 transition">
              {currencySymbol}
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
            {currencySymbol}
            {monthlyExpenditure.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-[var(--text-muted)]">
              Normalized monthly burn
            </p>
            <span className="text-[11px] text-[var(--accent-text)] font-semibold group-hover:underline">Analytics →</span>
          </div>
        </div>

        {/* Card 3: Yearly Projected Commitment */}
        <div 
          onClick={() => onNavigate("Analytics")}
          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs transition hover:border-[var(--accent-primary)]/50 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition">
              Yearly Projected
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-primary)] group-hover:scale-105 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
            {currencySymbol}
            {(summary?.yearly_estimated_expenditure || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-[var(--text-muted)]">
              Projected annual outlay
            </p>
            <span className="text-[11px] text-[var(--accent-text)] font-semibold group-hover:underline">Analytics →</span>
          </div>
        </div>

        {/* Card 4: Upcoming Renewals (30 Days) */}
        <div 
          onClick={() => onNavigate("Renewals")}
          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs transition hover:border-[var(--accent-primary)]/50 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition">
              Upcoming Renewals
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-primary)] group-hover:scale-105 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
            {summary?.upcoming_renewals_count || 0}
          </p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-[var(--text-muted)]">
              Due within next 30 days
            </p>
            <span className="text-[11px] text-[var(--accent-text)] font-semibold group-hover:underline">Timeline →</span>
          </div>
        </div>
      </div>

      {/* Monthly Budget Progress Section (when user has configured a budget) */}
      {budget && budget > 0 && (
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Monthly Budget Utilization
              </p>
              <h3 className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                {currencySymbol}{monthlyExpenditure.toLocaleString(undefined, { minimumFractionDigits: 2 })} of {currencySymbol}{parseFloat(budget).toLocaleString(undefined, { minimumFractionDigits: 2 })} budget committed
              </h3>
            </div>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full self-start sm:self-auto ${
                budgetRatio > 100
                  ? "bg-red-500/10 text-red-500 border border-red-500/20"
                  : budgetRatio > 80
                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                  : "bg-[var(--accent-subtle)] text-[var(--accent-text)] border border-[var(--accent-border)]"
              }`}
            >
              {budgetRatio.toFixed(1)}% {budgetRatio > 100 ? "Exceeded" : "Used"}
            </span>
          </div>

          <div className="h-2 w-full rounded-full bg-[var(--bg-surface-secondary)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                budgetRatio > 100
                  ? "bg-red-500"
                  : budgetRatio > 80
                  ? "bg-amber-500"
                  : "bg-[var(--accent-primary)]"
              }`}
              style={{ width: `${Math.min(budgetRatio, 100)}%` }}
            />
          </div>
        </section>
      )}

      {/* Main Content Area */}
      {!hasSubscriptions ? (
        /* Woday-inspired Empty State */
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 sm:p-12 text-center shadow-xs">
          <div className="mx-auto flex max-w-lg flex-col items-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent-primary)]">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>

            <span className="rounded-full bg-[var(--accent-subtle)] text-[var(--accent-text)] border border-[var(--accent-border)] px-3 py-1 text-xs font-semibold">
              GETTING STARTED
            </span>

            <h2 className="mt-4 text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              Your subscription workspace is ready.
            </h2>

            <p className="mt-2 text-xs sm:text-sm text-[var(--text-muted)] max-w-md leading-relaxed">
              Add your first recurring subscription to calculate accurate monthly burn, monitor renewal deadlines, and discover waste savings.
            </p>

            <button
              onClick={onAddClick}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-6 py-2.5 text-sm font-semibold transition shadow-xs"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Your First Subscription
            </button>

            <div className="mt-10 grid w-full gap-3 text-left sm:grid-cols-2">
              <div 
                onClick={() => onNavigate("Subscriptions")}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-4 cursor-pointer hover:border-[var(--accent-primary)]/50 transition group"
              >
                <div className="h-8 w-8 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)] flex items-center justify-center mb-2 group-hover:scale-105 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Centralized Tracking
                  </h3>
                  <span className="text-[10px] text-[var(--accent-text)] font-semibold group-hover:underline">Subscriptions →</span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
                  Manage Netflix, AWS, Spotify, and SaaS subscriptions in one unified dashboard.
                </p>
              </div>

              <div 
                onClick={() => onNavigate("AI Insights")}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-4 cursor-pointer hover:border-[var(--accent-primary)]/50 transition group"
              >
                <div className="h-8 w-8 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)] flex items-center justify-center mb-2 group-hover:scale-105 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Waste Detection & AI Insights
                  </h3>
                  <span className="text-[10px] text-[var(--accent-text)] font-semibold group-hover:underline">Explore →</span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
                  Identify unused and underutilized services with automated cost-cutting alerts.
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* Populated Overview */
        <div className="space-y-6">
          {/* Waste Intelligence Shortcut Banner */}
          <div
            onClick={() => onNavigate("AI Insights")}
            className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-subtle)]/40 hover:bg-[var(--accent-subtle)]/70 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition shadow-xs group"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-white shadow-2xs group-hover:scale-105 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    AI Waste Intelligence & Optimization
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--accent-primary)] text-white uppercase tracking-wider">
                    Smart AI
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Scan for underutilized commitments, duplicate tools, and monthly cost-reduction opportunities.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent-text)] group-hover:underline shrink-0 self-end sm:self-auto">
              <span>View Insights</span>
              <span>→</span>
            </div>
          </div>

          {/* Two-column split: Subscriptions & Upcoming Renewals */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Subscriptions (2 cols) */}
          <div className="lg:col-span-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Active Subscriptions
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Your tracked recurring commitments
                </p>
              </div>
              <button
                onClick={() => onNavigate("Subscriptions")}
                className="text-xs font-semibold text-[var(--accent-text)] hover:underline flex items-center gap-1"
              >
                <span>View all ({subscriptions.length})</span>
                <span>→</span>
              </button>
            </div>

            <div className="divide-y divide-[var(--border-subtle)]">
              {subscriptions.slice(0, 5).map((sub) => (
                <div
                  key={sub.id}
                  className="py-3.5 flex items-center justify-between gap-3"
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
                        {sub.category_name} • <span className="capitalize">{sub.billing_interval}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                      {currencySymbol}{sub.monthly_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      <span className="text-xs font-normal text-[var(--text-muted)]">/mo</span>
                    </p>
                    <span className="text-[10px] font-semibold text-[var(--accent-text)] bg-[var(--accent-subtle)] px-2 py-0.5 rounded-full capitalize">
                      {sub.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Renewals Panel (1 col) */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Upcoming Renewals
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Next scheduled billing dates
                </p>
              </div>
              <button
                onClick={() => onNavigate("Renewals")}
                className="text-xs font-semibold text-[var(--accent-text)] hover:underline flex items-center gap-1"
              >
                <span>Timeline</span>
                <span>→</span>
              </button>
            </div>

            {summary?.upcoming_renewals?.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-8 text-center">
                No upcoming renewals scheduled in the near future.
              </p>
            ) : (
              <div className="space-y-3">
                {summary?.upcoming_renewals?.slice(0, 4).map((r) => {
                  const isUrgent = r.days_until <= 3;
                  return (
                    <div
                      key={r.id}
                      className={`p-3.5 rounded-xl border transition ${
                        isUrgent
                          ? "border-red-500/30 bg-red-500/5"
                          : "border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          {r.name}
                        </span>
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {currencySymbol}{r.monthly_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-[11px]">
                        <span className="text-[var(--text-muted)]">
                          {r.next_billing_date}
                        </span>
                        <span
                          className={`font-semibold ${
                            isUrgent ? "text-red-500" : "text-[var(--accent-primary)]"
                          }`}
                        >
                          {r.days_until === 0
                            ? "Due Today"
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
      </div>
      )}
    </div>
  );
}

export default OverviewView;
