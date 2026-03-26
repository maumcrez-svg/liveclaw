import React, { useState } from 'react';
import { createDefaultWizardState, type WizardState, type PersonalityConfig, type VoiceConfig, type LLMConfig } from '../../lib/wizard-types';
import { generateInstructions } from '../../lib/generate-instructions';
import { StepIndicator } from './StepIndicator';
import { StepTemplate } from './StepTemplate';
import { StepIdentity } from './StepIdentity';
import { StepPersonality } from './StepPersonality';
import { StepVoice } from './StepVoice';
import { StepAIEngine } from './StepAIEngine';
import { StepReview } from './StepReview';

// Template images
import imgChat from '../../assets/template-chat.png';
import imgCrypto from '../../assets/template-crypto.png';
import imgGame from '../../assets/template-game.png';
import imgCode from '../../assets/template-code.png';
import imgNews from '../../assets/template-news.png';
import imgCustom from '../../assets/template-custom.png';

const AGENT_TEMPLATES = [
  {
    id: 'chat', img: imgChat, name: 'Chat Agent', type: 'chat',
    desc: 'Talks with viewers in real-time',
    configFields: [
      { key: 'topics', label: 'Topics to discuss', placeholder: 'e.g. tech, philosophy, memes...' },
    ],
  },
  {
    id: 'crypto', img: imgCrypto, name: 'Trader Agent', type: 'browser',
    desc: 'Tracks crypto markets live',
    configFields: [
      { key: 'tokens', label: 'Tokens to track', placeholder: 'e.g. BTC, ETH, SOL, DOGE...' },
    ],
  },
  {
    id: 'game', img: imgGame, name: 'Game Agent', type: 'game',
    desc: 'Plays games on stream',
    configFields: [
      { key: 'gameType', label: 'Game name or type', placeholder: 'e.g. Chess, Minecraft, browser games...' },
      { key: 'gameUrl', label: 'Game URL (if browser-based)', placeholder: 'https://...' },
    ],
  },
  {
    id: 'code', img: imgCode, name: 'Coding Agent', type: 'coding',
    desc: 'Writes code live',
    configFields: [
      { key: 'language', label: 'Primary language', placeholder: 'e.g. Python, TypeScript, Rust...' },
      { key: 'project', label: 'Project description', placeholder: 'e.g. Building a todo app...' },
    ],
  },
  {
    id: 'news', img: imgNews, name: 'News Agent', type: 'browser',
    desc: 'Covers the latest headlines',
    configFields: [
      { key: 'topics', label: 'Topics to cover', placeholder: 'e.g. AI, crypto, world news...' },
    ],
  },
  {
    id: 'custom', img: imgCustom, name: 'Custom', type: 'custom',
    desc: 'Start from scratch',
    configFields: [],
  },
];

interface CreateWizardProps {
  onComplete: (data: {
    name: string;
    slug: string;
    description: string;
    agentType: string;
    instructions: string;
    defaultTags: string[];
    apiKey?: string;
    model?: string;
    config: Record<string, unknown>;
  }) => Promise<void>;
  onCancel: () => void;
}

const TOTAL_STEPS = 6;

