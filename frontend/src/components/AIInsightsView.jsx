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
        return "bg-red-50 text-red-700 border-red-200";
      case "medium":
        return "bg-amber-50 text-amber-800 border-amber-200";
      default:
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
  };

  const getActionBadge = (action) => {
    switch (action) {
      case "cancel":
        return "bg-red-600 text-white";
      case "downgrade":
        return "bg-amber-500 text-white";
      default:
        return "bg-[#087F65] text-white";
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#172B2A]">
              AI Waste Intelligence
            </h1>
            <span className="rounded-full bg-[#E5F4EC] px-2.5 py-0.5 text-xs font-semibold text-[#087F65]">
              Real Data Analytics
            </span>
          </div>
          <p className="text-xs text-[#82918B] mt-1">
            Deterministic waste detection and savings opportunities based strictly on your usage and billing data.
          </p>
        </div>

        <button
          onClick={fetchInsights}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8EEEB] bg-white hover:bg-gray-50 px-4 py-2.5 text-xs font-semibold text-[#718079] transition shrink-0"
        >
          <span>↻</span> Re-Analyze Subscriptions
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-[#E8EEEB]">
          <p className="text-sm font-semibold text-[#087F65]">
            Analyzing subscription data and waste patterns...
          </p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-600 text-sm">
          {error}
        </div>
      ) : !data || data.recommendations.length === 0 ? (
        <div className="rounded-2xl border border-[#E8EEEB] bg-white p-10 text-center shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E8F5F0] text-3xl text-[#087F65] mb-4">
            ✧
          </div>
          <h3 className="text-lg font-bold text-[#172B2A]">
            No subscriptions to analyze
          </h3>
          <p className="mt-2 text-sm text-[#82918B] max-w-md mx-auto">
            Add your active subscriptions and record how frequently you use them to reveal personalized cost-cutting recommendations.
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
          {/* Potential Savings Banner */}
          <div className="rounded-2xl border border-[#087F65]/20 bg-gradient-to-br from-[#E8F5F0] to-[#FAFDFC] p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 text-[#087F65]">
                  <span className="text-lg">✧</span>
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Total Potential Savings Identified
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-3xl md:text-4xl font-extrabold text-[#172B2A]">
                    ₹{data.total_potential_yearly_savings.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-sm font-medium text-[#718079]">
                    / year (≈ ₹{data.total_potential_monthly_savings.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}/mo)
                  </span>
                </div>
                <p className="mt-2 text-xs text-[#718079] max-w-lg leading-relaxed">
                  Based on {data.waste_count} underutilized or overpaying subscription{data.waste_count === 1 ? "" : "s"} detected across your workspace.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-white px-4 py-3 border border-[#E8EEEB] text-center shadow-2xs">
                  <span className="block text-xl font-bold text-red-600">
                    {data.waste_count}
                  </span>
                  <span className="text-[10px] uppercase font-semibold text-[#82918B]">
                    Waste Alerts
                  </span>
                </span>
                <span className="rounded-xl bg-white px-4 py-3 border border-[#E8EEEB] text-center shadow-2xs">
                  <span className="block text-xl font-bold text-[#087F65]">
                    {data.recommendations.length - data.waste_count}
                  </span>
                  <span className="text-[10px] uppercase font-semibold text-[#82918B]">
                    Healthy Value
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Recommendations List */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-[#172B2A]">
              Subscription Assessment Breakdown
            </h3>

            <div className="grid gap-4">
              {data.recommendations.map((rec) => {
                const isHigh = rec.risk_level === "high";
                const isMedium = rec.risk_level === "medium";

                return (
                  <div
                    key={rec.id}
                    className={`rounded-2xl border p-6 bg-white transition ${
                      isHigh
                        ? "border-red-200 hover:border-red-400"
                        : isMedium
                        ? "border-amber-200 hover:border-amber-400"
                        : "border-[#E8EEEB] hover:border-[#087F65]/40"
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Subscription info & recommendation */}
                      <div className="space-y-2 max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h4 className="text-base font-bold text-[#172B2A]">
                            {rec.subscription_name}
                          </h4>
                          <span
                            className={`border text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full ${getRiskBadge(
                              rec.risk_level
                            )}`}
                          >
                            {rec.risk_level} Risk Waste
                          </span>
                          <span
                            className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full capitalize ${getActionBadge(
                              rec.predicted_action
                            )}`}
                          >
                            Recommended: {rec.predicted_action}
                          </span>
                        </div>

                        <p className="text-xs text-[#718079] leading-relaxed">
                          {rec.ai_explanation}
                        </p>

                        {/* Alternative option card if downgrade / alternative available */}
                        {rec.alternative_provider && (
                          <div className="mt-3 rounded-xl border border-[#E8EEEB] bg-[#F7FAF8] p-3 text-xs">
                            <span className="font-semibold text-[#087F65]">
                              Suggested Alternative:{" "}
                            </span>
                            <span className="text-[#172B2A] font-bold">
                              {rec.alternative_provider}
                            </span>
                            <span className="text-[#718079]">
                              {" "}
                              — {rec.alternative_plan}
                            </span>
                            {rec.alternative_monthly_cost !== null && (
                              <span className="font-semibold text-emerald-700 ml-2">
                                (Save ₹{rec.estimated_monthly_savings}/mo)
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: Metrics & Actions */}
                      <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-4 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-[#F4F7F5]">
                        <div className="text-left lg:text-right">
                          <p className="text-xs text-[#82918B]">
                            Potential Savings
                          </p>
                          <p className="text-lg font-extrabold text-emerald-700">
                            {rec.estimated_yearly_savings > 0
                              ? `+₹${rec.estimated_yearly_savings.toLocaleString()}/yr`
                              : "Optimal Value"}
                          </p>
                          <p className="text-[11px] text-[#82918B]">
                            Waste Score: {rec.waste_score}%
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              onCheckInClick({
                                id: rec.subscription_id,
                                name: rec.subscription_name,
                                usage_score: 100 - rec.waste_score,
                              })
                            }
                            className="px-3 py-1.5 rounded-lg border border-[#E8EEEB] text-xs font-semibold text-[#718079] hover:bg-gray-50 transition"
                          >
                            Update Usage
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AIInsightsView;
