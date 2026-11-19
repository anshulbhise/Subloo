import { useState, useMemo } from "react";

function SubscriptionsView({
  subscriptions = [],
  loading,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onCheckInClick,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("renewal"); // "renewal" | "cost" | "name"

  const filteredSubscriptions = useMemo(() => {
    let list = subscriptions.filter((sub) => {
      const matchesSearch =
        (sub.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sub.category_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sub.notes || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ? true : sub.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    return list.sort((a, b) => {
      if (sortBy === "cost") {
        return (b.monthly_cost || 0) - (a.monthly_cost || 0);
      }
      if (sortBy === "name") {
        return (a.name || "").localeCompare(b.name || "");
      }
      // default: renewal date / days_until_renewal
      const daysA = a.days_until_renewal ?? 9999;
      const daysB = b.days_until_renewal ?? 9999;
      return daysA - daysB;
    });
  }, [subscriptions, searchTerm, statusFilter, sortBy]);

  const getStatusBadge = (status) => {
    switch (status) {
      case "active":
        return "bg-emerald-500/10 text-[var(--accent-text)] border border-[var(--accent-border)]";
      case "trial":
        return "bg-blue-500/10 text-blue-500 border border-blue-500/20";
      case "paused":
        return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
      case "cancelled":
        return "bg-gray-500/10 text-[var(--text-muted)] border border-gray-500/20";
      default:
        return "bg-gray-500/10 text-[var(--text-secondary)] border border-gray-500/20";
    }
  };

  const formatRenewalText = (days, dateStr) => {
    if (!dateStr) return "No renewal date";
    if (days === null || days === undefined) return dateStr;
    if (days < 0) return `Overdue (${Math.abs(days)}d ago)`;
    if (days === 0) return "Renews today!";
    if (days === 1) return "Renews tomorrow";
    if (days <= 7) return `Renews in ${days} days`;
    return `Renews on ${dateStr}`;
  };

  const getRenewalBadgeColor = (days) => {
    if (days === null || days === undefined) return "text-[var(--text-muted)]";
    if (days <= 3) return "text-red-500 font-semibold";
    if (days <= 7) return "text-amber-500 font-medium";
    return "text-[var(--text-muted)]";
  };

  const getCurrencySymbol = (curr) => {
    if (curr === "USD") return "$";
    if (curr === "EUR") return "€";
    if (curr === "GBP") return "£";
    return "₹";
  };

  return (
    <div className="space-y-6">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              My Subscriptions
            </h1>
            <span className="rounded-full bg-[var(--accent-subtle)] text-[var(--accent-text)] border border-[var(--accent-border)] px-2.5 py-0.5 text-xs font-semibold">
              {subscriptions.length} Tracked
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Manage your recurring services, track renewal deadlines, and check in on usage.
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
      </div>

      {/* Filters, Search & Sorting */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[var(--bg-surface)] p-3.5 rounded-2xl border border-[var(--border-subtle)] shadow-xs">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="w-4 h-4 absolute left-3.5 top-3 text-[var(--text-muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search subscriptions, categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] pl-10 pr-3.5 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: "all", label: "All" },
            { id: "active", label: "Active" },
            { id: "trial", label: "Trial" },
            { id: "paused", label: "Paused" },
            { id: "cancelled", label: "Cancelled" },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setStatusFilter(pill.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition shrink-0 ${
                statusFilter === pill.id
                  ? "bg-[var(--accent-primary)] text-white"
                  : "bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 md:border-l border-[var(--border-subtle)] pt-2 md:pt-0 md:pl-3">
          <span className="text-xs text-[var(--text-muted)]">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] cursor-pointer"
          >
            <option value="renewal">Next Renewal</option>
            <option value="cost">Highest Cost</option>
            <option value="name">Alphabetical</option>
          </select>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-20 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
          <p className="text-sm font-medium text-[var(--accent-text)]">
            Loading subscriptions...
          </p>
        </div>
      ) : subscriptions.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 text-center shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent-primary)] mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">
            No subscriptions added yet
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-[var(--text-muted)] max-w-md mx-auto">
            Track your streaming services, cloud software, hosting and subscriptions in one organized place.
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
      ) : filteredSubscriptions.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-12 text-center text-sm text-[var(--text-muted)]">
          No subscriptions found matching your search and filter criteria.
        </div>
      ) : (
        /* Subscriptions List */
        <div className="grid gap-3.5">
          {filteredSubscriptions.map((sub) => {
            const usage = sub.usage_score !== null && sub.usage_score !== undefined ? sub.usage_score : null;
            const currencySymbol = getCurrencySymbol(sub.currency);

            return (
              <div
                key={sub.id}
                className="group flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 hover:border-[var(--accent-primary)]/40 hover:shadow-xs transition"
              >
                {/* Left: Info */}
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-lg font-bold text-[var(--accent-primary)]">
                    {sub.name ? sub.name[0].toUpperCase() : "S"}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-[var(--text-primary)]">
                        {sub.name}
                      </h3>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${getStatusBadge(
                          sub.status
                        )}`}
                      >
                        {sub.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5 text-xs text-[var(--text-muted)]">
                      <span className="rounded-md bg-[var(--bg-surface-secondary)] px-2 py-0.5 font-medium text-[var(--text-secondary)]">
                        {sub.category_name}
                      </span>
                      <span>•</span>
                      <span className="capitalize">{sub.billing_interval}</span>
                      <span>•</span>
                      <span className={getRenewalBadgeColor(sub.days_until_renewal)}>
                        {formatRenewalText(sub.days_until_renewal, sub.next_billing_date)}
                      </span>
                    </div>

                    {sub.notes && (
                      <p className="mt-1.5 text-xs text-[var(--text-muted)] line-clamp-1">
                        {sub.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Financials + Usage + Actions */}
                <div className="flex flex-wrap items-center justify-between md:justify-end gap-5 pt-3 md:pt-0 border-t md:border-t-0 border-[var(--border-subtle)]">
                  {/* Usage Bar */}
                  <div className="w-24 sm:w-28">
                    <div className="flex justify-between items-center text-[10px] text-[var(--text-muted)] mb-1">
                      <span>Usage</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {usage !== null ? `${usage}%` : "Not set"}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[var(--bg-surface-secondary)] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          usage === null
                            ? "bg-gray-300 dark:bg-gray-700"
                            : usage >= 70
                            ? "bg-[var(--accent-primary)]"
                            : usage >= 40
                            ? "bg-amber-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${usage || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="text-right min-w-[95px]">
                    <p className="text-base font-bold text-[var(--text-primary)]">
                      {currencySymbol}{sub.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      ≈ ₹{sub.monthly_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })} / mo
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onCheckInClick(sub)}
                      title="Quick Usage Check-In"
                      className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-text)] hover:bg-[var(--accent-subtle)] transition"
                    >
                      Check-in
                    </button>
                    <button
                      onClick={() => onEditClick(sub)}
                      title="Edit Subscription"
                      className="p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-secondary)] transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDeleteClick(sub)}
                      title="Delete Subscription"
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SubscriptionsView;
