export const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api";

async function apiRequest(endpoint, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch (networkError) {
    console.error(`Network error connecting to ${API_BASE_URL}${endpoint}:`, networkError);
    if (API_BASE_URL.includes("localhost")) {
      throw new Error(
          `Cannot reach backend at ${API_BASE_URL}. Make sure your backend is running or set VITE_API_BASE_URL in your hosting settings.`,
        { cause: networkError }
      );
    }
    throw new Error(
        `Unable to reach backend at ${API_BASE_URL}. The server may be waking up or offline.`,
      { cause: networkError }
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || data.message || `HTTP Error: ${response.status}`
    );
  }

  return data;
}

export const api = {
  health: () => apiRequest("/health"),
  databaseHealth: () => apiRequest("/health/database"),

  // Authentication
  register: (userData) =>
    apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    }),

  login: (credentials) =>
    apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),

  currentUser: () => apiRequest("/auth/me"),

  getProfile: () => apiRequest("/auth/profile"),

  updateProfile: (profileData) =>
    apiRequest("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(profileData),
    }),

  logout: () =>
    apiRequest("/auth/logout", {
      method: "POST",
    }),

  // Subscriptions
  getSubscriptions: (status = "") => {
    const query = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
    return apiRequest(`/subscriptions${query}`);
  },

  getSubscription: (id) => apiRequest(`/subscriptions/${id}`),

  createSubscription: (data) =>
    apiRequest("/subscriptions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateSubscription: (id, data) =>
    apiRequest(`/subscriptions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteSubscription: (id) =>
    apiRequest(`/subscriptions/${id}`, {
      method: "DELETE",
    }),

  checkInUsage: (id, data) =>
    apiRequest(`/subscriptions/${id}/check-in`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getCategories: () => apiRequest("/subscriptions/categories"),

  exportSubscriptionsCsvUrl: () => `${API_BASE_URL}/subscriptions/export/csv`,

  // Analytics & Financial Reports
  getAnalyticsSummary: () => apiRequest("/analytics/summary"),
  getRenewals: () => apiRequest("/analytics/renewals"),
  getFinancialReport: () => apiRequest("/analytics/report"),

  // Notifications
  getNotifications: (unreadOnly = false) => {
    const query = unreadOnly ? "?unread_only=true" : "";
    return apiRequest(`/notifications${query}`);
  },
  markNotificationRead: (id) =>
    apiRequest(`/notifications/${id}/read`, {
      method: "PUT",
    }),
  markAllNotificationsRead: () =>
    apiRequest("/notifications/read-all", {
      method: "PUT",
    }),
  deleteNotification: (id) =>
    apiRequest(`/notifications/${id}`, {
      method: "DELETE",
    }),
  checkReminders: () =>
    apiRequest("/notifications/check-reminders", {
      method: "POST",
    }),

  // AI & Waste Intelligence
  getRecommendations: () => apiRequest("/intelligence/recommendations"),
  getAssessmentHistory: (limit = 20) => apiRequest(`/intelligence/history?limit=${limit}`),
  assessSubscription: (id) =>
    apiRequest(`/intelligence/assess/${id}`, {
      method: "POST",
    }),

  // Gmail Integration
  getGmailStatus: () => apiRequest("/gmail/status"),
  getGmailAuthUrl: (origin) => {
    const query = origin ? `?origin=${encodeURIComponent(origin)}` : "";
    return apiRequest(`/gmail/auth-url${query}`);
  },
  syncGmail: () =>
    apiRequest("/gmail/sync", {
      method: "POST",
    }),
  disconnectGmail: () =>
    apiRequest("/gmail/disconnect", {
      method: "POST",
    }),
  getGmailSuggestions: () => apiRequest("/gmail/suggestions"),
  approveGmailSuggestion: (id) =>
    apiRequest(`/gmail/suggestions/${id}/approve`, {
      method: "POST",
    }),
  rejectGmailSuggestion: (id) =>
    apiRequest(`/gmail/suggestions/${id}/reject`, {
      method: "POST",
    }),

  // Organizations & Teams RBAC
  getOrganizations: () => apiRequest("/organizations"),
  createOrganization: (data) =>
    apiRequest("/organizations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getOrganization: (id) => apiRequest(`/organizations/${id}`),
  updateOrganization: (id, data) =>
    apiRequest(`/organizations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getOrgMembers: (id) => apiRequest(`/organizations/${id}/members`),
  inviteOrgMember: (id, data) =>
    apiRequest(`/organizations/${id}/invitations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateOrgMemberRole: (id, userId, role) =>
    apiRequest(`/organizations/${id}/members/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),
  removeOrgMember: (id, userId) =>
    apiRequest(`/organizations/${id}/members/${userId}`, {
      method: "DELETE",
    }),
  acceptOrgInvitation: (id) =>
    apiRequest(`/organizations/invitations/${id}/accept`, {
      method: "POST",
    }),
  rejectOrgInvitation: (id) =>
    apiRequest(`/organizations/invitations/${id}/reject`, {
      method: "POST",
    }),
  getOrgAnalytics: (id) => apiRequest(`/organizations/${id}/analytics`),
  getOrgTeams: (id) => apiRequest(`/organizations/${id}/teams`),
  createOrgTeam: (id, data) =>
    apiRequest(`/organizations/${id}/teams`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateOrgTeam: (id, teamId, data) =>
    apiRequest(`/organizations/${id}/teams/${teamId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteOrgTeam: (id, teamId) =>
    apiRequest(`/organizations/${id}/teams/${teamId}`, {
      method: "DELETE",
    }),
  getOrgAuditLogs: (id) => apiRequest(`/organizations/${id}/audit-logs`),
};

export default api;
