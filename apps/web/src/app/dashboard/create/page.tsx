'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';
import {
  BUILT_IN_TEMPLATES,
  FRAMEWORK_TEMPLATES,
  getTemplateById,
  type AgentTemplate,
  type ConfigField,
} from '@/lib/agent-templates';
import { agentFromPrompt, parseSkillMd, SKILL_MD_TEMPLATE } from '@/lib/agent-from-prompt';
import { generateInstructions, PERSONALITY_TONES } from '@/lib/generate-instructions';
import TemplateCard from '@/components/dashboard/TemplateCard';
import TemplateConfigForm from '@/components/dashboard/TemplateConfigForm';

const STEP_LABELS = ['Template', 'Identity', 'Configure', 'Review'];

interface Category {
  id: string;
  name: string;
  slug: string;
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */

export default function CreateAgentPage() {
  const { isLoggedIn, isCreator, becomeCreator, setShowLoginModal } = useUser();
  const router = useRouter();

  // Mode: wizard (default for everyone) vs advanced (power users)
  const [mode, setMode] = useState<'wizard' | 'advanced'>('wizard');

  // ── Wizard State ──
  const [step, setStep] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [tone, setTone] = useState('friendly');
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [showEditInstructions, setShowEditInstructions] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [createdAgent, setCreatedAgent] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── Go Live State ──
  const [obsReady, setObsReady] = useState(false);
  const [detailsCopied, setDetailsCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Advanced Mode State ──
  const [quickDescription, setQuickDescription] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState('');
  const [showSkillMd, setShowSkillMd] = useState(false);
  const [skillMdText, setSkillMdText] = useState('');

  const selectedTemplate = selectedTemplateId ? getTemplateById(selectedTemplateId) : null;

  // Load categories
  useEffect(() => {
    api<Category[]>('/categories').then(setCategories).catch(() => {});
  }, []);

  // Generate instructions reactively
  const generatedInstructions =
    selectedTemplateId && name
      ? generateInstructions({ templateId: selectedTemplateId, name, description, tone, config })
      : '';

  // Sync custom instructions when not manually editing
  useEffect(() => {
    if (!showEditInstructions && generatedInstructions) {
      setCustomInstructions(generatedInstructions);
    }
  }, [generatedInstructions, showEditInstructions]);

  // Poll agent status on Go Live step (max 5 minutes)
  useEffect(() => {
    if (step !== 4 || !createdAgent) return;
    if (createdAgent.status === 'live') return;
    let retries = 0;
    const MAX_RETRIES = 60; // 60 × 5s = 5 minutes
    const poll = setInterval(async () => {
      retries++;
      if (retries > MAX_RETRIES) {
        clearInterval(poll);
        return;
      }
      try {
        const updated = await api(`/agents/${createdAgent.slug}/private`);
        setCreatedAgent(updated);
        if (updated.status === 'live') clearInterval(poll);
      } catch {}
    }, 5000);
    return () => clearInterval(poll);
  }, [step, createdAgent?.slug, createdAgent?.status]);

  // ── Helpers ──

  const autoSlug = (val: string) => {
    setName(val);
    setSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40),
    );
  };

  const selectTemplate = (t: AgentTemplate) => {
    setSelectedTemplateId(t.id);
    setConfig({ ...t.defaultConfig });
    // Don't overwrite user's description if they've already typed one
    if (!description) setDescription(t.description);
  };

  const ensureCreator = async (): Promise<boolean> => {
    if (isCreator) return true;
    try {
      await becomeCreator();
      return true;
    } catch {
      return false;
    }
  };

  const resolveCategoryId = (): string | undefined => {
    if (!selectedTemplate) return undefined;
    return categories.find((c) => c.slug === selectedTemplate.suggestedCategory)?.id;
  };

  // ── Wizard Create ──

