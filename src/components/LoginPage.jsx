import React, { useState, useMemo } from "react";
import * as api from "../utils/api";

export default function LoginPage({ open, onLogin, paired }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Email validation regex
  const emailValid = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }, [email]);

  const passwordValid = password.length >= 6;
  const canLogin = emailValid && passwordValid && !loading;

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (!canLogin) return;
    setLoading(true);
    try {
      const user = await api.userLogin(email.trim().toLowerCase(), password);
      onLogin?.(user);
    } catch (err) {
      setError(err.message || "Login failed (msg from handleLogin page)");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (!canLogin) return;
    setLoading(true);
    try {
      await api.register(email.trim().toLowerCase(), password);
      const user = await api.userLogin(email.trim().toLowerCase(), password);
      onLogin?.(user);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[3000] bg-white flex items-center justify-center">
      {/* Satellite icon top left */}
      <div className="absolute top-6 left-6">
        <img
          src={paired ? "/green-sat.png" : "/red-sat.png"}
          alt={paired ? "Connected to Skylink" : "Not connected to Skylink"}
          className="w-12 h-12 drop-shadow"
        />
      </div>
      <div className="w-[520px] h-[720px] rounded-md bg-[#0B2436] shadow-lg flex flex-col items-center justify-center px-10">

        {/* Title */}
        <h1 className="text-white text-6xl font-bold mb-6">SKYTRAC</h1>

        {/* Satellite icon */}
        <div className="mb-10 text-4xl text-white">🛰️</div>

        <form className="w-full">

          {/* EMAIL */}
          <div className="mb-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/10 text-white placeholder-white/60 outline-none border border-white/10"
            />

            {!emailValid && submitted && (
              <p className="text-red-300 text-sm mt-1">
                Please enter a valid email address
              </p>
            )}
          </div>

          {/* PASSWORD */}
          <div className="mb-6">
            <input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/10 text-white placeholder-white/60 outline-none border border-white/10"
            />

            {!passwordValid && submitted && (
              <p className="text-red-300 text-sm mt-1">
                Password must be at least 6 characters
              </p>
            )}
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleLogin}
              disabled={!canLogin || loading}
              className={`flex-1 py-3 rounded-lg font-semibold transition ${
                canLogin && !loading
                  ? "bg-white/30 hover:bg-white/40 text-white"
                  : "bg-white/10 text-white/40 cursor-not-allowed"
              }`}
            >
              {loading ? "Loading..." : "Login"}
            </button>
            <button
              type="button"
              onClick={handleSignup}
              disabled={!canLogin || loading}
              className={`flex-1 py-3 rounded-lg font-semibold transition ${
                canLogin && !loading
                  ? "bg-green-500 hover:bg-green-600 text-white"
                  : "bg-white/10 text-white/40 cursor-not-allowed"
              }`}
            >
              {loading ? "Loading..." : "Sign Up"}
            </button>
          </div>
          {error && (
            <p className="text-red-300 text-sm mt-3 text-center">{error}</p>
          )}

        </form>
      </div>
    </div>
  );
}