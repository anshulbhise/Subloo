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

  const renderSection = (title, items, badgeColor, emptyMessage) => (
    <div className="rounded-2xl border border-[#E8EEEB] bg-white p-6 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <h3 className="text-base font-bold text-[#172B2A]">{title}</h3>
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${badgeColor}`}
          >
            {items.length}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-[#82918B] py-3">{emptyMessage}</p>
      ) : (
        <div className="grid gap-3">
          {items.map((sub) => {
            const isUrgent = sub.days_until <= 3;
            return (
              <div
                key={sub.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border transition ${
                  isUrgent
                    ? "border-red-200 bg-red-50/40"
                    : "border-[#E8EEEB] bg-[#FAFBFB] hover:border-[#087F65]/40"
                }`}
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
                      {sub.category_name} •{" "}
                      <span className="capitalize">{sub.billing_interval}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-5">
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-bold text-[#172B2A]">
                      ₹{sub.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[11px] text-[#82918B]">
                      {sub.next_billing_date}
                    </p>
                  </div>

                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${
                      sub.days_until === 0
                        ? "bg-red-100 text-red-700 font-bold animate-pulse"
                        : sub.days_until <= 3
                        ? "bg-red-100 text-red-700"
                        : sub.days_until <= 7
                        ? "bg-amber-100 text-amber-700"
                        : "bg-[#E8F5F0] text-[#087F65]"
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
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-xs transition"
                    title="Edit Subscription"
                  >
                    ✎
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
            <h1 className="text-2xl font-bold tracking-tight text-[#172B2A]">
              Renewals Schedule
            </h1>
            <span className="rounded-full bg-[#E5F4EC] px-2.5 py-0.5 text-xs font-semibold text-[#087F65]">
              {renewalsData?.total_renewals_tracked || 0} Tracked
            </span>
          </div>
          <p className="text-xs text-[#82918B] mt-1">
            Real-time renewal timeline to prevent surprise charges and unwanted auto-renewals.
          </p>
        </div>

        <button
          onClick={onAddClick}
          className="inline-flex items-center gap-2 rounded-xl bg-[#087F65] hover:bg-[#066A55] text-white px-5 py-2.5 text-sm font-semibold transition shadow-sm shrink-0"
        >
          <span>+</span> Add Subscription
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-[#E8EEEB]">
          <p className="text-sm font-semibold text-[#087F65]">
            Loading renewals schedule...
          </p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-600 text-sm">
          {error}
        </div>
      ) : renewalsData?.total_renewals_tracked === 0 ? (
        <div className="rounded-2xl border border-[#E8EEEB] bg-white p-10 text-center shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E8F5F0] text-3xl text-[#087F65] mb-4">
            ◷
          </div>
          <h3 className="text-lg font-bold text-[#172B2A]">
            No renewals scheduled
          </h3>
          <p className="mt-2 text-sm text-[#82918B] max-w-md mx-auto">
            When you add subscriptions with renewal dates, your upcoming billing timeline will automatically display here.
          </p>
          <button
            onClick={onAddClick}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#087F65] hover:bg-[#066A55] text-white px-5 py-2.5 text-sm font-semibold transition shadow-sm"
          >
            + Add a Subscription
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue */}
          {renewalsData?.overdue?.length > 0 &&
            renderSection(
              "Past Due / Overdue",
              renewalsData.overdue,
              "bg-red-100 text-red-700",
              "No overdue subscriptions."
            )}

          {/* Due this week */}
          {renderSection(
            "Due Within 7 Days (Immediate Action)",
            renewalsData?.due_soon || [],
            "bg-amber-100 text-amber-800",
            "No renewal charges expected in the next 7 days."
          )}

          {/* Due in next 2 weeks */}
          {renderSection(
            "Due in 8 to 14 Days",
            renewalsData?.next_two_weeks || [],
            "bg-[#E8F5F0] text-[#087F65]",
            "No renewal charges in this period."
          )}

          {/* Due this month */}
          {renderSection(
            "Due in 15 to 30 Days",
            renewalsData?.this_month || [],
            "bg-gray-100 text-[#718079]",
            "No renewal charges scheduled for later this month."
          )}

          {/* Later */}
          {renewalsData?.future?.length > 0 &&
            renderSection(
              "Future Renewals (> 30 Days)",
              renewalsData.future,
              "bg-gray-100 text-[#718079]",
              "No future renewals."
            )}
        </div>
      )}
    </div>
  );
}

export default RenewalsView;