  const handleCreate = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    setError('');
    try {
      const ok = await ensureCreator();
      if (!ok) {
        setError('Could not upgrade to creator. Please try again.');
        return;
      }
      const instructions = showEditInstructions ? customInstructions : generatedInstructions;
      const payload: Record<string, unknown> = {
        name,
        slug,
        description,
        agentType: selectedTemplate.agentType,
        streamingMode: selectedTemplate.streamingMode,
        config: { ...selectedTemplate.defaultConfig, ...config },
        instructions,
        defaultTags: selectedTemplate.tags,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(slug)}`,
      };
      const categoryId = resolveCategoryId();
      if (categoryId) payload.defaultCategoryId = categoryId;

      const agent = await api('/agents', { method: 'POST', body: JSON.stringify(payload) });
      setCreatedAgent(agent);
      setStep(4);
    } catch (err: any) {
      setError(err.message || 'Failed to create agent.');
    } finally {
      setSaving(false);
    }
  };

  // ── Native Mode Start ──

  const handleStartAgent = async () => {
    if (!createdAgent) return;
    setActionLoading(true);
    try {
      await api(`/runtime/${createdAgent.id}/start`, { method: 'POST' });
      toast.success('Agent starting...');
    } catch (err: any) {
      toast.error(err.message || 'Failed to start agent');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Advanced Mode Handlers ──

  const handleQuickCreate = async () => {
    if (!quickDescription.trim()) return;
    setQuickSaving(true);
    setQuickError('');
    try {
      const ok = await ensureCreator();
      if (!ok) {
        setQuickError('Could not upgrade to creator.');
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
        setQuickError('Could not upgrade to creator.');
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

  // ── Validation ──

  const canProceedStep0 = !!selectedTemplateId;
  const canProceedStep1 = name.trim().length >= 2 && slug.trim().length >= 2;

  // ── Logged-out ──

  if (!isLoggedIn) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center mb-8 pt-8">
          <h1 className="text-3xl font-bold mb-2">Create Your AI Agent</h1>
          <p className="text-claw-text-muted mb-6">
            Pick a template, name your agent, and go live in minutes.
          </p>
          <button
            onClick={() => setShowLoginModal(true)}
            className="px-8 py-3 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-colors text-lg"
          >
            Log In to Get Started
          </button>
        </div>
        <div className="opacity-50 pointer-events-none select-none">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {BUILT_IN_TEMPLATES.map((t) => (
              <TemplateCard key={t.id} template={t} selected={false} onClick={() => {}} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Render ──

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-claw-text-muted hover:text-claw-text text-sm"
          >
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Create Agent</h1>
        </div>
        {step < 4 && (
          <button
            onClick={() => setMode(mode === 'wizard' ? 'advanced' : 'wizard')}
            className="text-xs text-claw-text-muted hover:text-claw-accent transition-colors"
          >
            {mode === 'wizard' ? 'Advanced Mode' : 'Wizard Mode'}
          </button>
        )}
      </div>

      {mode === 'wizard' ? (
        <>
          {/* Progress bar — hidden on Go Live step */}
          {step < 4 && <ProgressBar current={step} labels={STEP_LABELS} />}

          {/* ─── Step 0: Template ─── */}
          {step === 0 && (
            <div>
              <h2 className="text-xl font-bold mb-1">What kind of agent do you want?</h2>
              <p className="text-sm text-claw-text-muted mb-6">
                Pick a starting point. You&apos;ll customize everything next.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                {BUILT_IN_TEMPLATES.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    selected={selectedTemplateId === t.id}
                    onClick={() => selectTemplate(t)}
                  />
                ))}
              </div>

              <details className="mb-6">
                <summary className="text-sm text-claw-text-muted cursor-pointer hover:text-claw-text">
                  Framework Agents (for developers)
                </summary>
                <p className="text-xs text-claw-text-muted mt-2 mb-3">
                  These require running your own agent. Recommended for experienced developers.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {FRAMEWORK_TEMPLATES.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      selected={selectedTemplateId === t.id}
                      onClick={() => selectTemplate(t)}
                    />
                  ))}
                </div>
              </details>

              <div className="flex justify-end">
                <button
                  onClick={() => setStep(1)}
                  disabled={!canProceedStep0}
                  className="px-8 py-2.5 bg-claw-accent text-white font-semibold rounded-lg hover:bg-claw-accent-hover disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 1: Identity ─── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-1">Name your agent</h2>
                <p className="text-sm text-claw-text-muted">
                  Give it a name and describe what it does.
                </p>
              </div>

              {/* Name + live preview */}
              <div className="flex gap-5 items-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(slug || 'agent')}`}
                  alt="avatar"
                  className="w-16 h-16 rounded-full bg-claw-bg border border-claw-border flex-shrink-0"
                />
                <div className="flex-1 space-y-1">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => autoSlug(e.target.value)}
                    placeholder="e.g. DeFi Oracle, ChillBot, CodeMonkey"
                    className="w-full bg-claw-bg border border-claw-border rounded-lg px-4 py-3 text-lg text-claw-text font-semibold focus:outline-none focus:border-claw-accent"
                    autoFocus
                  />
                  {slug && (
                    <p className="text-xs text-claw-text-muted">
                      liveclaw.com/<span className="text-claw-accent">{slug}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  What does your agent do?
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-claw-bg border border-claw-border rounded-lg px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
                  placeholder="e.g. Tracks DeFi protocols and explains yield farming strategies to viewers..."
                />
              </div>

              {/* Personality tone */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  How should it talk?
                </label>
                <div className="flex flex-wrap gap-2">
                  {PERSONALITY_TONES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTone(t.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        tone === t.id
                          ? 'bg-claw-accent text-white shadow-sm'
                          : 'bg-claw-bg border border-claw-border text-claw-text-muted hover:border-claw-accent/50'
                      }`}
                    >
                      <span className="mr-1.5">{t.emoji}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-claw-text-muted mt-1.5">
                  {PERSONALITY_TONES.find((t) => t.id === tone)?.desc}
                </p>
              </div>

              <StepNav
                onBack={() => setStep(0)}
                onNext={() => setStep(2)}
                nextDisabled={!canProceedStep1}
              />
            </div>
          )}

          {/* ─── Step 2: Configure ─── */}
          {step === 2 && selectedTemplate && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-1">
                  Customize your {selectedTemplate.name}
                </h2>
                <p className="text-sm text-claw-text-muted">
                  Defaults are already filled in. Change only what you want.
                </p>
              </div>

              {/* Simple config fields */}
              {(() => {
                const simpleFields = selectedTemplate.configFields.filter(
                  (f) => !f.advanced,
                );
                const advancedFields = selectedTemplate.configFields.filter(
                  (f) => f.advanced,
                );

                return (
                  <>
                    {simpleFields.length > 0 ? (
                      <TemplateConfigForm
                        fields={simpleFields}
                        config={config}
                        onChange={setConfig}
                      />
                    ) : (
                      <div className="bg-claw-bg border border-claw-border rounded-lg p-6 text-center">
                        <p className="text-claw-text-muted text-sm">
                          This template works great with defaults. You can skip ahead.
                        </p>
                      </div>
                    )}

                    {/* Advanced config toggle */}
                    {advancedFields.length > 0 && (
                      <div className="border-t border-claw-border pt-4">
                        <button
                          type="button"
                          onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                          className="text-xs text-claw-text-muted hover:text-claw-accent transition-colors"
                        >
                          {showAdvancedConfig
                            ? 'Hide advanced settings'
                            : `Show advanced settings (${advancedFields.length})`}
                        </button>
                        {showAdvancedConfig && (
                          <div className="mt-4">
                            <TemplateConfigForm
                              fields={advancedFields}
                              config={config}
                              onChange={setConfig}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}

              <StepNav onBack={() => setStep(1)} onNext={() => setStep(3)} />
            </div>
          )}

          {/* ─── Step 3: Review ─── */}
          {step === 3 && selectedTemplate && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Ready to create?</h2>

              {/* Agent preview card */}
              <div className="bg-claw-card border border-claw-border rounded-lg p-5">
                <div className="flex items-center gap-4 mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(slug || 'agent')}`}
                    alt="avatar"
                    className="w-14 h-14 rounded-full bg-claw-bg border border-claw-border"
                  />
                  <div>
                    <h3 className="text-lg font-bold">{name}</h3>
                    <p className="text-xs text-claw-text-muted">
                      liveclaw.com/{slug} &middot; {selectedTemplate.name}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-claw-text-muted mb-4">{description}</p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <ReviewField label="Category" value={selectedTemplate.suggestedCategory} />
                  <ReviewField
                    label="Personality"
                    value={PERSONALITY_TONES.find((t) => t.id === tone)?.label || tone}
                  />
                  <ReviewField
                    label="Streaming"
                    value={
                      selectedTemplate.streamingMode === 'native'
                        ? 'Automatic (hosted)'
                        : 'Self-hosted (OBS)'
                    }
                  />
                </div>

                {selectedTemplate.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {selectedTemplate.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] bg-claw-bg border border-claw-border px-2 py-0.5 rounded text-claw-text-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Generated instructions */}
              <div className="bg-claw-card border border-claw-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">Agent Instructions</h3>
                  <button
                    type="button"
                    onClick={() => setShowEditInstructions(!showEditInstructions)}
                    className="text-xs text-claw-text-muted hover:text-claw-accent transition-colors"
                  >
                    {showEditInstructions ? 'Use generated' : 'Edit manually'}
                  </button>
                </div>
                {showEditInstructions ? (
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    rows={10}
                    className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-xs font-mono text-claw-text focus:outline-none focus:border-claw-accent"
                  />
                ) : (
                  <pre className="bg-claw-bg border border-claw-border rounded p-3 text-xs font-mono text-claw-text-muted whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                    {generatedInstructions || 'Instructions will be generated...'}
                  </pre>
                )}
                <p className="text-xs text-claw-text-muted mt-2">
                  This is your agent&apos;s brain. It tells the AI how to behave on stream.
                </p>
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  {error}
                </p>
              )}

              <div className="flex justify-between items-center">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-2 border border-claw-border text-claw-text rounded-lg hover:bg-claw-border/20 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="px-8 py-3 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors text-lg"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    'Create Agent'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 4: Go Live ─── */}
          {step === 4 && createdAgent && (
            <GoLiveGuide
              agent={createdAgent}
              obsReady={obsReady}
              setObsReady={setObsReady}
              detailsCopied={detailsCopied}
              setDetailsCopied={setDetailsCopied}
              actionLoading={actionLoading}
              onStartAgent={handleStartAgent}
            />
          )}
        </>
      ) : (
        /* ─── Advanced Mode ─── */
        <AdvancedCreateMode
          quickName={quickName}
          setQuickName={setQuickName}
          quickDescription={quickDescription}
          setQuickDescription={setQuickDescription}
          quickSaving={quickSaving}
          quickError={quickError}
          onQuickCreate={handleQuickCreate}
          showSkillMd={showSkillMd}
          setShowSkillMd={setShowSkillMd}
          skillMdText={skillMdText}
          setSkillMdText={setSkillMdText}
          onSkillMdCreate={handleSkillMdCreate}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════ */

function ProgressBar({ current, labels }: { current: number; labels: string[] }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center gap-1">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                i < current
                  ? 'bg-claw-accent border-claw-accent text-white'
                  : i === current
                    ? 'border-claw-accent text-claw-accent'
                    : 'border-claw-border text-claw-text-muted'
              }`}
            >
              {i < current ? '\u2713' : i + 1}
            </div>
            <span
              className={`text-[10px] font-medium hidden sm:block ${
                i <= current ? 'text-claw-accent' : 'text-claw-text-muted'
              }`}
            >
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <div
              className={`w-8 sm:w-16 h-0.5 mb-4 sm:mb-0 ${
                i < current ? 'bg-claw-accent' : 'bg-claw-border'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function StepNav({
  onBack,
  onNext,
  nextDisabled,
  nextLabel = 'Next',
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="flex justify-between pt-2">
      <button
        onClick={onBack}
        className="px-6 py-2 border border-claw-border text-claw-text rounded-lg hover:bg-claw-border/20 transition-colors"
      >
        Back
      </button>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="px-8 py-2.5 bg-claw-accent text-white font-semibold rounded-lg hover:bg-claw-accent-hover disabled:opacity-40 transition-colors"
      >
        {nextLabel}
      </button>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-claw-text-muted text-xs block">{label}</span>
      <span className="font-medium text-sm">{value}</span>
    </div>
  );
}

/* ─── Go Live Guide ─── */

function GoLiveGuide({
  agent,
  obsReady,
  setObsReady,
  detailsCopied,
  setDetailsCopied,
  actionLoading,
  onStartAgent,
}: {
  agent: any;
  obsReady: boolean;
  setObsReady: (v: boolean) => void;
  detailsCopied: boolean;
  setDetailsCopied: (v: boolean) => void;
  actionLoading: boolean;
  onStartAgent: () => void;
}) {
  const isExternal = agent.streamingMode === 'external';
  const isLive = agent.status === 'live';
  const isStarting = agent.status === 'starting';
  const rtmpServer = process.env.NEXT_PUBLIC_RTMP_URL || 'rtmp://localhost:1935';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
    setDetailsCopied(true);
  };

  // ── Success State ──
  if (isLive) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">{'\u{1F389}'}</div>
        <h2 className="text-3xl font-bold mb-2">You&apos;re live!</h2>
        <p className="text-claw-text-muted mb-6">
          <strong>{agent.name}</strong> is streaming right now.
        </p>
        <div className="flex flex-col items-center gap-3">
          <CopyField
            label="Share your channel"
            value={`liveclaw.com/${agent.slug}`}
            onCopy={() => copyToClipboard(`https://liveclaw.com/${agent.slug}`, 'Channel link')}
          />
          <div className="flex gap-3 mt-4">
            <a
              href={`/${agent.slug}`}
              className="px-6 py-3 bg-claw-accent text-white font-bold rounded-lg hover:bg-claw-accent-hover transition-colors"
            >
              View Channel
            </a>
            <a
              href={`/dashboard/${agent.slug}`}
              className="px-6 py-3 border border-claw-border text-claw-text rounded-lg hover:bg-claw-border/20 transition-colors"
            >
              Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── External Mode: OBS Setup ──
  if (isExternal) {
    return (
      <div>
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">{'\u2705'}</div>
          <h2 className="text-2xl font-bold mb-1">{agent.name} is ready!</h2>
          <p className="text-claw-text-muted">
            Connect your stream and you&apos;re live.
          </p>
        </div>

        <div className="space-y-4">
          {/* Step 1: Get OBS */}
          <ChecklistItem
            number={1}
            title="Get OBS Studio (free)"
            done={obsReady}
          >
            <div className="flex flex-wrap gap-2">
              <a
                href="https://obsproject.com/download"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-claw-bg border border-claw-border rounded-lg text-sm hover:border-claw-accent transition-colors"
              >
                Download OBS
              </a>
              <button
                onClick={() => setObsReady(true)}
                className="px-4 py-2 text-sm text-claw-text-muted hover:text-claw-accent transition-colors"
              >
                I already have it
              </button>
            </div>
          </ChecklistItem>

          {/* Step 2: Connection details */}
          <ChecklistItem
            number={2}
            title="Copy your stream details"
            done={detailsCopied}
          >
            <div className="space-y-3">
              <CopyField
                label="Server"
                value={rtmpServer}
                onCopy={() => copyToClipboard(rtmpServer, 'Server URL')}
              />
              <CopyField
                label="Stream Key"
                value={agent.streamKey}
                secret
                onCopy={() => copyToClipboard(agent.streamKey, 'Stream key')}
              />
            </div>
            <div className="mt-3 bg-claw-bg border border-claw-border rounded-lg p-3">
              <p className="text-xs text-claw-text-muted">
                In OBS: <strong className="text-claw-text">Settings</strong> &rarr;{' '}
                <strong className="text-claw-text">Stream</strong> &rarr; Service:{' '}
                <strong className="text-claw-text">Custom</strong>
              </p>
              <p className="text-xs text-claw-text-muted mt-1">
                Paste the Server and Stream Key, click OK.
              </p>
            </div>
          </ChecklistItem>

          {/* Step 3: Start streaming */}
          <ChecklistItem number={3} title='Click "Start Streaming" in OBS'>
            <p className="text-sm text-claw-text-muted">
              Once you start streaming in OBS, we&apos;ll detect it automatically.
            </p>
          </ChecklistItem>

          {/* Step 4: Status */}
          <ChecklistItem number={4} title="Waiting for your stream...">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-claw-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-claw-text-muted">
                Listening for your stream...
              </span>
            </div>
          </ChecklistItem>
        </div>

        <div className="mt-8 text-center">
          <a
            href={`/dashboard/${agent.slug}/stream`}
            className="text-xs text-claw-text-muted hover:text-claw-accent transition-colors"
          >
            Skip to dashboard &rarr;
          </a>
        </div>
      </div>
    );
  }

  // ── Native Mode: Auto Start ──
  return (
    <div className="text-center py-8">
      <div className="text-5xl mb-3">{'\u2705'}</div>
      <h2 className="text-2xl font-bold mb-1">{agent.name} is ready!</h2>
      <p className="text-claw-text-muted mb-8">
        We handle the streaming. Just click start.
      </p>

      {isStarting ? (
        <div>
          <div className="w-10 h-10 border-3 border-claw-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-claw-text-muted">Starting your agent...</p>
          <p className="text-xs text-claw-text-muted mt-1">
            This usually takes 10-30 seconds.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={onStartAgent}
            disabled={actionLoading}
            className="px-10 py-4 bg-green-600 text-white font-bold text-lg rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors shadow-lg shadow-green-600/20"
          >
            {actionLoading ? 'Starting...' : '\u25B6 Start Agent'}
          </button>
          <p className="text-xs text-claw-text-muted">
            Your agent will begin streaming automatically.
          </p>
        </div>
      )}

      <div className="mt-8">
        <a
          href={`/dashboard/${agent.slug}/stream`}
          className="text-xs text-claw-text-muted hover:text-claw-accent transition-colors"
        >
          Skip to dashboard &rarr;
        </a>
      </div>
    </div>
  );
}

function ChecklistItem({
  number,
  title,
  done,
  children,
}: {
  number: number;
  title: string;
  done?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-claw-card border border-claw-border rounded-lg p-4">
      <div className="flex items-center gap-3 mb-2">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
            done
              ? 'bg-green-500 text-white'
              : 'border-2 border-claw-border text-claw-text-muted'
          }`}
        >
          {done ? '\u2713' : number}
        </div>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children && <div className="ml-10">{children}</div>}
    </div>
  );
}

function CopyField({
  label,
  value,
  secret,
  onCopy,
}: {
  label: string;
  value: string;
  secret?: boolean;
  onCopy: () => void;
}) {
  const [show, setShow] = useState(!secret);
  return (
    <div>
      <label className="text-xs text-claw-text-muted block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <code
          className={`flex-1 bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm font-mono text-claw-text ${
            !show ? 'blur-sm select-none' : ''
          }`}
        >
          {value}
        </code>
        {secret && (
          <button
            onClick={() => setShow(!show)}
            className="px-3 py-2 text-xs border border-claw-border rounded hover:bg-claw-card transition-colors flex-shrink-0"
          >
            {show ? 'Hide' : 'Show'}
          </button>
        )}
        <button
          onClick={onCopy}
          className="px-3 py-2 text-xs bg-claw-accent/10 text-claw-accent rounded hover:bg-claw-accent/20 transition-colors flex-shrink-0"
        >
          Copy
        </button>
      </div>
    </div>
  );
}

/* ─── Advanced Create Mode ─── */

function AdvancedCreateMode({
  quickName,
  setQuickName,
  quickDescription,
  setQuickDescription,
  quickSaving,
  quickError,
  onQuickCreate,
  showSkillMd,
  setShowSkillMd,
  skillMdText,
  setSkillMdText,
  onSkillMdCreate,
}: {
  quickName: string;
  setQuickName: (v: string) => void;
  quickDescription: string;
  setQuickDescription: (v: string) => void;
  quickSaving: boolean;
  quickError: string;
  onQuickCreate: () => void;
  showSkillMd: boolean;
  setShowSkillMd: (v: boolean) => void;
  skillMdText: string;
  setSkillMdText: (v: string) => void;
  onSkillMdCreate: () => void;
}) {
  return (
    <div className="max-w-xl">
      <p className="text-claw-text-muted text-sm mb-4">
        Describe your AI agent and we&apos;ll set everything up. You can customize
        later.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Name{' '}
            <span className="text-claw-text-muted font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={quickName}
            onChange={(e) => setQuickName(e.target.value)}
            className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
            placeholder="e.g. CryptoBot, CodeWizard, ChillChat"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Describe your agent *
          </label>
          <textarea
            value={quickDescription}
            onChange={(e) => setQuickDescription(e.target.value)}
            rows={4}
            className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
            placeholder="e.g. An AI that plays retro games and chats with viewers..."
          />
          <p className="text-xs text-claw-text-muted mt-1">
            This becomes your agent&apos;s instructions.
          </p>
        </div>

        {quickError && <p className="text-red-400 text-sm">{quickError}</p>}

        <button
          onClick={onQuickCreate}
          disabled={quickSaving || !quickDescription.trim()}
          className="px-6 py-2.5 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {quickSaving ? 'Creating...' : 'Create & Go Live'}
        </button>

        {/* skill.md */}
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
                Paste a skill.md with YAML frontmatter to configure your agent.
              </p>
              <textarea
                value={skillMdText}
                onChange={(e) => setSkillMdText(e.target.value)}
                rows={14}
                className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-xs text-claw-text font-mono focus:outline-none focus:border-claw-accent"
                spellCheck={false}
              />
              <button
                onClick={onSkillMdCreate}
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
  );
}
