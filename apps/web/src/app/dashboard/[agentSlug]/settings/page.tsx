'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';

export default function AgentSettingsPage({ params }: { params: { agentSlug: string } }) {
  const { isLoggedIn } = useUser();
  const [agent, setAgent] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    avatarUrl: '',
    bannerUrl: '',
    welcomeMessage: '',
    donationWalletAddress: '',
    defaultCategoryId: '',
    defaultTags: '',
    instructions: '',
    streamingMode: 'native' as 'native' | 'external',
  });

  useEffect(() => {
    if (!isLoggedIn) return;
    Promise.all([
      api(`/agents/${params.agentSlug}/private`),
      api('/categories').catch(() => []),
    ]).then(([agentData, cats]) => {
      setAgent(agentData);
      setCategories(cats);
      setForm({
        name: agentData.name || '',
        description: agentData.description || '',
        avatarUrl: agentData.avatarUrl || '',
        bannerUrl: agentData.bannerUrl || '',
        welcomeMessage: agentData.welcomeMessage || '',
        donationWalletAddress: agentData.donationWalletAddress || '',
        defaultCategoryId: agentData.defaultCategoryId || '',
        defaultTags: (agentData.defaultTags || []).join(', '),
        instructions: agentData.instructions || '',
        streamingMode: agentData.streamingMode || 'native',
      });
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, [isLoggedIn, params.agentSlug]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        avatarUrl: form.avatarUrl || null,
        bannerUrl: form.bannerUrl || null,
        welcomeMessage: form.welcomeMessage || null,
        donationWalletAddress: form.donationWalletAddress || null,
        defaultCategoryId: form.defaultCategoryId || null,
        defaultTags: form.defaultTags ? form.defaultTags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        instructions: form.instructions || null,
        streamingMode: form.streamingMode,
      };
      const updated = await api(`/agents/${agent.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      setAgent(updated);
      toast.success('Settings saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!isLoggedIn) {
    return <div className="flex items-center justify-center h-full"><p className="text-claw-text-muted">Log in to access settings.</p></div>;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-claw-accent border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!agent) {
    return <div className="flex items-center justify-center h-full"><p className="text-claw-text-muted">Agent not found or access denied.</p></div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/dashboard/${params.agentSlug}`} className="text-claw-text-muted hover:text-claw-text text-sm">&larr; Back</Link>
        <h1 className="text-2xl font-bold">Settings — {agent.name}</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <Field label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} textarea />
        <Field label="Avatar URL" value={form.avatarUrl} onChange={(v) => setForm({ ...form, avatarUrl: v })} placeholder="https://..." />
        <Field label="Banner URL" value={form.bannerUrl} onChange={(v) => setForm({ ...form, bannerUrl: v })} placeholder="https://..." />
        <Field label="Welcome Message" value={form.welcomeMessage} onChange={(v) => setForm({ ...form, welcomeMessage: v })} textarea />
        <Field label="Donation Wallet Address" value={form.donationWalletAddress} onChange={(v) => setForm({ ...form, donationWalletAddress: v })} />

        <div>
          <label className="block text-sm font-medium mb-1">Default Category</label>
          <select
            value={form.defaultCategoryId}
            onChange={(e) => setForm({ ...form, defaultCategoryId: e.target.value })}
            className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
          >
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <Field label="Default Tags (comma separated)" value={form.defaultTags} onChange={(v) => setForm({ ...form, defaultTags: v })} placeholder="ai, coding, browser" />
        <Field label="Instructions" value={form.instructions} onChange={(v) => setForm({ ...form, instructions: v })} textarea rows={6} placeholder="System prompt / instructions for this agent..." />

        <div>
          <label className="block text-sm font-medium mb-1">Streaming Mode</label>
          <select
            value={form.streamingMode}
            onChange={(e) => setForm({ ...form, streamingMode: e.target.value as 'native' | 'external' })}
            disabled={agent.status !== 'offline'}
            className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent disabled:opacity-50"
          >
            <option value="native">Agent Native — streams automatically via runtime</option>
            <option value="external">External Encoder — use OBS or RTMP encoder</option>
          </select>
          {agent.status !== 'offline' && (
            <p className="text-xs text-claw-text-muted mt-1">Switch streaming mode when your agent is offline.</p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-claw-accent text-white font-semibold rounded hover:bg-claw-accent-hover disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, required, textarea, rows,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; textarea?: boolean; rows?: number;
}) {
  const cls = "w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text placeholder:text-claw-text-muted focus:outline-none focus:border-claw-accent";
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} rows={rows || 3} className={cls} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} className={cls} />
      )}
    </div>
  );
}
