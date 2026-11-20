import { useState, useEffect } from "react";
import useTheme from "../context/useTheme";
import api from "../services/api";

function SettingsView({ user, onProfileUpdated }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "gmail") return "gmail";
      if (params.get("tab") === "organizations") return "organizations";
    }
    return "general";
  });

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

  // Gmail states
  const [gmailStatus, setGmailStatus] = useState(null);
  const [gmailSuggestions, setGmailSuggestions] = useState([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailMessage, setGmailMessage] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "gmail") {
        const status = params.get("status");
        const email = params.get("email");
        const msg = params.get("message");
        if (status === "connected") return `Google account connected successfully! (${email || "Gmail"})`;
        if (status === "error") return msg || "Failed to connect Google account.";
      }
    }
    return "";
  });

  // Organization states
  const [organizations, setOrganizations] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgLegal, setNewOrgLegal] = useState("");
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgMessage, setOrgMessage] = useState("");

  // Invite state for selected organization
  const [inviteOrgId, setInviteOrgId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

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

  // Load Gmail status & suggestions
  const loadGmail = async () => {
    try {
      setGmailLoading(true);
      const [statusRes, sugRes] = await Promise.all([
        api.getGmailStatus().catch(() => null),
        api.getGmailSuggestions().catch(() => ({ suggestions: [] })),
      ]);
      setGmailStatus(statusRes);
      setGmailSuggestions(sugRes.suggestions || []);
    } catch (err) {
      console.error("Gmail load error:", err);
    } finally {
      setGmailLoading(false);
    }
  };

  // Load Organizations
  const loadOrgs = async () => {
    try {
      setOrgLoading(true);
      const res = await api.getOrganizations();
      setOrganizations(res.organizations || []);
      setPendingInvites(res.pending_invitations || []);
      if (res.organizations?.length > 0 && !inviteOrgId) {
        setInviteOrgId(res.organizations[0].id);
      }
    } catch (err) {
      console.error("Org load error:", err);
    } finally {
      setOrgLoading(false);
    }
  };

  // Clean OAuth redirect query params from address bar after parsing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "gmail") {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }, []);

  useEffect(() => {
    let ignore = false;
    if (activeTab === "gmail") {
      api.getGmailStatus()
        .then((sRes) => {
          if (!ignore) setGmailStatus(sRes);
          return api.getGmailSuggestions();
        })
        .then((sugRes) => {
          if (!ignore) setGmailSuggestions(sugRes?.suggestions || []);
        })
        .catch((err) => console.error("Gmail load error:", err));
    } else if (activeTab === "organizations") {
      api.getOrganizations()
        .then((res) => {
          if (!ignore) {
            setOrganizations(res?.organizations || []);
            setPendingInvites(res?.pending_invitations || []);
            if (res?.organizations?.length > 0) {
              setInviteOrgId((prev) => prev || res.organizations[0].id);
            }
          }
        })
        .catch((err) => console.error("Org load error:", err));
    }
    return () => {
      ignore = true;
    };
  }, [activeTab]);

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

  // Gmail connect OAuth handler
  const handleConnectGmail = async () => {
    try {
      setGmailLoading(true);
      setGmailMessage("");
      const currentOrigin = window.location.origin;
      const res = await api.getGmailAuthUrl(currentOrigin);
      if (res.auth_url) {
        window.location.href = res.auth_url;
      } else {
        setGmailMessage(res.message || "OAuth is not configured.");
      }
    } catch (err) {
      setGmailMessage(err.message || "Failed to initiate Gmail connection.");
    } finally {
      setGmailLoading(false);
    }
  };

  // Gmail disconnect handler
  const handleDisconnectGmail = async () => {
    if (!window.confirm("Are you sure you want to disconnect your Gmail account?")) return;
    try {
      setGmailLoading(true);
      setGmailMessage("");
      await api.disconnectGmail();
      setGmailMessage("Gmail account disconnected successfully.");
      await loadGmail();
    } catch (err) {
      setGmailMessage(err.message || "Failed to disconnect Gmail.");
    } finally {
      setGmailLoading(false);
    }
  };

  // Gmail sync handler
  const handleSyncGmail = async () => {
    setGmailLoading(true);
    setGmailMessage("");
    try {
      const res = await api.syncGmail();
      setGmailMessage(res.message || "Sync complete!");
      await loadGmail();
    } catch (err) {
      setGmailMessage(err.message || "Sync failed.");
    } finally {
      setGmailLoading(false);
    }
  };

  // Approve detected subscription
  const handleApproveSuggestion = async (id) => {
    try {
      const res = await api.approveGmailSuggestion(id);
      setGmailMessage(res.message || "Subscription approved!");
      setGmailSuggestions((prev) => prev.filter((s) => s.id !== id));
      if (onProfileUpdated) onProfileUpdated();
    } catch (err) {
      setGmailMessage(err.message || "Approval failed.");
    }
  };

  // Reject detected subscription
  const handleRejectSuggestion = async (id) => {
    try {
      await api.rejectGmailSuggestion(id);
      setGmailSuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setGmailMessage(err.message || "Rejection failed.");
    }
  };

  // Clear all pending suggestions
  const handleClearSuggestions = async () => {
    if (!window.confirm("Clear all pending suggestions?")) return;
    try {
      setGmailLoading(true);
      await api.clearGmailSuggestions();
      setGmailSuggestions([]);
      setGmailMessage("Cleared all pending suggestions.");
    } catch (err) {
      setGmailMessage(err.message || "Failed to clear suggestions.");
    } finally {
      setGmailLoading(false);
    }
  };

  // Create organization
  const handleCreateOrg = async (e) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setOrgLoading(true);
    setOrgMessage("");
    try {
      await api.createOrganization({
        name: newOrgName.trim(),
        legal_name: newOrgLegal.trim() || undefined,
      });
      setNewOrgName("");
      setNewOrgLegal("");
      setOrgMessage("Organization created successfully!");
      await loadOrgs();
    } catch (err) {
      setOrgMessage(err.message || "Failed to create organization.");
    } finally {
      setOrgLoading(false);
    }
  };

  // Send member invitation
  const handleInviteMember = async (e) => {
    e.preventDefault();
    if (!inviteOrgId || !inviteEmail.trim()) return;
    setOrgLoading(true);
    setOrgMessage("");
    try {
      const res = await api.inviteOrgMember(inviteOrgId, {
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
      });
      setInviteEmail("");
      setOrgMessage(res.message || "Invitation sent successfully!");
    } catch (err) {
      setOrgMessage(err.message || "Failed to invite member.");
    } finally {
      setOrgLoading(false);
    }
  };

  // Accept invitation
  const handleAcceptInvite = async (invId) => {
    try {
      await api.acceptOrgInvitation(invId);
      setOrgMessage("Invitation accepted! You are now a member.");
      await loadOrgs();
    } catch (err) {
      setOrgMessage(err.message || "Failed to accept invitation.");
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
            Settings & Workspace
          </h1>
          <span className="rounded-full bg-[var(--accent-subtle)] text-[var(--accent-text)] border border-[var(--accent-border)] px-2.5 py-0.5 text-xs font-semibold">
            Preferences
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Configure personal preferences, theme appearance, Gmail email sync, and organizational RBAC.
        </p>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] mt-6">
          <button
            onClick={() => setActiveTab("general")}
            className={`pb-3 px-1 text-xs font-bold transition border-b-2 ${activeTab === "general"
              ? "border-[var(--accent-primary)] text-[var(--accent-text)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
          >
            General & Budget
          </button>
          <button
            onClick={() => setActiveTab("gmail")}
            className={`pb-3 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${activeTab === "gmail"
              ? "border-[var(--accent-primary)] text-[var(--accent-text)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
          >
            <span>Gmail Integration</span>
            {gmailSuggestions.length > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--accent-primary)] px-1 text-[9px] font-bold text-white">
                {gmailSuggestions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("organizations")}
            className={`pb-3 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${activeTab === "organizations"
              ? "border-[var(--accent-primary)] text-[var(--accent-text)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
          >
            <span>Organizations & Teams</span>
            {pendingInvites.length > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
                {pendingInvites.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: GENERAL & BUDGET */}
      {activeTab === "general" && (
        <form onSubmit={handleSave} className="space-y-6">
          {saveSuccess && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 font-medium">
              {saveSuccess}
            </div>
          )}

          {saveError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-500 font-medium">
              {saveError}
            </div>
          )}

          {/* Theme Selector */}
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xs">
            <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">
              Interface Theme
            </h2>
            <p className="text-xs text-[var(--text-muted)] mb-5">
              Choose your visual style. Theme preferences persist across your browser.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: "light",
                  title: "Light Mode",
                  desc: "Warm white minimalist surfaces",
                  icon: (
                    <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ),
                },
                {
                  id: "dark",
                  title: "Dark Mode",
                  desc: "Deep navy background and surfaces",
                  icon: (
                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  ),
                },
                {
                  id: "system",
                  title: "System Preference",
                  desc: `Automatically follows OS (${resolvedTheme})`,
                  icon: (
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  ),
                },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setTheme(opt.id)}
                  className={`flex flex-col items-start p-4 rounded-xl border text-left transition ${theme === opt.id
                    ? "border-[var(--accent-primary)] bg-[var(--accent-subtle)] text-[var(--accent-text)] ring-1 ring-[var(--accent-primary)] shadow-xs"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                    }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    {opt.icon}
                    {theme === opt.id && (
                      <span className="flex h-2 w-2 rounded-full bg-[var(--accent-primary)]" />
                    )}
                  </div>
                  <span className="text-xs font-bold text-[var(--text-primary)]">{opt.title}</span>
                  <span className="text-[11px] text-[var(--text-muted)] mt-1">{opt.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Account & Profile */}
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">
              Account Profile
            </h2>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)]/50 px-3.5 py-2.5 text-sm text-[var(--text-muted)] cursor-not-allowed outline-none"
              />
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                Primary identifier and session security email.
              </p>
            </div>
          </section>

          {/* Budget & Currency */}
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">
              Currency & Budget Ceiling
            </h2>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                Preferred Currency
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { code: "INR", label: "INR (₹)" },
                  { code: "USD", label: "USD ($)" },
                  { code: "EUR", label: "EUR (€)" },
                  { code: "GBP", label: "GBP (£)" },
                ].map((c) => (
                  <button
                    type="button"
                    key={c.code}
                    onClick={() => setCurrency(c.code)}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-semibold transition ${currency === c.code
                      ? "border-[var(--accent-primary)] bg-[var(--accent-subtle)] text-[var(--accent-text)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
                      }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

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
                Subloo uses this limit to evaluate budget thresholds and trigger proactive warnings.
              </p>
            </div>
          </section>

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={loading || fetching}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-6 py-2.5 text-sm font-semibold transition shadow-xs disabled:opacity-60"
            >
              {loading ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: GMAIL INTEGRATION */}
      {activeTab === "gmail" && (
        <div className="space-y-6">
          {gmailMessage && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-3.5 text-xs text-[var(--text-primary)]">
              {gmailMessage}
            </div>
          )}

          {/* Connection Card */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-500 text-xl font-bold">
                  G
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Gmail Subscription Detector
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {gmailStatus?.is_connected
                      ? `Connected as ${gmailStatus.gmail_address}`
                      : "Scan your billing receipts to automatically discover subscriptions."}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!gmailStatus?.is_connected ? (
                  <button
                    onClick={handleConnectGmail}
                    disabled={gmailLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-xs font-semibold transition shadow-xs disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                    </svg>
                    <span>{gmailLoading ? "Connecting..." : "Connect Google Account"}</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSyncGmail}
                      disabled={gmailLoading}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-4 py-2 text-xs font-semibold transition shadow-xs disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>{gmailLoading ? "Scanning..." : "Scan Receipts Now"}</span>
                    </button>

                    <button
                      onClick={handleDisconnectGmail}
                      disabled={gmailLoading}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 px-3.5 py-2 text-xs font-semibold transition disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  </>
                )}
              </div>
            </div>

            {gmailStatus?.setup_required && (
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-[var(--text-secondary)]">
                <p className="font-semibold text-amber-500 mb-1">OAuth Credentials Setup</p>
                <p className="leading-relaxed">
                  To connect live Google accounts, provide <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in your Render environment variables. You can still test receipts scanning with the built-in detection pattern engine above!
                </p>
              </div>
            )}
          </div>

          {/* Pending Suggestions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Detected Subscription Suggestions ({gmailSuggestions.length})
              </h3>
              {gmailSuggestions.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearSuggestions}
                  disabled={gmailLoading}
                  className="text-xs font-semibold text-red-500 hover:text-red-600 transition cursor-pointer"
                >
                  Clear Suggestions
                </button>
              )}
            </div>

            {gmailSuggestions.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">No pending suggestions</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  Click "Scan Receipts Now" to parse subscriptions from your billing emails.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {gmailSuggestions.map((sug) => (
                  <div
                    key={sug.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-strong)] transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          {sug.detected_provider}
                        </span>
                        <span className="rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-[10px] font-bold">
                          {sug.detected_currency} {sug.detected_amount.toFixed(2)} / {sug.detected_billing_interval}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        {sug.email_subject}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        Detected from {sug.email_sender} • Confidence: {Math.round(sug.confidence * 100)}%
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleApproveSuggestion(sug.id)}
                        className="rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-3.5 py-1.5 text-xs font-semibold transition"
                      >
                        Approve & Add
                      </button>
                      <button
                        onClick={() => handleRejectSuggestion(sug.id)}
                        className="rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 px-3 py-1.5 text-xs font-semibold transition"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ORGANIZATIONS & TEAMS */}
      {activeTab === "organizations" && (
        <div className="space-y-6">
          {orgMessage && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-3.5 text-xs text-[var(--text-primary)]">
              {orgMessage}
            </div>
          )}

          {/* Pending Invitations */}
          {pendingInvites.length > 0 && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-2">
                Pending Invitations ({pendingInvites.length})
              </h3>
              <div className="space-y-2">
                {pendingInvites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-xl bg-[var(--bg-surface)] p-3 text-xs border border-[var(--border-subtle)]"
                  >
                    <div>
                      <p className="font-bold text-[var(--text-primary)]">{inv.organization_name}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">Invited as {inv.role}</p>
                    </div>
                    <button
                      onClick={() => handleAcceptInvite(inv.id)}
                      className="rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-3 py-1 text-xs font-semibold"
                    >
                      Accept Invite
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Existing Organizations */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-4">
              Your Organizations ({organizations.length})
            </h3>

            {organizations.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                You are not currently part of any organizations. Create one below to manage team subscriptions with RBAC.
              </p>
            ) : (
              <div className="grid gap-3">
                {organizations.map((org) => (
                  <div
                    key={org.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[var(--text-primary)]">{org.name}</span>
                        <span className="rounded-full bg-[var(--accent-subtle)] text-[var(--accent-text)] px-2 py-0.5 text-[10px] font-bold uppercase">
                          {org.role}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {org.member_count} member{org.member_count === 1 ? "" : "s"} • {org.team_count} team{org.team_count === 1 ? "" : "s"} • {org.subscription_count} subscription{org.subscription_count === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create New Organization */}
          <form onSubmit={handleCreateOrg} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Create New Organization
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Legal / Company Name
                </label>
                <input
                  type="text"
                  value={newOrgLegal}
                  onChange={(e) => setNewOrgLegal(e.target.value)}
                  placeholder="e.g. Acme Corporation LLC"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={orgLoading || !newOrgName.trim()}
              className="rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              Create Organization
            </button>
          </form>

          {/* Invite Members */}
          {organizations.length > 0 && (
            <form onSubmit={handleInviteMember} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Invite Organization Member
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                    Organization
                  </label>
                  <select
                    value={inviteOrgId}
                    onChange={(e) => setInviteOrgId(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none"
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                    User Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                    Role (RBAC)
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none"
                  >
                    <option value="member">Team Member</option>
                    <option value="office_manager">Office Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={orgLoading || !inviteEmail.trim()}
                className="rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-4 py-2 text-xs font-semibold disabled:opacity-50"
              >
                Send Invitation
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default SettingsView;
