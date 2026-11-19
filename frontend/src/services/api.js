const API_BASE_URL =
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
        `Cannot reach backend at ${API_BASE_URL}. Make sure your backend is running or set VITE_API_BASE_URL in your hosting settings.`
      );
    }
    throw new Error(
      `Unable to reach backend at ${API_BASE_URL}. The server may be waking up or offline.`
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

  // Analytics & Dashboard
  getAnalyticsSummary: () => apiRequest("/analytics/summary"),
  getRenewals: () => apiRequest("/analytics/renewals"),

  // AI & Waste Intelligence
  getRecommendations: () => apiRequest("/intelligence/recommendations"),
  assessSubscription: (id) =>
    apiRequest(`/intelligence/assess/${id}`, {
      method: "POST",
    }),
};

export default api;
