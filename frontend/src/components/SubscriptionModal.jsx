import { useState, useEffect } from "react";
import api from "../services/api";

function SubscriptionModal({ isOpen, onClose, onSaved, subscription = null }) {
  const isEditing = Boolean(subscription);

  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [billingInterval, setBillingInterval] = useState("monthly");
  const [status, setStatus] = useState("active");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [nextBillingDate, setNextBillingDate] = useState("");
  const [usageScore, setUsageScore] = useState(70);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch standard categories
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await api.getCategories();
        setCategories(res.categories || []);
      } catch {
        // Fallback standard categories if offline
        setCategories([
          { name: "Streaming & Entertainment" },
          { name: "Software & SaaS" },
          { name: "AI & Machine Learning" },
          { name: "Developer & Cloud" },
          { name: "Finance & Business" },
          { name: "Health & Fitness" },
          { name: "Utilities & Other" },
        ]);
      }
    }
    fetchCategories();
  }, []);

  // Populate form when editing or opening
  useEffect(() => {
    if (subscription) {
      setName(subscription.name || subscription.custom_name || "");
      setCategoryName(subscription.category_name || "Software & SaaS");
      setAmount(subscription.amount || "");
      setCurrency(subscription.currency || "INR");
      setBillingInterval(subscription.billing_interval || "monthly");
      setStatus(subscription.status || "active");
      setStartDate(subscription.start_date || new Date().toISOString().split("T")[0]);
      setNextBillingDate(subscription.next_billing_date || "");
      setUsageScore(subscription.usage_score !== null && subscription.usage_score !== undefined ? subscription.usage_score : 70);
      setNotes(subscription.notes || "");
    } else {
      setName("");
      setCategoryName("Streaming & Entertainment");
      setCustomCategory("");
      setAmount("");
      setCurrency("INR");
      setBillingInterval("monthly");
      setStatus("active");
      const today = new Date().toISOString().split("T")[0];
      setStartDate(today);
      // Auto default next billing to 1 month out
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setNextBillingDate(nextMonth.toISOString().split("T")[0]);
      setUsageScore(70);
      setNotes("");
    }
    setError("");
  }, [subscription, isOpen]);

  // Automatically update next billing date when interval or start date changes (if adding)
  useEffect(() => {
    if (!isEditing && startDate) {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) {
        if (billingInterval === "weekly") d.setDate(d.getDate() + 7);
        else if (billingInterval === "monthly") d.setMonth(d.getMonth() + 1);
        else if (billingInterval === "quarterly") d.setMonth(d.getMonth() + 3);
        else if (billingInterval === "half_yearly") d.setMonth(d.getMonth() + 6);
        else if (billingInterval === "yearly") d.setFullYear(d.getFullYear() + 1);
        else d.setMonth(d.getMonth() + 1);
        setNextBillingDate(d.toISOString().split("T")[0]);
      }
    }
  }, [billingInterval, startDate, isEditing]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const finalCategory = categoryName === "Custom..." ? customCategory.trim() : categoryName;

      const payload = {
        name: name.trim(),
        amount: parseFloat(amount),
        currency,
        billing_interval: billingInterval,
        category_name: finalCategory || "Utilities & Other",
        status,
        start_date: startDate,
        next_billing_date: nextBillingDate || null,
        usage_score: Number(usageScore),
        notes: notes.trim(),
      };

      if (!payload.name) {
        throw new Error("Please enter a subscription name.");
      }
      if (isNaN(payload.amount) || payload.amount < 0) {
        throw new Error("Please enter a valid positive amount.");
      }

      if (isEditing) {
        await api.updateSubscription(subscription.id, payload);
      } else {
        await api.createSubscription(payload);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save subscription.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#E8EEEB] overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E8EEEB] px-6 py-5 bg-[#FAFBFB]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8F5F0] text-[#087F65] text-lg font-bold">
              {isEditing ? "✎" : "+"}
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#172B2A]">
                {isEditing ? "Edit Subscription" : "Add New Subscription"}
              </h3>
              <p className="text-xs text-[#82918B]">
                {isEditing ? "Update your subscription details" : "Keep track of renewal and spending"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Subscription Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#718079] mb-1.5">
              Subscription / Provider Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Netflix, Spotify, GitHub Copilot, AWS"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[#E8EEEB] px-3.5 py-2.5 text-sm text-[#172B2A] placeholder-gray-400 focus:border-[#087F65] focus:ring-1 focus:ring-[#087F65] outline-none"
            />
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#718079] mb-1.5">
                Amount *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="649.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-[#E8EEEB] px-3.5 py-2.5 text-sm text-[#172B2A] placeholder-gray-400 focus:border-[#087F65] focus:ring-1 focus:ring-[#087F65] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#718079] mb-1.5">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-xl border border-[#E8EEEB] px-3 py-2.5 text-sm text-[#172B2A] bg-white focus:border-[#087F65] focus:ring-1 focus:ring-[#087F65] outline-none"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          {/* Billing Interval & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#718079] mb-1.5">
                Billing Cycle *
              </label>
              <select
                value={billingInterval}
                onChange={(e) => setBillingInterval(e.target.value)}
                className="w-full rounded-xl border border-[#E8EEEB] px-3.5 py-2.5 text-sm text-[#172B2A] bg-white focus:border-[#087F65] focus:ring-1 focus:ring-[#087F65] outline-none"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="quarterly">Quarterly</option>
                <option value="half_yearly">Half Yearly (6 mo)</option>
                <option value="weekly">Weekly</option>
                <option value="one_time">One-Time</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#718079] mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border border-[#E8EEEB] px-3.5 py-2.5 text-sm text-[#172B2A] bg-white focus:border-[#087F65] focus:ring-1 focus:ring-[#087F65] outline-none"
              >
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#718079] mb-1.5">
              Category
            </label>
            <select
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-full rounded-xl border border-[#E8EEEB] px-3.5 py-2.5 text-sm text-[#172B2A] bg-white focus:border-[#087F65] focus:ring-1 focus:ring-[#087F65] outline-none"
            >
              {categories.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name}
                </option>
              ))}
              <option value="Custom...">+ Add Custom Category...</option>
            </select>
            {categoryName === "Custom..." && (
              <input
                type="text"
                placeholder="Enter custom category name"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-[#E8EEEB] px-3.5 py-2 text-sm text-[#172B2A] focus:border-[#087F65] outline-none"
              />
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#718079] mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-[#E8EEEB] px-3.5 py-2.5 text-sm text-[#172B2A] focus:border-[#087F65] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#718079] mb-1.5">
                Next Renewal Date
              </label>
              <input
                type="date"
                value={nextBillingDate}
                onChange={(e) => setNextBillingDate(e.target.value)}
                className="w-full rounded-xl border border-[#E8EEEB] px-3.5 py-2.5 text-sm text-[#172B2A] focus:border-[#087F65] outline-none"
              />
            </div>
          </div>

          {/* Usage Score Slider */}
          <div className="rounded-xl border border-[#E8EEEB] bg-[#F7FAF8] p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#172B2A]">
                Estimated Usage ({usageScore}%)
              </label>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                usageScore >= 70
                  ? "bg-green-100 text-green-700"
                  : usageScore >= 40
                  ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700"
              }`}>
                {usageScore >= 70 ? "High Usage" : usageScore >= 40 ? "Moderate" : "Low Usage (Risk)"}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={usageScore}
              onChange={(e) => setUsageScore(e.target.value)}
              className="w-full accent-[#087F65] cursor-pointer"
            />
            <p className="mt-1 text-[11px] text-[#82918B]">
              This score powers Subloo's waste detection and renewal warning intelligence.
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#718079] mb-1.5">
              Notes (Optional)
            </label>
            <textarea
              rows="2"
              placeholder="e.g. Shared with roommates, annual discount plan"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-[#E8EEEB] px-3.5 py-2 text-sm text-[#172B2A] placeholder-gray-400 focus:border-[#087F65] outline-none resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8EEEB]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-[#E8EEEB] px-5 py-2.5 text-sm font-semibold text-[#718079] hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[#087F65] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#066A55] transition disabled:opacity-60 shadow-sm"
            >
              {loading ? "Saving..." : isEditing ? "Save Changes" : "Add Subscription"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SubscriptionModal;
