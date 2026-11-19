import { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";

function SettingsView({ user, onProfileUpdated }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [fullName, setFullName] = useState(user?.full_name || "");
  const [currency, setCurrency] = useState(user?.profile?.currency || "INR");
  const [monthlyBudget, setMonthlyBudget] = useState(
    user?.profile?.monthly_budget !== null && user?.profile?.monthly_budget !== undefined
      ? String(user?.profile?.monthly_budget)
      : ""
  );

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saveError, setSaveError] = useState("");

  // Load existing profile from backend on mount
  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      setFetching(true);
      try {
        const res = await api.getProfile();
        if (isMounted && res.profile) {
          setFullName(res.profile.full_name || user?.full_name || "");
          setCurrency(res.profile.currency || "INR");
          setMonthlyBudget(
            res.profile.monthly_budget !== null && res.profile.monthly_budget !== undefined
              ? String(res.profile.monthly_budget)
              : ""
          );
        }
      } catch (err) {
        console.error("Could not fetch profile settings:", err);
      } finally {
        if (isMounted) setFetching(false);
      }
    }
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError("");
    setSaveSuccess("");
    setLoading(true);

    try {
      const budgetNum = monthlyBudget.trim() === "" ? null : parseFloat(monthlyBudget);
      if (budgetNum !== null && (isNaN(budgetNum) || budgetNum < 0)) {
        throw new Error("Please enter a valid non-negative monthly budget.");
      }

      const res = await api.updateProfile({
        full_name: fullName.trim(),
        currency,
        monthly_budget: budgetNum,
      });

      setSaveSuccess("Settings and profile updated successfully!");
      if (onProfileUpdated && res.user) {
        onProfileUpdated(res.user);
      }
      setTimeout(() => setSaveSuccess(""), 4000);
    } catch (err) {
      setSaveError(err.message || "Failed to save settings.");
    } finally {
      setLoading(false);
    }
  };

  const currencySymbols = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Settings & Preferences
          </h1>
          <span className="rounded-full bg-[var(--accent-subtle)] text-[var(--accent-text)] border border-[var(--accent-border)] px-2.5 py-0.5 text-xs font-semibold">
            Workspace
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Customize your appearance theme, account details, and monthly financial budget.
        </p>
      </div>

      {saveSuccess && (
        <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-subtle)] p-4 text-sm font-medium text-[var(--accent-text)] flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4 text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{saveError}</span>
        </div>
      )}

      {/* SECTION 1: APPEARANCE & THEME */}
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xs">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Appearance & Theme
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Choose how Subloo looks to you. Active mode: <strong className="capitalize text-[var(--text-secondary)]">{resolvedTheme}</strong>
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)]">
            Persisted locally
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Light Theme Option */}
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`group text-left p-4 rounded-xl border transition flex flex-col justify-between ${
              theme === "light"
                ? "border-[var(--accent-primary)] bg-[var(--accent-subtle)] shadow-xs"
                : "border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] hover:border-[var(--border-strong)]"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              {theme === "light" && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-primary)] text-white text-xs">
                  ✓
                </span>
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">Light Mode</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Warm, minimal off-white canvas with emerald accents.</p>
            </div>
          </button>

          {/* Dark Theme Option */}
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`group text-left p-4 rounded-xl border transition flex flex-col justify-between ${
              theme === "dark"
                ? "border-[var(--accent-primary)] bg-[var(--accent-subtle)] shadow-xs"
                : "border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] hover:border-[var(--border-strong)]"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </div>
              {theme === "dark" && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-primary)] text-white text-xs">
                  ✓
                </span>
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">Dark Mode</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Deep obsidian navy surfaces engineered for low-light focus.</p>
            </div>
          </button>

          {/* System Default Option */}
          <button
            type="button"
            onClick={() => setTheme("system")}
            className={`group text-left p-4 rounded-xl border transition flex flex-col justify-between ${
              theme === "system"
                ? "border-[var(--accent-primary)] bg-[var(--accent-subtle)] shadow-xs"
                : "border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] hover:border-[var(--border-strong)]"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-[var(--accent-primary)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              {theme === "system" && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-primary)] text-white text-xs">
                  ✓
                </span>
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">System Default</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Syncs automatically with your operating system color scheme.</p>
            </div>
          </button>
        </div>
      </section>

      {/* FORM: PROFILE & BUDGET */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 2: PROFILE DETAILS */}
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xs">
          <h2 className="text-base font-bold text-[var(--text-primary)] mb-1">
            Account Profile
          </h2>
          <p className="text-xs text-[var(--text-muted)] mb-5">
            Your personal user identity across the Subloo subscription platform.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Anshul Bhise"
                maxLength={120}
                required
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-3.5 py-2.5 text-sm text-[var(--text-secondary)] cursor-not-allowed opacity-80"
                />
                <span className="absolute right-3 top-2.5 text-[11px] font-semibold text-[var(--accent-text)] bg-[var(--accent-subtle)] px-2 py-0.5 rounded-full">
                  Verified
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                Account email is strictly tied to your authenticated workspace.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 3: BUDGET & CURRENCY */}
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xs">
          <h2 className="text-base font-bold text-[var(--text-primary)] mb-1">
            Budget & Financial Currency
          </h2>
          <p className="text-xs text-[var(--text-muted)] mb-5">
            Set your target monthly recurring spending ceiling and display currency.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Currency Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Preferred Currency
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { code: "INR", label: "₹ INR" },
                  { code: "USD", label: "$ USD" },
                  { code: "EUR", label: "€ EUR" },
                  { code: "GBP", label: "£ GBP" },
                ].map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setCurrency(c.code)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition ${
                      currency === c.code
                        ? "border-[var(--accent-primary)] bg-[var(--accent-subtle)] text-[var(--accent-text)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                All multi-currency subscriptions will normalize into this target currency.
              </p>
            </div>

            {/* Monthly Budget */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Monthly Spending Budget
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm font-bold text-[var(--text-muted)]">
                  {currencySymbols[currency] || "₹"}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  placeholder="e.g. 5000.00"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] pl-8 pr-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition"
                />
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                Powers the budget progress bar and monthly burn gauge on your Overview dashboard.
              </p>
            </div>
          </div>
        </section>

        {/* Action bar */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-[var(--text-muted)]">
            Changes take effect immediately across all workspace views.
          </p>

          <button
            type="submit"
            disabled={loading || fetching}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-6 py-2.5 text-sm font-semibold transition shadow-xs disabled:opacity-60"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Settings</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default SettingsView;
