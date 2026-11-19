import { useState, useMemo } from "react";

function SubscriptionsView({
  subscriptions,
  loading,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onCheckInClick,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      const matchesSearch =
        (sub.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sub.category_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sub.notes || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ? true : sub.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [subscriptions, searchTerm, statusFilter]);

  const getStatusBadge = (status) => {
    switch (status) {
      case "active":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "trial":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "paused":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "cancelled":
        return "bg-gray-100 text-gray-600 border-gray-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
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
    if (days === null || days === undefined) return "text-[#82918B]";
    if (days <= 3) return "text-red-600 font-semibold";
    if (days <= 7) return "text-amber-600 font-medium";
    return "text-[#718079]";
  };

  return (
    <div className="space-y-6">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#172B2A]">
              My Subscriptions
            </h1>
            <span className="rounded-full bg-[#E5F4EC] px-2.5 py-0.5 text-xs font-semibold text-[#087F65]">
              {subscriptions.length} Total
            </span>
          </div>
          <p className="text-xs text-[#82918B] mt-1">
            Manage your recurring services, tracking renewal dates and usage.
          </p>
        </div>

        <button
          onClick={onAddClick}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#087F65] hover:bg-[#066A55] text-white px-5 py-2.5 text-sm font-semibold transition shadow-sm shrink-0"
        >
          <span className="text-base font-bold">+</span>
          Add Subscription
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#E8EEEB]">
        {/* Search */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search subscriptions, categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-[#E8EEEB] bg-[#F7F9F8] px-3.5 py-2 text-sm text-[#172B2A] placeholder-gray-400 focus:border-[#087F65] focus:bg-white outline-none transition"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
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
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition shrink-0 ${
                statusFilter === pill.id
                  ? "bg-[#087F65] text-white"
                  : "bg-gray-100 text-[#718079] hover:bg-gray-200"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-2xl border border-[#E8EEEB]">
          <p className="text-sm font-medium text-[#087F65]">
            Loading subscriptions...
          </p>
        </div>
      ) : subscriptions.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-[#E8EEEB] bg-white p-10 text-center shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E8F5F0] text-3xl text-[#087F65] mb-4">
            ▤
          </div>
          <h3 className="text-lg font-bold text-[#172B2A]">
            No subscriptions added yet
          </h3>
          <p className="mt-2 text-sm text-[#82918B] max-w-md mx-auto">
            Start tracking your streaming services, cloud software, gym memberships and subscriptions in one organized place.
          </p>
          <button
            onClick={onAddClick}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#087F65] hover:bg-[#066A55] text-white px-5 py-2.5 text-sm font-semibold transition shadow-sm"
          >
            + Add Your First Subscription
          </button>
        </div>
      ) : filteredSubscriptions.length === 0 ? (
        <div className="rounded-2xl border border-[#E8EEEB] bg-white p-8 text-center text-sm text-[#82918B]">
          No subscriptions found matching your search.
        </div>
      ) : (
        /* Subscriptions List */
        <div className="grid gap-3.5">
          {filteredSubscriptions.map((sub) => {
            const usage = sub.usage_score !== null && sub.usage_score !== undefined ? sub.usage_score : null;
            return (
              <div
                key={sub.id}
                className="group flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-[#E8EEEB] bg-white p-5 hover:border-[#087F65]/40 hover:shadow-xs transition"
              >
                {/* Left: Info */}
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E8F5F0] text-xl font-bold text-[#087F65]">
                    {sub.name ? sub.name[0].toUpperCase() : "S"}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-[#172B2A]">
                        {sub.name}
                      </h3>
                      <span
                        className={`border text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${getStatusBadge(
                          sub.status
                        )}`}
                      >
                        {sub.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-[#82918B]">
                      <span className="rounded-md bg-[#F4F7F5] px-2 py-0.5 font-medium text-[#718079]">
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
                      <p className="mt-1 text-xs text-[#9AA8A1] line-clamp-1">
                        {sub.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Financials + Usage + Actions */}
                <div className="flex flex-wrap items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-[#F4F7F5]">
                  {/* Usage Bar */}
                  <div className="w-28">
                    <div className="flex justify-between items-center text-[10px] text-[#82918B] mb-1">
                      <span>Usage</span>
                      <span className="font-semibold text-[#172B2A]">
                        {usage !== null ? `${usage}%` : "Not set"}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          usage === null
                            ? "bg-gray-200"
                            : usage >= 70
                            ? "bg-[#087F65]"
                            : usage >= 40
                            ? "bg-amber-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${usage || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="text-right min-w-[100px]">
                    <p className="text-base font-bold text-[#172B2A]">
                      {sub.currency === "INR" ? "₹" : sub.currency === "USD" ? "$" : sub.currency}{" "}
                      {sub.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[11px] text-[#82918B]">
                      ≈ ₹{sub.monthly_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })} / mo
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onCheckInClick(sub)}
                      title="Quick Usage Check-In"
                      className="px-2.5 py-1.5 rounded-lg border border-[#E8EEEB] text-xs font-medium text-[#718079] hover:border-[#087F65] hover:text-[#087F65] hover:bg-[#E8F5F0] transition"
                    >
                      Check-in
                    </button>
                    <button
                      onClick={() => onEditClick(sub)}
                      title="Edit Subscription"
                      className="px-2.5 py-1.5 rounded-lg border border-[#E8EEEB] text-xs font-medium text-[#718079] hover:bg-gray-50 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteClick(sub)}
                      title="Delete Subscription"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                    >
                      🗑
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
