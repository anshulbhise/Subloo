import { useState } from "react";
import useAuth from "../context/useAuth";
import { useTheme } from "../context/ThemeContext";

function Login() {
  const { login, register } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (isRegister) {
        if (!fullName.trim()) {
          throw new Error("Please enter your full name.");
        }
        if (password.length < 12) {
          throw new Error("Password must be at least 12 characters long.");
        }
        await register({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password: password,
        });
        setSuccess("Account created successfully!");
      } else {
        await login({
          email: email.trim().toLowerCase(),
          password: password,
        });
        setSuccess("Login successful!");
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const cycleTheme = () => {
    if (theme === "system") setTheme("dark");
    else if (theme === "dark") setTheme("light");
    else setTheme("system");
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col justify-between p-4 sm:p-6 transition-colors duration-200">
      {/* Top bar with quick theme toggle */}
      <div className="flex items-center justify-between max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-sm font-bold text-white shadow-xs">
            S
          </div>
          <span className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
            subloo
          </span>
        </div>

        <button
          onClick={cycleTheme}
          title={`Current theme: ${theme} (${resolvedTheme}). Click to cycle.`}
          className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition shadow-2xs"
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
          <span className="capitalize">{theme}</span>
        </button>
      </div>

      {/* Centered Auth Card */}
      <div className="w-full max-w-md mx-auto my-auto bg-[var(--bg-surface)] rounded-2xl shadow-xl border border-[var(--border-subtle)] p-6 sm:p-8">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[var(--accent-primary)] text-white rounded-xl flex items-center justify-center text-xl font-bold mx-auto mb-3 shadow-xs">
            S
          </div>

          <h1 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
            subloo
          </h1>

          <p className="text-[10px] tracking-[0.25em] font-medium text-[var(--text-muted)] mt-0.5">
            SMARTER SUBSCRIPTIONS
          </p>
        </div>

        {/* Form Title & Subtitle */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            {isRegister ? "Create your account" : "Welcome back"}
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {isRegister
              ? "Start managing your subscriptions with intelligent waste detection."
              : "Sign in to access your personal workspace."}
          </p>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs font-medium text-red-500 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-subtle)] p-3.5 text-xs font-medium text-[var(--accent-text)] flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Anshul Bhise"
                required
                maxLength={120}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Password
              </label>
              {isRegister && (
                <span className="text-[10px] text-[var(--text-muted)]">
                  Min. 12 characters
                </span>
              )}
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              minLength={12}
              required
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white py-2.5 text-sm font-semibold transition shadow-xs disabled:opacity-60"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              <span>{isRegister ? "Create Account" : "Sign In"}</span>
            )}
          </button>
        </form>

        {/* Switch mode */}
        <div className="mt-6 text-center text-xs text-[var(--text-muted)] border-t border-[var(--border-subtle)] pt-5">
          {isRegister ? (
            <p>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setError("");
                  setSuccess("");
                }}
                className="font-bold text-[var(--accent-text)] hover:underline"
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              Don't have an account yet?{" "}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setError("");
                  setSuccess("");
                }}
                className="font-bold text-[var(--accent-text)] hover:underline"
              >
                Create Account
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-[var(--text-muted)] max-w-sm mx-auto">
        <p>Your subscription and usage telemetry are encrypted and isolated to your account.</p>
      </div>
    </div>
  );
}

export default Login;
