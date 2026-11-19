import { useState, useEffect } from "react";
import api from "../services/api";

  function calculateNextBilling(startStr, interval) {
    const d = new Date(startStr);
    if (isNaN(d.getTime())) return "";
    if (interval === "weekly") d.setDate(d.getDate() + 7);
    else if (interval === "monthly") d.setMonth(d.getMonth() + 1);
    else if (interval === "quarterly") d.setMonth(d.getMonth() + 3);
    else if (interval === "half_yearly") d.setMonth(d.getMonth() + 6);
    else if (interval === "yearly") d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  }

  function SubscriptionModalDialog({ onClose, onSaved, subscription }) {
    const isEditing = Boolean(subscription);

    const [categories, setCategories] = useState([
      { name: "Streaming & Entertainment" },
      { name: "Software & SaaS" },
      { name: "AI & Machine Learning" },
      { name: "Developer & Cloud" },
      { name: "Finance & Business" },
      { name: "Health & Fitness" },
      { name: "Utilities & Other" },
    ]);

    const [name, setName] = useState(subscription?.name || subscription?.custom_name || "");
    const [categoryName, setCategoryName] = useState(
      subscription?.category_name || "Streaming & Entertainment"
    );
    const [customCategory, setCustomCategory] = useState("");
    const [amount, setAmount] = useState(
      subscription?.amount !== null && subscription?.amount !== undefined
        ? String(subscription.amount)
        : ""
    );
    const [currency, setCurrency] = useState(subscription?.currency || "INR");
    const [billingInterval, setBillingInterval] = useState(
      subscription?.billing_interval || "monthly"
    );
    const [status, setStatus] = useState(subscription?.status || "active");
    const [startDate, setStartDate] = useState(
      subscription?.start_date || new Date().toISOString().split("T")[0]
    );
    const [nextBillingDate, setNextBillingDate] = useState(() => {
      if (subscription?.next_billing_date) return subscription.next_billing_date;
      const todayStr = new Date().toISOString().split("T")[0];
      return calculateNextBilling(todayStr, subscription?.billing_interval || "monthly");
    });
    const [usageScore, setUsageScore] = useState(
      subscription?.usage_score !== null && subscription?.usage_score !== undefined
        ? subscription.usage_score
        : 70
    );
    const [notes, setNotes] = useState(subscription?.notes || "");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
      let ignore = false;
      api.getCategories()
        .then((res) => {
          if (!ignore && res.categories?.length > 0) {
            setCategories(res.categories);
          }
        })
        .catch(() => { });
      return () => {
        ignore = true;
      };
    }, []);

        const handleStartDateChange = (val) => {
          setStartDate(val);
          if (!isEditing && val) {
            setNextBillingDate(calculateNextBilling(val, billingInterval));
          }
  };

    const handleIntervalChange = (val) => {
      setBillingInterval(val);
      if (!isEditing && startDate) {
        setNextBillingDate(calculateNextBilling(startDate, val));
      }
};

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
      usage_score: parseInt(usageScore, 10),
      notes: notes.trim() || null,
    };

    if (!payload.name) {
      throw new Error("Subscription name is required.");
    }
      if (isNaN(payload.amount) || payload.amount <= 0) {
        throw new Error("Please enter a valid amount greater than 0.");
      }

      let res;
      if (isEditing) {
        res = await api.updateSubscription(subscription.id, payload);
      } else {
        res = await api.createSubscription(payload);
      }

      onSaved(res.subscription || payload);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save subscription.");
    } finally {
      setLoading(false);
    }
  };

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)]">
                      {isEditing ? "Edit Subscription" : "Add Subscription"}
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {isEditing
                        ? "Update pricing, billing cycles, or usage checks."
                        : "Track a recurring service to monitor renewal dates & intelligence."}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-secondary)] hover:text-[var(--text-primary)] transition"
                  >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                  </button>
                </div>

                {/* Modal Body */}
                  <div className="overflow-y-auto px-6 py-5 flex-1 space-y-4">
                    {error && (
                        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3.5 py-2.5 text-xs text-red-500 font-medium">
                          {error}
                        </div>
          )}

                        <form id="subscription-form" onSubmit={handleSubmit} className="space-y-4">
                          {/* Service Name */}
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                              Service / Subscription Name *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Netflix, Spotify, GitHub, ChatGPT"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition"
                            />
                          </div>

                            {/* Amount, Currency & Interval */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                                  Amount *
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  required
                                  placeholder="0.00"
                                  value={amount}
                                  onChange={(e) => setAmount(e.target.value)}
                                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                                  Currency
                                </label>
                                <select
                                  value={currency}
                                  onChange={(e) => setCurrency(e.target.value)}
                                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition"
                                >
                                  <option value="INR">INR (₹)</option>
                                  <option value="USD">USD ($)</option>
                                  <option value="EUR">EUR (€)</option>
                                  <option value="GBP">GBP (£)</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                                  Billing Cycle
                                </label>
                                <select
                                  value={billingInterval}
                                  onChange={(e) => handleIntervalChange(e.target.value)}
                                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition"
                                >
                                  <option value="monthly">Monthly</option>
                                  <option value="yearly">Yearly</option>
                                  <option value="quarterly">Quarterly</option>
                                  <option value="half_yearly">Half-Yearly</option>
                                  <option value="weekly">Weekly</option>
                                </select>
                              </div>
                            </div>

                            {/* Category */}
                            <div>
                              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                                Category
                              </label>
                              <select
                                value={categoryName}
                                onChange={(e) => setCategoryName(e.target.value)}
                                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition"
                              >
                                {categories.map((c) => (
                                  <option key={c.name} value={c.name}>
                                    {c.name}
                                  </option>
                                ))}
                                <option value="Custom...">+ Add custom category...</option>
                              </select>

                              {categoryName === "Custom..." && (
                                <input
                                  type="text"
                                  placeholder="Enter custom category name"
                                  value={customCategory}
                                  onChange={(e) => setCustomCategory(e.target.value)}
                                  className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] outline-none transition"
                                />
                              )}
                            </div>

                            {/* Billing Dates */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                                  Start Date
                                </label>
                                <input
                                  type="date"
                                  value={startDate}
                                  onChange={(e) => handleStartDateChange(e.target.value)}
                                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none transition"
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
                                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none transition"
                                />
                              </div>
                            </div>

                                  {/* Status & Usage Score */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                                        Status
                                      </label>
                                      <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none transition"
                                      >
                                        <option value="active">Active (Renewing)</option>
                                        <option value="paused">Paused</option>
                                        <option value="cancelled">Cancelled</option>
                                      </select>
                                    </div>

                                      <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                                            Usage Confidence: {usageScore}%
                                          </label>
                                          <span
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${usageScore >= 70
                                                ? "bg-emerald-500/10 text-emerald-500"
                                                : usageScore >= 40
                                                  ? "bg-amber-500/10 text-amber-500"
                                                  : "bg-red-500/10 text-red-500"
                                              }`}
                                          >
                                            {usageScore >= 70 ? "High Value" : usageScore >= 40 ? "Moderate" : "Waste Risk"}
                                          </span>
                                        </div>
                                        <input
                                          type="range"
                                          min="0"
                                          max="100"
                                          value={usageScore}
                                          onChange={(e) => setUsageScore(e.target.value)}
                                          className="w-full accent-[var(--accent-primary)] cursor-pointer mt-1"
                                        />
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
                                  className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  form="subscription-form"
                                  disabled={loading}
                                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-5 py-2 text-xs font-semibold transition shadow-xs disabled:opacity-60 cursor-pointer"
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

                          export default function SubscriptionModal({isOpen, onClose, onSaved, subscription = null}) {
  if (!isOpen) return null;
                          return (
                          <SubscriptionModalDialog
                            key={subscription ? `edit-${subscription.id}` : "new-sub"}
                            onClose={onClose}
                            onSaved={onSaved}
                            subscription={subscription}
                          />
                          );
}
