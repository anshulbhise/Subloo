
import { useState } from "react";
import useAuth from "../context/useAuth";
function Login() {
  const { login, register } = useAuth();

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
        await register({
          full_name: fullName,
          email: email,
          password: password,
        });

        setSuccess("Account created successfully!");
      } else {
        await login({
          email: email,
          password: password,
        });

        setSuccess("Login successful!");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9F8] flex items-center justify-center px-4">

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-[#087F65] text-white rounded-xl flex items-center justify-center text-2xl font-bold mx-auto mb-4">
            S
          </div>

          <h1 className="text-3xl font-bold text-gray-900">
            subloo
          </h1>

          <p className="text-xs tracking-[0.25em] text-gray-500 mt-1">
            SMARTER SUBSCRIPTIONS
          </p>
        </div>

        {/* Heading */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {isRegister ? "Create your account" : "Welcome back"}
          </h2>

          <p className="text-gray-500 text-sm mt-2">
            {isRegister
              ? "Start managing your subscriptions smarter."
              : "Sign in to continue to your workspace."}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-4">
            {success}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {isRegister && (
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Full Name
              </label>

              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                required
                maxLength={120}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-[#087F65]"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Email Address
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-[#087F65]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              minLength={12}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-[#087F65]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#087F65] hover:bg-[#066A55] disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading
              ? "Please wait..."
              : isRegister
              ? "Create Account"
              : "Sign In"}
          </button>

        </form>

        {/* Switch Mode */}
        <div className="text-center mt-6 text-sm text-gray-600">
          {isRegister
            ? "Already have an account?"
            : "Don't have an account?"}

          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
              setSuccess("");
            }}
            className="text-[#087F65] font-semibold ml-2 hover:underline"
          >
            {isRegister ? "Sign In" : "Register"}
          </button>
        </div>

        {/* Privacy */}
        <p className="text-center text-xs text-gray-400 mt-8">
          Your financial information stays private and secure.
        </p>

      </div>
    </div>
  );
}

export default Login;
