import React, { useState, useMemo } from "react";

export default function LoginPage({ open, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Email validation regex
  const emailValid = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }, [email]);

  const passwordValid = password.length >= 6;

  const canLogin = emailValid && passwordValid;

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);

    if (!canLogin) return;

    onLogin?.({
      email: email.trim().toLowerCase(),
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[3000] bg-white flex items-center justify-center">
      <div className="w-[520px] h-[720px] rounded-md bg-[#0B2436] shadow-lg flex flex-col items-center justify-center px-10">

        {/* Title */}
        <h1 className="text-white text-6xl font-bold mb-6">SKYTRAC</h1>

        {/* Satellite icon */}
        <div className="mb-10 text-4xl text-white">🛰️</div>

        <form onSubmit={handleSubmit} className="w-full">

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

          {/* LOGIN BUTTON */}
          <button
            type="submit"
            disabled={!canLogin}
            className={`w-full py-3 rounded-lg font-semibold transition ${
              canLogin
                ? "bg-white/30 hover:bg-white/40 text-white"
                : "bg-white/10 text-white/40 cursor-not-allowed"
            }`}
          >
            Login
          </button>

        </form>
      </div>
    </div>
  );
}