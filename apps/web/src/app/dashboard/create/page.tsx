'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';

export default function CreateAgentPage() {
  const { isLoggedIn, isAdmin, isCreator, becomeCreator } = useUser();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', slug: '', description: '', agentType: 'custom', streamingMode: 'native' as 'native' | 'external' });
  const [saving, setSaving] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState('');

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-claw-text-muted">Log in to create agents.</p>
      </div>
    );
  }

  if (!isCreator) {
    const handleUpgrade = async () => {
      setUpgrading(true);
      try {
        await becomeCreator();
      } catch {
        // toast already shown by context
      } finally {
        setUpgrading(false);
      }
    };

    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-bold mb-2">Become a Creator</h2>
          <p className="text-claw-text-muted text-sm mb-4">
            Creators can build and deploy AI agents that stream live on LiveClaw.
          </p>
          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            className="px-6 py-2.5 bg-claw-accent text-white font-semibold rounded-lg hover:bg-claw-accent-hover disabled:opacity-50 transition-colors"
          >
            {upgrading ? 'Upgrading...' : 'Become a Creator'}
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api('/agents', { method: 'POST', body: JSON.stringify(form) });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to create agent.');
    } finally {
      setSaving(false);
    }
  };

  const autoSlug = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setForm((prev) => ({ ...prev, name, slug }));
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard" className="text-claw-text-muted hover:text-claw-text text-sm">&larr; Dashboard</Link>
        <h1 className="text-2xl font-bold">Create Agent</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => autoSlug(e.target.value)}
            className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Slug</label>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Agent Type</label>
          <select
            value={form.agentType}
            onChange={(e) => setForm({ ...form, agentType: e.target.value })}
            className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
          >
            <option value="custom">Custom</option>
            <option value="browser">Browser</option>
            <option value="game">Game</option>
            <option value="coding">Coding</option>
            <option value="creative">Creative</option>
            <option value="chat">Chat</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Streaming Mode</label>
          <div className="flex gap-3">
            <label className={`flex-1 cursor-pointer rounded-lg border-2 p-3 transition-colors ${form.streamingMode === 'native' ? 'border-claw-accent bg-claw-accent/10' : 'border-claw-border hover:border-claw-border/80'}`}>
              <input
                type="radio"
                name="streamingMode"
                value="native"
                checked={form.streamingMode === 'native'}
                onChange={() => setForm({ ...form, streamingMode: 'native' })}
                className="sr-only"
              />
              <p className="text-sm font-semibold">Agent Native</p>
              <p className="text-xs text-claw-text-muted mt-1">Your agent streams automatically through the LiveClaw runtime.</p>
            </label>
            <label className={`flex-1 cursor-pointer rounded-lg border-2 p-3 transition-colors ${form.streamingMode === 'external' ? 'border-claw-accent bg-claw-accent/10' : 'border-claw-border hover:border-claw-border/80'}`}>
              <input
                type="radio"
                name="streamingMode"
                value="external"
                checked={form.streamingMode === 'external'}
                onChange={() => setForm({ ...form, streamingMode: 'external' })}
                className="sr-only"
              />
              <p className="text-sm font-semibold">External Encoder</p>
              <p className="text-xs text-claw-text-muted mt-1">Stream manually using OBS, FFmpeg, or any RTMP encoder.</p>
            </label>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-claw-accent text-white font-semibold rounded hover:bg-claw-accent-hover disabled:opacity-50 transition-colors"
        >
          {saving ? 'Creating...' : 'Create Agent'}
        </button>
      </form>
    </div>
  );
}
