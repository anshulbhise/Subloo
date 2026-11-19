
import { useEffect, useState } from "react";
import AuthContext from "./AuthContext";
import { api } from "../services/api";

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check existing login session
  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      try {
        const data = await api.currentUser();

        if (mounted) {
          setUser(data.user || null);
        }
      } catch {
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    checkAuth();

    return () => {
      mounted = false;
    };
  }, []);

  // Login
  async function login(credentials) {
    const data = await api.login(credentials);
    setUser(data.user || null);
    return data;
  }

  // Register
  async function register(userData) {
    const data = await api.register(userData);
    setUser(data.user || null);
    return data;
  }

  // Logout
  async function logout() {
    await api.logout();
    setUser(null);
  }

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
