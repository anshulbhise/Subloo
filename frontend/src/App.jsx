import { useState, useEffect, useCallback } from "react";
import Login from "./pages/Login";
import useAuth from "./context/useAuth";
import api from "./services/api";

import OverviewView from "./components/OverviewView";
import SubscriptionsView from "./components/SubscriptionsView";
import RenewalsView from "./components/RenewalsView";
import AnalyticsView from "./components/AnalyticsView";
import AIInsightsView from "./components/AIInsightsView";
import SubscriptionModal from "./components/SubscriptionModal";
import DeleteConfirmModal from "./components/DeleteConfirmModal";
import UsageCheckInModal from "./components/UsageCheckInModal";

const navigation = [
  { name: "Overview", icon: "◫" },
  { name: "Subscriptions", icon: "▤" },
  { name: "AI Insights", icon: "✧" },
  { name: "Renewals", icon: "◷" },
  { name: "Analytics", icon: "▥" },
];

function App() {
  const { user, loading: authLoading, logout } = useAuth();

  const [activePage, setActivePage] = useState("Overview");
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9F8]">
        <div className="text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#087F65] text-2xl font-bold text-white mx-auto mb-3">
            S
          </div>
          <p className="text-[#087F65] font-semibold text-sm">
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
    <div className="min-h-screen bg-[#F7F9F8] text-[#172B2A] md:flex">
      {/* Sidebar */}
      <aside className="w-full border-r border-[#E8EEEB] bg-white md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col md:overflow-y-auto md:overscroll-contain">
        {/* Logo */}
        <div className="flex h-20 items-center gap-3 border-b border-[#E8EEEB] px-7">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#087F65] text-xl font-bold text-white shadow-xs">
            S
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">subloo</h1>
            <p className="text-[10px] font-medium tracking-[2px] text-[#82918B]">
              SMARTER SUBSCRIPTIONS
            </p>
          </div>
        </div>

        {/* Workspace selector */}
        <div className="border-b border-[#E8EEEB] p-5">
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[#9AA8A1]">
            Workspace
          </p>
          <div className="flex w-full items-center gap-3 rounded-xl border border-[#E8EEEB] bg-[#F7FAF8] p-3 text-left">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E6F4EF] text-[#087F65] text-sm">
              ◈
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">Personal</p>
              <p className="text-[11px] text-[#82918B] truncate">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#9AA8A1]">
            MENU
          </p>

          <div className="flex gap-1.5 overflow-x-auto md:flex-col">
            {navigation.map((item) => (
              <button
                key={item.name}
                onClick={() => setActivePage(item.name)}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  activePage === item.name
                    ? "bg-[#E8F5F0] text-[#087F65] font-semibold"
                    : "text-[#718079] hover:bg-[#F4F7F5]"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.name}
                {item.name === "Subscriptions" && subscriptions.length > 0 && (
                  <span className="ml-auto hidden rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-[#718079] md:block font-normal">
                    {subscriptions.length}
                  </span>
                )}
                {activePage === item.name && (
                  <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-[#087F65] md:block" />
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Privacy First Badge */}
        <div className="m-5 hidden rounded-2xl bg-[#F1F7F4] p-4 md:block border border-[#E4ECE7]">
          <div className="mb-1.5 flex items-center gap-2 text-[#087F65]">
            <span className="text-sm">◈</span>
            <span className="text-xs font-bold uppercase tracking-wider">Privacy first</span>
          </div>
          <p className="text-[11px] leading-relaxed text-[#718079]">
            Your subscription data is kept strictly isolated and confidential to your account.
          </p>
        </div>

        {/* User Profile & Logout */}
        <div className="border-t border-[#E8EEEB] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DDF0E8] font-bold text-[#087F65]">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate text-[#172B2A]">
                  {user.full_name || "My Account"}
                </p>
                <p className="text-[11px] text-[#82918B] truncate">
                  {user.email}
                </p>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition shrink-0"
            >
              ⎋
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="min-w-0 flex-1 md:ml-64">
        {/* Topbar */}
        <header className="flex h-20 items-center justify-between border-b border-[#E8EEEB] bg-white px-5 md:px-10 sticky top-0 z-10">
          <div>
            <p className="text-xs text-[#82918B]">Workspace / Personal</p>
            <h2 className="text-lg font-bold text-[#172B2A]">{activePage}</h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAdd}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[#087F65] hover:bg-[#066A55] text-white px-4 py-2 text-xs font-semibold transition shadow-xs"
            >
              <span>+</span> Add Subscription
            </button>

            <button
              onClick={logout}
              className="text-xs font-medium text-gray-500 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
            >
              Sign Out
            </button>

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DDF0E8] font-bold text-sm text-[#087F65]">
              {userInitial}
            </div>
          </div>
        </header>

        {/* View Router */}
        <div className="mx-auto max-w-7xl p-5 md:p-10">
          {activePage === "Overview" && (
            <OverviewView
              summary={summary}
              subscriptions={subscriptions}
              loading={dataLoading}
              onAddClick={handleOpenAdd}
              onNavigate={(page) => setActivePage(page)}
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

          {/* Footer */}
          <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 text-xs text-[#9AA8A1] border-t border-[#E8EEEB] pt-6">
            <p>© 2026 Subloo. Smarter subscriptions, real savings.</p>
            <p>Built with privacy and intelligence in mind.</p>
          </footer>
        </div>
      </main>

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
