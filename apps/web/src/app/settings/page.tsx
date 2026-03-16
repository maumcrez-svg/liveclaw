'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user, isLoggedIn, updateUser } = useUser();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/');
      return;
    }
    if (user) {
      setUsername(user.username);
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user, isLoggedIn, router]);

  if (!isLoggedIn || !user) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 20) {
      errs.username = 'Username must be 3-20 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      errs.username = 'Only letters, numbers, and underscores';
    }
    if (avatarUrl && avatarUrl.trim()) {
      try {
        new URL(avatarUrl.trim());
      } catch {
        errs.avatarUrl = 'Must be a valid URL';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body: Record<string, any> = {};
      const trimmedUsername = username.trim();
      if (trimmedUsername !== user.username) body.username = trimmedUsername;
      const trimmedAvatar = avatarUrl.trim() || null;
      if (trimmedAvatar !== (user.avatarUrl || null)) body.avatarUrl = trimmedAvatar;

      if (Object.keys(body).length === 0) {
        toast.info('No changes to save');
        setSaving(false);
        return;
      }

      const res = await api<{ access_token: string; user: { id: string; username: string; role: string; avatarUrl: string | null; walletAddress: string | null } }>(
        '/users/me',
        { method: 'PATCH', body: JSON.stringify(body) },
      );

      updateUser({
        username: res.user.username,
        token: res.access_token,
        role: res.user.role,
        avatarUrl: res.user.avatarUrl,
        walletAddress: res.user.walletAddress,
      });
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const initial = user.avatarUrl
    ? null
    : user.username[0]?.toUpperCase();

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-claw-text mb-6">Profile Settings</h1>

      <div className="bg-claw-surface border border-claw-border rounded-lg p-6 space-y-6">
        {/* Avatar preview */}
        <div className="flex items-center gap-4">
          {avatarUrl.trim() ? (
            <img
              src={avatarUrl.trim()}
              alt="Avatar"
              className="w-16 h-16 rounded-full object-cover border-2 border-claw-border"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-claw-accent flex items-center justify-center text-white text-xl font-bold border-2 border-claw-border">
              {initial}
            </div>
          )}
          <div className="text-sm text-claw-text-muted">
            <p className="font-medium text-claw-text">{user.username}</p>
            <p>{user.role}</p>
          </div>
        </div>

        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-claw-text mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            className="w-full border border-claw-border bg-claw-bg rounded-md px-3 py-2 text-sm text-claw-text placeholder:text-claw-text-muted focus:outline-none focus:ring-2 focus:ring-claw-accent focus:border-claw-accent"
          />
          {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
          <p className="text-xs text-claw-text-muted mt-1">3-20 characters, letters, numbers, and underscores only</p>
        </div>

        {/* Avatar URL */}
        <div>
          <label className="block text-sm font-medium text-claw-text mb-1">Avatar URL</label>
          <input
            type="text"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.png"
            className="w-full border border-claw-border bg-claw-bg rounded-md px-3 py-2 text-sm text-claw-text placeholder:text-claw-text-muted focus:outline-none focus:ring-2 focus:ring-claw-accent focus:border-claw-accent"
          />
          {errors.avatarUrl && <p className="text-red-500 text-xs mt-1">{errors.avatarUrl}</p>}
          <p className="text-xs text-claw-text-muted mt-1">Direct link to an image. Leave blank to use default.</p>
        </div>

        {/* Wallet address (read-only) */}
        {user.walletAddress && (
          <div>
            <label className="block text-sm font-medium text-claw-text mb-1">Wallet Address</label>
            <div className="w-full border border-claw-border bg-claw-card rounded-md px-3 py-2 text-sm text-claw-text-muted font-mono truncate">
              {user.walletAddress}
            </div>
            <p className="text-xs text-claw-text-muted mt-1">Connected via MetaMask (read-only)</p>
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 bg-claw-accent text-white text-sm font-semibold rounded-md hover:bg-claw-accent-hover disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
