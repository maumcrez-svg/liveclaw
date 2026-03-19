'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';
import { BUILT_IN_TEMPLATES, FRAMEWORK_TEMPLATES, getTemplateById, type AgentTemplate } from '@/lib/agent-templates';
import { agentFromPrompt, parseSkillMd, SKILL_MD_TEMPLATE } from '@/lib/agent-from-prompt';
import TemplateCard from '@/components/dashboard/TemplateCard';
import TemplateConfigForm from '@/components/dashboard/TemplateConfigForm';

const STEPS = ['Template', 'Customize', 'Review'] as const;

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function CreateAgentPage() {
  const { isLoggedIn, isAdmin, isCreator, becomeCreator, setShowLoginModal } = useUser();
  const router = useRouter();

  // Mode toggle
  const [mode, setMode] = useState<'quick' | 'wizard'>('quick');

  // Quick Create state
  const [quickDescription, setQuickDescription] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState('');
  const [showSkillMd, setShowSkillMd] = useState(false);
  const [skillMdText, setSkillMdText] = useState('');

  // Wizard state
  const [step, setStep] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [streamingMode, setStreamingMode] = useState<'native' | 'external'>('native');
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedTemplate = selectedTemplateId ? getTemplateById(selectedTemplateId) : null;

  useEffect(() => {
    api<Category[]>('/categories').then(setCategories).catch(() => {});
  }, []);

  // Logged-out: show template preview with login CTA
  if (!isLoggedIn) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/" className="text-claw-text-muted hover:text-claw-text text-sm">&larr; Home</Link>
          <h1 className="text-2xl font-bold">Create Agent</h1>
        </div>

        {/* Value prop */}
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold mb-2">Pick a template. Name your agent. Go live in minutes.</h2>
          <p className="text-claw-text-muted text-sm mb-4">Log in to create your first AI agent and start streaming.</p>
          <button
            onClick={() => setShowLoginModal(true)}
            className="px-6 py-2.5 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
          >
            Log In to Get Started
          </button>
        </div>

        {/* Template preview (read-only) */}
        <div className="opacity-60 pointer-events-none select-none">
          <h2 className="text-lg font-semibold mb-4">Built-in Templates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {BUILT_IN_TEMPLATES.map((t) => (
              <TemplateCard key={t.id} template={t} selected={false} onClick={() => {}} />
            ))}
          </div>
          <h2 className="text-lg font-semibold mb-4">Framework Agents</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FRAMEWORK_TEMPLATES.map((t) => (
              <TemplateCard key={t.id} template={t} selected={false} onClick={() => {}} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Auto-become-creator helper — used by both Quick Create and Wizard
  const ensureCreator = async (): Promise<boolean> => {
    if (isCreator) return true;
    try {
      await becomeCreator();
      return true;
    } catch {
      return false;
    }
  };

  // Helpers
  const autoSlug = (val: string) => {
    const s = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setName(val);
    setSlug(s);
  };

  const selectTemplate = (t: AgentTemplate) => {
    setSelectedTemplateId(t.id);
    setDescription(t.description);
    setStreamingMode(t.streamingMode);
    setConfig({ ...t.defaultConfig });
  };

  const resolveCategoryId = (): string | undefined => {
    if (!selectedTemplate) return undefined;
    const cat = categories.find((c) => c.slug === selectedTemplate.suggestedCategory);
    return cat?.id;
  };

  // Quick Create submit
  const handleQuickCreate = async () => {
    if (!quickDescription.trim()) return;
    setQuickSaving(true);
    setQuickError('');

    try {
      const ok = await ensureCreator();
      if (!ok) {
        setQuickError('Could not upgrade to creator. Please try again.');
        return;
      }

      const payload = agentFromPrompt(quickDescription, quickName || undefined, categories);
      await api('/agents', { method: 'POST', body: JSON.stringify(payload) });
      router.push(`/dashboard/${payload.slug}/stream?welcome=true`);
    } catch (err: any) {
      setQuickError(err.message || 'Failed to create agent.');
    } finally {
      setQuickSaving(false);
    }
  };

  // skill.md submit
  const handleSkillMdCreate = async () => {
    if (!skillMdText.trim()) return;
    setQuickSaving(true);
    setQuickError('');

    try {
      const payload = parseSkillMd(skillMdText, categories);
      if (!payload) {
        setQuickError('Invalid skill.md format. Make sure it has --- frontmatter --- at the top.');
        return;
      }

      const ok = await ensureCreator();
      if (!ok) {
        setQuickError('Could not upgrade to creator. Please try again.');
        return;
      }

      await api('/agents', { method: 'POST', body: JSON.stringify(payload) });
      router.push(`/dashboard/${payload.slug}/stream?welcome=true`);
    } catch (err: any) {
      setQuickError(err.message || 'Failed to create agent.');
    } finally {
      setQuickSaving(false);
    }
  };

  // Wizard Create submit
  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      // Auto-upgrade to creator if needed
      const ok = await ensureCreator();
      if (!ok) {
        setError('Could not upgrade to creator. Please try again.');
        return;
      }

      const payload: Record<string, unknown> = {
        name,
        slug,
        description,
        agentType: selectedTemplate!.agentType,
        streamingMode,
        config: { ...selectedTemplate!.defaultConfig, ...config },
        instructions: selectedTemplate!.defaultInstructions,
        defaultTags: selectedTemplate!.tags,
      };
      const categoryId = resolveCategoryId();
      if (categoryId) payload.defaultCategoryId = categoryId;

      await api('/agents', { method: 'POST', body: JSON.stringify(payload) });
      router.push(`/dashboard/${slug}/stream?welcome=true`);
    } catch (err: any) {
      setError(err.message || 'Failed to create agent.');
    } finally {
      setSaving(false);
    }
  };

  const canProceedStep0 = !!selectedTemplateId;
  const canProceedStep1 = name.trim() !== '' && slug.trim() !== '';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard" className="text-claw-text-muted hover:text-claw-text text-sm">&larr; Dashboard</Link>
        <h1 className="text-2xl font-bold">Create Agent</h1>
      </div>

      {/* Mode toggle */}
      <div className="flex mb-6 bg-claw-bg rounded-lg p-0.5 border border-claw-border w-fit">
        <button
          onClick={() => setMode('quick')}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
            mode === 'quick' ? 'bg-claw-card text-claw-text shadow-sm' : 'text-claw-text-muted hover:text-claw-text'
          }`}
        >
          Quick Create
        </button>
        <button
          onClick={() => setMode('wizard')}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
            mode === 'wizard' ? 'bg-claw-card text-claw-text shadow-sm' : 'text-claw-text-muted hover:text-claw-text'
          }`}
        >
          Advanced Wizard
        </button>
      </div>

      {/* ─── Quick Create Mode ─── */}
      {mode === 'quick' && (
        <div className="max-w-xl">
          <p className="text-claw-text-muted text-sm mb-4">
            Describe your AI agent and we'll set everything up. You can customize later.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name <span className="text-claw-text-muted font-normal">(optional)</span></label>
              <input
                type="text"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
                placeholder="e.g. CryptoBot, CodeWizard, ChillChat"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Describe your agent *</label>
              <textarea
                value={quickDescription}
                onChange={(e) => setQuickDescription(e.target.value)}
                rows={4}
                className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
                placeholder="e.g. An AI that plays retro games and chats with viewers, or a crypto trader that analyzes charts and explains market trends..."
              />
              <p className="text-xs text-claw-text-muted mt-1">This becomes your agent's instructions. Be as descriptive as you want.</p>
            </div>

            {quickError && <p className="text-red-400 text-sm">{quickError}</p>}

            <button
              onClick={handleQuickCreate}
              disabled={quickSaving || !quickDescription.trim()}
              className="px-6 py-2.5 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {quickSaving ? 'Creating...' : 'Create & Go Live'}
            </button>

            {/* skill.md section */}
            <div className="pt-4 border-t border-claw-border">
              <button
                type="button"
                onClick={() => {
                  setShowSkillMd(!showSkillMd);
                  if (!skillMdText) setSkillMdText(SKILL_MD_TEMPLATE);
                }}
                className="text-xs text-claw-text-muted hover:text-claw-accent transition-colors"
              >
                {showSkillMd ? 'Hide skill.md editor' : 'Or paste a skill.md'}
              </button>

              {showSkillMd && (
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-claw-text-muted">
                    Paste a skill.md file with YAML frontmatter to configure your agent. Edit the template below or paste your own.
                  </p>
                  <textarea
                    value={skillMdText}
                    onChange={(e) => setSkillMdText(e.target.value)}
                    rows={14}
                    className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-xs text-claw-text font-mono focus:outline-none focus:border-claw-accent"
                    spellCheck={false}
                  />
                  <button
                    onClick={handleSkillMdCreate}
                    disabled={quickSaving || !skillMdText.trim()}
                    className="px-6 py-2.5 bg-claw-accent text-white font-semibold rounded-lg hover:bg-claw-accent-hover disabled:opacity-50 transition-colors"
                  >
                    {quickSaving ? 'Creating...' : 'Create from skill.md'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Advanced Wizard Mode ─── */}
      {mode === 'wizard' && (
        <>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 ${i <= step ? 'text-claw-accent' : 'text-claw-text-muted'}`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                    i < step
                      ? 'bg-claw-accent border-claw-accent text-white'
                      : i === step
                        ? 'border-claw-accent text-claw-accent'
                        : 'border-claw-border text-claw-text-muted'
                  }`}>
                    {i < step ? '\u2713' : i + 1}
                  </span>
                  <span className="text-sm font-medium hidden sm:inline">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 sm:w-16 h-0.5 ${i < step ? 'bg-claw-accent' : 'bg-claw-border'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 0: Pick Template */}
          {step === 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Built-in Templates</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                {BUILT_IN_TEMPLATES.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    selected={selectedTemplateId === t.id}
                    onClick={() => selectTemplate(t)}
                  />
                ))}
              </div>

              <h2 className="text-lg font-semibold mb-4">Framework Agents</h2>
              <p className="text-xs text-claw-text-muted mb-3">Requires running your own instance. Use external streaming mode.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                {FRAMEWORK_TEMPLATES.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    selected={selectedTemplateId === t.id}
                    onClick={() => selectTemplate(t)}
                  />
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setStep(1)}
                  disabled={!canProceedStep0}
                  className="px-6 py-2 bg-claw-accent text-white font-semibold rounded hover:bg-claw-accent-hover disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Customize */}
          {step === 1 && selectedTemplate && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{selectedTemplate.icon}</span>
                <h2 className="text-lg font-semibold">{selectedTemplate.name}</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => autoSlug(e.target.value)}
                    className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
                    placeholder="My Awesome Agent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Slug *</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
                    placeholder="my-awesome-agent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
                />
              </div>

              {/* Streaming Mode */}
              <div>
                <label className="block text-sm font-medium mb-1">Streaming Mode</label>
                <div className="flex gap-3">
                  <label className={`flex-1 cursor-pointer rounded-lg border-2 p-3 transition-colors ${streamingMode === 'native' ? 'border-claw-accent bg-claw-accent/10' : 'border-claw-border hover:border-claw-border/80'}`}>
                    <input type="radio" name="streamingMode" value="native" checked={streamingMode === 'native'} onChange={() => setStreamingMode('native')} className="sr-only" />
                    <p className="text-sm font-semibold">Hosted by LiveClaw (automatic)</p>
                    <p className="text-xs text-claw-text-muted mt-1">We run your agent and stream it for you. No setup required.</p>
                  </label>
                  <label className={`flex-1 cursor-pointer rounded-lg border-2 p-3 transition-colors ${streamingMode === 'external' ? 'border-claw-accent bg-claw-accent/10' : 'border-claw-border hover:border-claw-border/80'}`}>
                    <input type="radio" name="streamingMode" value="external" checked={streamingMode === 'external'} onChange={() => setStreamingMode('external')} className="sr-only" />
                    <p className="text-sm font-semibold">Self-hosted (OBS/FFmpeg)</p>
                    <p className="text-xs text-claw-text-muted mt-1">You run your agent and stream via OBS, FFmpeg, or any RTMP encoder.</p>
                  </label>
                </div>
                {selectedTemplate.streamingMode === 'external' && streamingMode !== 'external' && (
                  <p className="text-xs text-yellow-400 mt-1.5">This template recommends self-hosted mode.</p>
                )}
              </div>

              {/* Template config fields */}
              {selectedTemplate.configFields.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 text-claw-text-muted uppercase tracking-wide">Template Configuration</h3>
                  <TemplateConfigForm
                    fields={selectedTemplate.configFields}
                    config={config}
                    onChange={setConfig}
                  />
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button onClick={() => setStep(0)} className="px-6 py-2 border border-claw-border text-claw-text rounded hover:bg-claw-border/20 transition-colors">
                  Back
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                  className="px-6 py-2 bg-claw-accent text-white font-semibold rounded hover:bg-claw-accent-hover disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Review & Create */}
          {step === 2 && selectedTemplate && (
            <div className="space-y-6">
              <div className="bg-claw-bg border border-claw-border rounded-lg p-5 space-y-3">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-3xl">{selectedTemplate.icon}</span>
                  <div>
                    <h2 className="text-lg font-bold">{name}</h2>
                    <p className="text-xs text-claw-text-muted">/{slug} &middot; {selectedTemplate.name} template</p>
                  </div>
                </div>

                <p className="text-sm text-claw-text-muted">{description}</p>

                <div className="grid grid-cols-2 gap-3 text-sm pt-2">
                  <div>
                    <span className="text-claw-text-muted text-xs">Agent Type</span>
                    <p className="font-medium">{selectedTemplate.agentType}</p>
                  </div>
                  <div>
                    <span className="text-claw-text-muted text-xs">Streaming Mode</span>
                    <p className="font-medium">{streamingMode === 'native' ? 'Hosted by LiveClaw' : 'Self-hosted'}</p>
                  </div>
                  <div>
                    <span className="text-claw-text-muted text-xs">Category</span>
                    <p className="font-medium">{selectedTemplate.suggestedCategory}</p>
                  </div>
                  <div>
                    <span className="text-claw-text-muted text-xs">Tags</span>
                    <p className="font-medium">{selectedTemplate.tags.join(', ')}</p>
                  </div>
                </div>

                {/* Config summary */}
                {Object.keys(config).length > 0 && (
                  <div className="pt-3 border-t border-claw-border">
                    <h3 className="text-xs font-semibold text-claw-text-muted uppercase tracking-wide mb-2">Configuration</h3>
                    <div className="space-y-1">
                      {renderConfigSummary(config)}
                    </div>
                  </div>
                )}
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="flex justify-between">
                <button onClick={() => setStep(1)} className="px-6 py-2 border border-claw-border text-claw-text rounded hover:bg-claw-border/20 transition-colors">
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="px-6 py-2 bg-claw-accent text-white font-semibold rounded hover:bg-claw-accent-hover disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Creating...' : 'Create Agent'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function renderConfigSummary(obj: Record<string, unknown>, prefix = ''): React.ReactNode[] {
  const items: React.ReactNode[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      items.push(...renderConfigSummary(value as Record<string, unknown>, fullKey));
    } else {
      const display = Array.isArray(value) ? value.join(', ') : String(value ?? '');
      if (display && display !== '' && key !== 'apiKey') {
        items.push(
          <div key={fullKey} className="flex justify-between text-xs">
            <span className="text-claw-text-muted">{fullKey}</span>
            <span className="text-claw-text font-medium truncate ml-4 max-w-[60%] text-right">{display}</span>
          </div>
        );
      }
    }
  }
  return items;
}
