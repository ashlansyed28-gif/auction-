import { useState } from "react";
import type { AuthenticatedUser } from "../types/auction";
import {
  sendEmailOtpCode,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  verifyEmailOtpCode,
} from "../utils/authService";
import { sanitizeUsername } from "../utils/teamRoomHelpers";

type AuthMode = "SIGN_IN" | "SIGN_UP" | "OTP";

interface EmailAuthPanelProps {
  supabaseConfigured: boolean;
  onAuthenticated: (user: AuthenticatedUser) => void;
  onPlayOfflinePassAndPlay?: () => void;
}

export function EmailAuthPanel({
  supabaseConfigured,
  onAuthenticated,
  onPlayOfflinePassAndPlay,
}: EmailAuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>("SIGN_IN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const res = await signInWithEmailPassword(email, password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.user) onAuthenticated(res.user);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const res = await signUpWithEmailPassword(email, password, username);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.user) {
      onAuthenticated(res.user);
      return;
    }
    if (res.needsEmailConfirmation) {
      setAwaitingOtp(true);
      setInfo(
        "Verification email sent! Click the confirmation link in your inbox (or enter the 6-digit code below), then sign in.",
      );
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const res = await sendEmailOtpCode(email, username);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || "Could not send verification code.");
      return;
    }
    setAwaitingOtp(true);
    setInfo("Check your email inbox for the 6-digit login code (also check Spam).");
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await verifyEmailOtpCode(email, otpToken, username);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.user) onAuthenticated(res.user);
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4 py-4 sm:py-8">
      <div className="w-full max-w-md sm:max-w-lg max-h-[95dvh] overflow-y-auto rounded-2xl bg-slate-950/90 border border-amber-400/35 shadow-2xl p-4 sm:p-6 space-y-4 backdrop-blur-xl">
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-[11px] font-extrabold uppercase tracking-widest">
            🔒 Verified Player Access
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            HAMMER TIME <span className="text-amber-400">CUSTOM ROOM</span>
          </h1>
          <p className="text-xs text-slate-400">
            Sign in with your email to claim a secure <strong className="text-slate-200">@username</strong> before
            creating or joining a squad room.
          </p>
        </div>

        {!supabaseConfigured ? (
          <div className="rounded-xl bg-amber-500/15 border border-amber-400/40 p-4 text-xs text-amber-200 space-y-2">
            <div className="font-black uppercase tracking-wider">Supabase Env Not Configured</div>
            <p>
              Add <code className="text-white">VITE_SUPABASE_URL</code> and{" "}
              <code className="text-white">VITE_SUPABASE_ANON_KEY</code> to enable secure email login and live room
              sync.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-900 border border-white/10">
              {(
                [
                  ["SIGN_IN", "Sign In"],
                  ["SIGN_UP", "Create Account"],
                  ["OTP", "Email OTP"],
                ] as const
              ).map(([tabKey, label]) => (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => {
                    setMode(tabKey);
                    setError(null);
                    setInfo(null);
                    setAwaitingOtp(false);
                  }}
                  className={`py-2 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    mode === tabKey ? "bg-amber-400 text-slate-950 shadow" : "text-slate-300 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {error && (
              <div className="rounded-xl bg-rose-500/15 border border-rose-400/40 px-3.5 py-2.5 text-xs font-semibold text-rose-200">
                {error}
              </div>
            )}

            {info && (
              <div className="rounded-xl bg-sky-500/15 border border-sky-400/40 px-3.5 py-2.5 text-xs font-semibold text-sky-200">
                {info}
              </div>
            )}

            {mode === "SIGN_IN" && (
              <form onSubmit={handleSignIn} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl bg-slate-900 border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full rounded-xl bg-slate-900 border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                >
                  {busy ? "Signing In..." : "Sign In & Enter Lobby →"}
                </button>
              </form>
            )}

            {mode === "SIGN_UP" && !awaitingOtp && (
              <form onSubmit={handleSignUp} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Secure Player Username (3-16 chars, A-Z / 0-9 / _)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-amber-300 font-black text-sm">@</span>
                    <input
                      type="text"
                      required
                      maxLength={16}
                      value={username}
                      onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
                      placeholder="TA_KOKAB"
                      className="w-full rounded-xl bg-slate-900 border border-white/15 pl-8 pr-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl bg-slate-900 border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Password (min 6 characters)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create strong password"
                    className="w-full rounded-xl bg-slate-900 border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                >
                  {busy ? "Creating Account..." : "Create Verified Account →"}
                </button>
              </form>
            )}

            {(mode === "OTP" || (mode === "SIGN_UP" && awaitingOtp)) && (
              <form onSubmit={awaitingOtp ? handleVerifyOtp : handleSendOtp} className="space-y-3">
                {!awaitingOtp && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Username (3-16 chars, A-Z / 0-9 / _)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-amber-300 font-black text-sm">@</span>
                        <input
                          type="text"
                          required
                          maxLength={16}
                          value={username}
                          onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
                          placeholder="Captain_Virat"
                          className="w-full rounded-xl bg-slate-900 border border-white/15 pl-8 pr-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-xl bg-slate-900 border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </>
                )}

                {awaitingOtp && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      6-Digit Email Verification Code
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={8}
                      value={otpToken}
                      onChange={(e) => setOtpToken(e.target.value.replace(/\s+/g, ""))}
                      placeholder="123456"
                      className="w-full rounded-xl bg-slate-900 border border-white/15 px-3.5 py-2.5 text-base font-black tracking-[0.25em] text-center text-amber-300 tnum focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                >
                  {busy
                    ? "Processing..."
                    : awaitingOtp
                    ? "Verify Code & Enter →"
                    : "Send Email OTP Code →"}
                </button>

                {awaitingOtp && (
                  <button
                    type="button"
                    onClick={() => {
                      setAwaitingOtp(false);
                      setMode("SIGN_IN");
                    }}
                    className="w-full py-2 rounded-lg bg-slate-900 border border-white/10 text-[11px] font-bold text-slate-300 cursor-pointer"
                  >
                    Already verified via link? Switch to Sign In
                  </button>
                )}
              </form>
            )}
          </>
        )}

        {onPlayOfflinePassAndPlay && (
          <div className="pt-2 border-t border-white/10 text-center">
            <button
              type="button"
              onClick={onPlayOfflinePassAndPlay}
              className="text-xs font-bold text-slate-400 hover:text-amber-300 underline underline-offset-4 cursor-pointer"
            >
              Or practice offline in Pass &amp; Play mode →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
