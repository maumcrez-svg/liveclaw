// ── Login / Register screen ─────────────────────────────────────────
//
// Premium split layout: branding left, auth form right.

import React, { useState } from 'react';
import { useAppStore } from '../store/app-store';
import { login, register, ApiError } from '../api/client';
import mascotImg from '../assets/mascot.png';
import logoImg from '../assets/logo-dark.png';
import crabIcon from '../assets/crab-icon.png';

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

const FEATURES = [
  { icon: '\u{1F916}', title: 'Create AI agents', desc: 'Build your agent in minutes with a simple wizard' },
  { icon: '\u{1F3AC}', title: 'Go live instantly', desc: 'One click to stream — OBS runs invisibly behind the scenes' },
  { icon: '\u{1F50D}', title: 'Real-time preview', desc: 'See exactly what your viewers see before going live' },
  { icon: '\u{1F4AC}', title: 'Live chat built-in', desc: 'Your agent interacts with viewers automatically' },
];

export function LoginScreen() {
  const transition = useAppStore((s) => s.transition);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setError(null);
    setFieldErrors({});
    setConfirmPassword('');
  };

  const validate = (): boolean => {
    const errs: typeof fieldErrors = {};

    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 20) {
      errs.username = 'Username must be 3-20 characters.';
    } else if (!USERNAME_RE.test(trimmed)) {
      errs.username = 'Letters, numbers, and underscores only.';
    }

    if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    } else if (password.length > 72) {
      errs.password = 'Password must be 72 characters or fewer.';
    }

    if (mode === 'register' && password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password);
      }
      transition('picking_agent');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('Wrong username or password.');
        } else if (err.status === 409) {
          setError('Username already taken.');
        } else {
          setError(err.message);
        }
      } else {
        setError("Can't reach LiveClaw right now. Check your connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === 'login';
  const canSubmit =
    !loading &&
    username.trim().length > 0 &&
    password.length > 0 &&
    (isLogin || confirmPassword.length > 0);

  return (
    <div className="flex h-full">
      {/* ── Left: Branding ────────────────────────────────────────── */}
      <div className="hidden sm:flex sm:w-[55%] flex-col p-6 bg-gradient-to-br from-studio-accent/5 via-studio-card to-studio-accent/10 relative overflow-hidden">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,107,0,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,107,0,0.08) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Top: Logo — pinned to top */}
        <div className="relative z-10 mb-auto">
          <img
            src={logoImg}
            alt="LiveClaw"
            className="h-14 w-auto"
            draggable={false}
          />
        </div>

        {/* Center: Mascot + tagline */}
        <div className="relative z-10 flex flex-col items-center -mt-32">
          <img
            src={mascotImg}
            alt="LiveClaw mascot"
            className="w-52 h-52 drop-shadow-2xl mb-6"
            draggable={false}
          />
          <h2 className="text-2xl font-bold text-studio-text text-center leading-tight -mt-2">
            Where AI agents
            <br />
            <span className="text-studio-accent">go live</span>
          </h2>
          <p className="text-studio-muted text-sm mt-1 text-center max-w-xs">
            Create, customize, and stream your AI agents to the world.
          </p>
        </div>

        {/* Bottom: Feature grid */}
        <div className="relative z-10 grid grid-cols-2 gap-3 mb-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-2 p-2.5 rounded-lg bg-studio-bg/50 border border-studio-border/50"
            >
              <span className="text-lg shrink-0 mt-0.5">{f.icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-studio-text">{f.title}</p>
                <p className="text-[10px] text-studio-muted leading-tight mt-0.5">
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Auth form ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo (hidden on split layout) */}
          <div className="sm:hidden text-center mb-6">
            <img
              src={logoImg}
              alt="LiveClaw"
              className="h-7 w-auto mx-auto mb-2"
              draggable={false}
            />
          </div>

          {/* Header */}
          <div className="mb-6">
            <img
              src={crabIcon}
              alt=""
              className="w-10 h-10 mb-4"
              draggable={false}
            />
            <h1 className="text-xl font-bold text-studio-text">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-studio-muted text-sm mt-1">
              {isLogin
                ? 'Sign in to start streaming your agents'
                : 'Get started in less than a minute'}
            </p>
          </div>

          {/* Mode tabs */}
          <div className="flex mb-5 bg-studio-bg rounded-lg p-0.5 border border-studio-border">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                isLogin
                  ? 'bg-studio-accent text-white shadow-sm'
                  : 'text-studio-muted hover:text-studio-text'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                !isLogin
                  ? 'bg-studio-accent text-white shadow-sm'
                  : 'text-studio-muted hover:text-studio-text'
              }`}
            >
              Create account
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-studio-muted mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (fieldErrors.username)
                    setFieldErrors((p) => ({ ...p, username: undefined }));
                }}
                autoFocus
                autoComplete="username"
                className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2.5 text-sm text-studio-text placeholder-studio-muted/50 focus:outline-none focus:border-studio-accent transition-colors"
                placeholder="your_username"
              />
              {fieldErrors.username && (
                <p className="text-xs text-studio-live mt-1">
                  {fieldErrors.username}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-studio-muted mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password)
                    setFieldErrors((p) => ({ ...p, password: undefined }));
                }}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2.5 text-sm text-studio-text placeholder-studio-muted/50 focus:outline-none focus:border-studio-accent transition-colors"
                placeholder={isLogin ? 'Enter your password' : 'Choose a password (6+ chars)'}
              />
              {fieldErrors.password && (
                <p className="text-xs text-studio-live mt-1">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-medium text-studio-muted mb-1.5">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword)
                      setFieldErrors((p) => ({
                        ...p,
                        confirmPassword: undefined,
                      }));
                  }}
                  autoComplete="new-password"
                  className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2.5 text-sm text-studio-text placeholder-studio-muted/50 focus:outline-none focus:border-studio-accent transition-colors"
                  placeholder="Repeat your password"
                />
                {fieldErrors.confirmPassword && (
                  <p className="text-xs text-studio-live mt-1">
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-studio-live/10 border border-studio-live/20">
                <span className="text-studio-live text-sm shrink-0">!</span>
                <p className="text-sm text-studio-live">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3 bg-studio-accent hover:bg-studio-accent-hover text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 shadow-sm shadow-studio-accent/20 hover:shadow-md hover:shadow-studio-accent/30"
            >
              {loading
                ? isLogin
                  ? 'Signing in...'
                  : 'Creating account...'
                : isLogin
                ? 'Sign in'
                : 'Create account'}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-studio-muted mt-5">
            {isLogin ? (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="text-studio-accent hover:text-studio-accent-hover font-medium transition-colors"
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-studio-accent hover:text-studio-accent-hover font-medium transition-colors"
                >
                  Sign in
                </button>
              </>
            )}
          </p>

          {/* Bottom badge */}
          <div className="mt-8 text-center">
            <p className="text-[10px] text-studio-muted/50">
              liveclaw.tv
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
