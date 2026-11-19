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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4 bg-[var(--bg-surface-secondary)]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-primary)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {isEditing ? "Edit Subscription" : "Add Subscription"}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {isEditing
                  ? "Update recurring commitment details"
                  : "Track a new recurring software or service"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 flex-1">
          {error && (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs font-medium text-red-500">
              {error}
            </div>
          )}

          <form id="subscription-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Subscription Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Netflix, ChatGPT Plus, AWS..."
                required
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition"
              />
            </div>

            {/* Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Category
                </label>
                <select
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  <option value="Custom...">Custom...</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="trial">Free Trial</option>
                  <option value="paused">Paused</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {categoryName === "Custom..." && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Custom Category Name
                </label>
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="e.g. AI Tools, Home Security"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition"
                />
              </div>
            )}

            {/* Amount, Currency, Interval */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition cursor-pointer"
                >
                  <option value="INR">₹ INR</option>
                  <option value="USD">$ USD</option>
                  <option value="EUR">€ EUR</option>
                  <option value="GBP">£ GBP</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Interval
                </label>
                <select
                  value={billingInterval}
                  onChange={(e) => setBillingInterval(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition cursor-pointer"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="half_yearly">Half-Yearly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>

            {/* Dates: Start Date & Next Billing Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Next Renewal Date
                </label>
                <input
                  type="date"
                  value={nextBillingDate}
                  onChange={(e) => setNextBillingDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition"
                />
              </div>
            </div>

            {/* Usage Score Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Self-Reported Usage Level
                </label>
                <span className="text-xs font-bold text-[var(--accent-text)]">
                  {usageScore}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={usageScore}
                onChange={(e) => setUsageScore(e.target.value)}
                className="w-full accent-[var(--accent-primary)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
                <span>0% (Rarely)</span>
                <span>50% (Moderate)</span>
                <span>100% (Daily)</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Notes & Reminders
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Account tier, family plan notes, cancellation reminders..."
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition"
              />
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] px-6 py-4 bg-[var(--bg-surface-secondary)]">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="subscription-form"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-5 py-2 text-xs font-semibold transition shadow-xs disabled:opacity-60"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Saving...</span>
              </>
            ) : (
              <span>{isEditing ? "Save Changes" : "Create Subscription"}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubscriptionModal;