export function CreateWizard({ onComplete, onCancel }: CreateWizardProps) {
  const [state, setState] = useState<WizardState>(createDefaultWizardState);

  const update = (partial: Partial<WizardState>) => setState((s) => ({ ...s, ...partial }));

  const computeSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

  const slug = computeSlug(state.name);

  const selectedTemplate = AGENT_TEMPLATES.find((t) => t.id === state.templateId);

  const goToStep = (step: number) => {
    // Validate prerequisites
    if (step >= 2 && !state.templateId) return;
    if (step >= 3 && state.name.trim().length < 2) return;

    if (step >= TOTAL_STEPS) {
      // Generate instructions when entering the review step
      const instructions = generateInstructions({
        templateId: state.templateId,
        name: state.name.trim(),
        description: state.description.trim(),
        tone: state.personality.tone,
        config: state.templateConfig,
        personality: state.personality,
        voice: state.voice,
        llm: state.llm,
        uploadedPrompt: state.uploadedPrompt,
      });
      update({ step, generatedInstructions: instructions, error: null });
    } else {
      update({ step, error: null });
    }
  };

  const handleSubmit = async () => {
    const template = AGENT_TEMPLATES.find((t) => t.id === state.templateId);

    if (!state.generatedInstructions?.trim()) {
      update({ error: 'Instructions cannot be empty. Go back and add a description.' });
      return;
    }

    update({ creating: true, error: null });
    try {
      await onComplete({
        name: state.name.trim(),
        slug,
        description: state.description.trim() || `${template?.name || 'AI Agent'} streaming on LiveClaw`,
        agentType: template?.type || 'custom',
        instructions: state.generatedInstructions,
        defaultTags: [template?.id || 'custom', 'ai', 'live'],
        apiKey: state.apiKey || undefined,
        model: state.llm.model || undefined,
        config: {
          personality: state.personality,
          voice: state.voice,
          llm: { model: state.llm.model, temperature: state.llm.temperature, maxTokens: state.llm.maxTokens, responseStyle: state.llm.responseStyle },
          avatar: state.avatar,
        },
      });
    } catch (err: any) {
      update({ creating: false, error: err.message || 'Failed to create agent' });
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <StepIndicator current={state.step} total={TOTAL_STEPS} />

      {/* Step 1 - Template */}
      {state.step === 1 && (
        <StepTemplate
          templates={AGENT_TEMPLATES}
          onSelect={(templateId) => {
            // Set template and advance in one update (goToStep would read stale state)
            update({ templateId, step: 2, error: null });
          }}
        />
      )}

      {/* Step 2 - Identity */}
      {state.step === 2 && (
        <StepIdentity
          name={state.name}
          description={state.description}
          templateConfig={state.templateConfig}
          configFields={selectedTemplate?.configFields || []}
          uploadedPromptName={state.uploadedPromptName}
          slug={slug}
          avatar={state.avatar}
          onNameChange={(name) => update({ name })}
          onDescriptionChange={(description) => update({ description })}
          onConfigChange={(key, value) => update({ templateConfig: { ...state.templateConfig, [key]: value } })}
          onUploadPrompt={(content, filename) => update({ uploadedPrompt: content, uploadedPromptName: filename })}
          onClearPrompt={() => update({ uploadedPrompt: null, uploadedPromptName: null })}
          onAvatarChange={(avatar) => update({ avatar })}
          onNext={() => goToStep(3)}
          onBack={() => goToStep(1)}
        />
      )}

      {/* Step 3 - Personality */}
      {state.step === 3 && (
        <StepPersonality
          personality={state.personality}
          onChange={(personality: PersonalityConfig) => update({ personality })}
          onNext={() => goToStep(4)}
          onBack={() => goToStep(2)}
        />
      )}

      {/* Step 4 - Voice */}
      {state.step === 4 && (
        <StepVoice
          voice={state.voice}
          onChange={(voice: VoiceConfig) => update({ voice })}
          onNext={() => goToStep(5)}
          onBack={() => goToStep(3)}
        />
      )}

      {/* Step 5 - AI Engine */}
      {state.step === 5 && (
        <StepAIEngine
          apiKey={state.apiKey}
          showApiKey={state.showApiKey}
          llm={state.llm}
          onApiKeyChange={(apiKey) => update({ apiKey })}
          onToggleShowKey={() => update({ showApiKey: !state.showApiKey })}
          onLLMChange={(llm: LLMConfig) => update({ llm })}
          onNext={() => goToStep(6)}
          onBack={() => goToStep(4)}
        />
      )}

      {/* Step 6 - Review */}
      {state.step === 6 && (
        <StepReview
          state={state}
          templates={AGENT_TEMPLATES}
          slug={slug}
          onInstructionsChange={(generatedInstructions) => update({ generatedInstructions })}
          onBack={() => goToStep(5)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
