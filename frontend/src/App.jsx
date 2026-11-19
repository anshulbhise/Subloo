import { useState, useEffect, useCallback } from "react";
import Login from "./pages/Login";
import useAuth from "./context/useAuth";
import { useTheme } from "./context/ThemeContext";
import api from "./services/api";

import OverviewView from "./components/OverviewView";
import SubscriptionsView from "./components/SubscriptionsView";
import RenewalsView from "./components/RenewalsView";
import AnalyticsView from "./components/AnalyticsView";
import AIInsightsView from "./components/AIInsightsView";
import SettingsView from "./components/SettingsView";
import SubscriptionModal from "./components/SubscriptionModal";
import DeleteConfirmModal from "./components/DeleteConfirmModal";
import UsageCheckInModal from "./components/UsageCheckInModal";
import NotificationCenter from "./components/NotificationCenter";
import ErrorBoundary from "./components/ErrorBoundary";

const navigationItems = [
  {
    name: "Overview",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    name: "Subscriptions",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    name: "AI Insights",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    name: "Renewals",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: "Analytics",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    name: "Settings",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function App() {
  const { user, loading: authLoading, logout, checkAuth } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Helper to match URL page parameter to navigation item
  const matchPageFromParam = (param) => {
    if (!param) return null;
    const clean = param.trim().toLowerCase();
    const found = navigationItems.find(
      (item) =>
        item.name.toLowerCase() === clean ||
        item.name.toLowerCase().replace(/\s+/g, "-") === clean
    );
    return found ? found.name : null;
  };

  const [activePage, setActivePage] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "gmail") return "Settings";
      const matched = matchPageFromParam(params.get("page"));
      if (matched) return matched;
    } catch (e) { }
    return "Overview";
  });

  const handleNavigate = useCallback((page) => {
    setActivePage(page);
    try {
      const url = new URL(window.location.href);
      const slug = page.toLowerCase().replace(/\s+/g, "-");
      if (page === "Overview") {
        url.searchParams.delete("page");
      } else {
        url.searchParams.set("page", slug);
      }
      if (url.searchParams.get("tab") === "gmail" && page !== "Settings") {
        url.searchParams.delete("tab");
        url.searchParams.delete("status");
        url.searchParams.delete("message");
      }
      window.history.pushState({ page }, "", url.toString());
    } catch (e) { }
  }, []);

  // Listen to browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get("tab") === "gmail") {
          setActivePage("Settings");
          return;
        }
        const matched = matchPageFromParam(params.get("page"));
        setActivePage(matched || "Overview");
      } catch (e) { }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const [subscriptions, setSubscriptions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [deletingSub, setDeletingSub] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [checkInSub, setCheckInSub] = useState(null);

  // Refresh subscriptions & dashboard summary
  const refreshData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      const [subsRes, summaryRes] = await Promise.all([
        api.getSubscriptions(),
        api.getAnalyticsSummary().catch(() => ({})),
      ]);
      setSubscriptions(subsRes.subscriptions || []);
      setSummary(summaryRes || null);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user, refreshData]);

  // Handlers
  const handleOpenAdd = () => {
    setEditingSub(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (sub) => {
    setEditingSub(sub);
    setModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSub) return;
    setDeleteLoading(true);
    try {
      await api.deleteSubscription(deletingSub.id);
      setDeletingSub(null);
      await refreshData();
    } catch (err) {
      alert(err.message || "Failed to delete subscription.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleProfileUpdated = (updatedUser) => {
    if (checkAuth) checkAuth();
    refreshData();
  };

  const cycleTheme = () => {
    if (theme === "system") setTheme("dark");
    else if (theme === "dark") setTheme("light");
    else setTheme("system");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
        <div className="text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-primary)] text-2xl font-bold text-white mx-auto mb-3 shadow-xs">
            S
          </div>
          <p className="text-[var(--accent-text)] font-semibold text-xs tracking-wider uppercase">
            Loading Subloo...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const userInitial = (user.full_name || user.email || "U")[0].toUpperCase();

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors duration-200 md:flex">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col md:overflow-y-auto md:overscroll-contain border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] z-20">
        {/* Logo & Brand */}
        <div className="flex h-20 items-center gap-3 border-b border-[var(--border-subtle)] px-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-xl font-bold text-white shadow-xs">
            S
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              subloo
            </h1>
            <p className="text-[9px] font-semibold tracking-[0.2em] text-[var(--text-muted)]">
              SMARTER SUBSCRIPTIONS
            </p>
          </div>
        </div>

        {/* Workspace Selector */}
        <div className="border-b border-[var(--border-subtle)] p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Workspace
          </p>
          <div className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-2.5 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate text-[var(--text-primary)]">Personal Workspace</p>
              <p className="text-[10px] text-[var(--text-muted)] truncate">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-1">
          <p className="mb-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Menu
          </p>

          <div className="space-y-1">
            {navigationItems.map((item) => {
              const isActive = activePage === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigate(item.name)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${isActive
                      ? "bg-[var(--accent-subtle)] text-[var(--accent-text)] border border-[var(--accent-border)] shadow-xs"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                >
                  <span className={isActive ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]"}>
                    {item.icon}
                  </span>
                  <span>{item.name}</span>

                  {item.name === "Subscriptions" && subscriptions.length > 0 && (
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${isActive
                          ? "bg-[var(--accent-primary)] text-white"
                          : "bg-[var(--bg-surface-secondary)] text-[var(--text-muted)]"
                        }`}
                    >
                      {subscriptions.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Privacy Banner */}
        <div className="m-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-3.5">
          <div className="flex items-center gap-2 text-[var(--accent-text)] mb-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wider">Privacy First</span>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
            Data is securely isolated to your account.
          </p>
        </div>

        {/* User Card at Sidebar Bottom */}
        <div className="border-t border-[var(--border-subtle)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-subtle)] font-bold text-xs text-[var(--accent-primary)]">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate text-[var(--text-primary)]">
                  {user.full_name || "My Account"}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] truncate">
                  {user.email}
                </p>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE TOP BAR */}
      <div className="md:hidden sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-sm font-bold text-white shadow-2xs">
            S
          </div>
          <div>
            <span className="text-sm font-bold text-[var(--text-primary)] leading-none block">subloo</span>
            <span className="text-[10px] font-semibold text-[var(--accent-primary)] leading-none block mt-1">{activePage}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={cycleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)]"
          >
            {resolvedTheme === "dark" ? (
              <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>

          <NotificationCenter />

          <button
            onClick={handleOpenAdd}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-primary)] text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <button
            onClick={logout}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] text-[var(--text-muted)] hover:text-red-500"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="min-w-0 flex-1 md:ml-64 pb-20 md:pb-12">
        {/* DESKTOP STICKY HEADER */}
        <header className="hidden md:flex h-16 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-8 sticky top-0 z-10 transition-colors duration-200">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Workspace / Personal
            </p>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              {activePage}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle Pill */}
            <button
              onClick={cycleTheme}
              title={`Active theme: ${theme} (${resolvedTheme}). Click to cycle.`}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition shadow-2xs"
            >
              {resolvedTheme === "dark" ? (
                <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
              <span className="capitalize">{theme}</span>
            </button>

            {/* Notification Center Bell */}
            <NotificationCenter />

            {/* Quick Add Subscription */}
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-3.5 py-1.5 text-xs font-semibold transition shadow-xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Subscription</span>
            </button>

            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-subtle)] font-bold text-xs text-[var(--accent-primary)]">
              {userInitial}
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="mx-auto max-w-7xl p-4 sm:p-6 md:p-8">
          <ErrorBoundary key={activePage} onNavigateOverview={() => handleNavigate("Overview")}>
            {activePage === "Overview" && (
              <OverviewView
                summary={summary}
                subscriptions={subscriptions}
                loading={dataLoading}
                onAddClick={handleOpenAdd}
                onNavigate={handleNavigate}
                user={user}
              />
            )}

            {activePage === "Subscriptions" && (
              <SubscriptionsView
                subscriptions={subscriptions}
                loading={dataLoading}
                onAddClick={handleOpenAdd}
                onEditClick={handleOpenEdit}
                onDeleteClick={(sub) => setDeletingSub(sub)}
                onCheckInClick={(sub) => setCheckInSub(sub)}
              />
            )}

            {activePage === "Renewals" && (
              <RenewalsView
                onAddClick={handleOpenAdd}
                onEditClick={handleOpenEdit}
              />
            )}

            {activePage === "Analytics" && (
              <AnalyticsView
                summary={summary}
                subscriptions={subscriptions}
                loading={dataLoading}
                onAddClick={handleOpenAdd}
              />
            )}

            {activePage === "AI Insights" && (
              <AIInsightsView
                onAddClick={handleOpenAdd}
                onCheckInClick={(sub) => setCheckInSub(sub)}
                onEditClick={handleOpenEdit}
              />
            )}

            {activePage === "Settings" && (
              <SettingsView
                user={user}
                onProfileUpdated={handleProfileUpdated}
              />
            )}
          </ErrorBoundary>

          {/* Footer */}
          <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)] border-t border-[var(--border-subtle)] pt-6">
            <p>© 2026 Subloo. Smarter subscriptions, real savings.</p>
            <p>Designed with privacy, minimalism and performance.</p>
          </footer>
        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] z-30 flex items-center justify-between overflow-x-auto no-scrollbar py-2 px-1 shadow-lg">
        {navigationItems.map((item) => {
          const isActive = activePage === item.name;
          return (
            <button
              key={item.name}
              onClick={() => handleNavigate(item.name)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition min-w-[52px] shrink-0 ${isActive
                  ? "text-[var(--accent-primary)] font-bold bg-[var(--accent-subtle)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
            >
              <span className="text-sm">{item.icon}</span>
              <span className="text-[10px] mt-0.5 whitespace-nowrap">{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals */}
      <SubscriptionModal
        isOpen={modalOpen}
        subscription={editingSub}
        onClose={() => setModalOpen(false)}
        onSaved={refreshData}
      />

      <DeleteConfirmModal
        isOpen={Boolean(deletingSub)}
        subscription={deletingSub}
        loading={deleteLoading}
        onClose={() => setDeletingSub(null)}
        onConfirm={handleDeleteConfirm}
      />

      <UsageCheckInModal
        isOpen={Boolean(checkInSub)}
        subscription={checkInSub}
        onClose={() => setCheckInSub(null)}
        onSaved={refreshData}
      />
    </div>
  );
}

export default App;
