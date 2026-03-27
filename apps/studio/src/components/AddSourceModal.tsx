// ── Add Source modal ────────────────────────────────────────────────

import React, { useState } from 'react';
import { SOURCE_TYPES, resolveInputKind, type SourceTypeConfig, type ConfigField } from '../obs/sources';
import { getOBS } from '../obs/connection';
import { addSource, listSources } from '../obs/scene';
import { useOBSStore } from '../store/obs-store';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = 'pick_type' | 'configure';

export function AddSourceModal({ open, onClose }: Props) {
  const setSources = useOBSStore((s) => s.setSources);
  const [step, setStep] = useState<Step>('pick_type');
  const [selected, setSelected] = useState<SourceTypeConfig | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [sourceName, setSourceName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSelectType = (st: SourceTypeConfig) => {
    setSelected(st);
    setSourceName(st.label);
    setFieldValues({});
    setError(null);

    if (st.configFields.length === 0) {
      // No extra config needed — add immediately
      doAdd(st, st.label, {});
    } else {
      setStep('configure');
    }
  };

  const doAdd = async (
    st: SourceTypeConfig,
    name: string,
    extraSettings: Record<string, string>,
  ) => {
    setAdding(true);
    setError(null);
    try {
      const obs = getOBS();
      const inputSettings: Record<string, any> = { ...st.defaultSettings };

      // Auto-prefix browser source URLs with https:// if missing
      if (st.id === 'browser' && extraSettings.url) {
        let url = extraSettings.url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
          extraSettings = { ...extraSettings, url };
        }
      }

      // Merge user-provided config
      for (const field of st.configFields) {
        const val = extraSettings[field.key];
        if (val) {
          inputSettings[field.key] = field.type === 'number' ? Number(val) : val;
        }
      }

      // Use dynamically resolved kind when available, fall back to static hint
      const supportedKinds = useOBSStore.getState().supportedInputKinds;
      const resolvedKind = resolveInputKind(st.id as any, supportedKinds) || st.obsInputKind;

      await addSource(obs, {
        inputName: name,
        inputKind: resolvedKind,
        inputSettings,
      });

      // Refresh source list
      const items = await listSources(obs);
      setSources(items);

      // Reset and close
      resetAndClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add source');
    } finally {
      setAdding(false);
    }
  };

  const handleConfirm = () => {
    if (!selected) return;
    doAdd(selected, sourceName || selected.label, fieldValues);
  };

  const resetAndClose = () => {
    setStep('pick_type');
    setSelected(null);
    setFieldValues({});
    setSourceName('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-studio-text/40 backdrop-blur-sm">
      <div className="bg-studio-card border border-studio-border rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-studio-border">
          <h2 className="text-studio-text font-semibold">
            {step === 'pick_type' ? 'Add Source' : `Configure ${selected?.label}`}
          </h2>
          <button
            onClick={resetAndClose}
            className="w-7 h-7 flex items-center justify-center rounded text-studio-muted hover:text-studio-text hover:bg-white/10 transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {step === 'pick_type' && (
            <div className="grid grid-cols-2 gap-3">
              {SOURCE_TYPES.map((st) => (
                <button
                  key={st.id}
                  onClick={() => handleSelectType(st)}
                  disabled={adding}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-studio-border bg-studio-bg hover:border-studio-accent hover:bg-studio-accent/5 transition-colors disabled:opacity-50"
                >
                  <span className="text-2xl">{st.icon}</span>
                  <span className="text-sm text-studio-text">{st.label}</span>
                </button>
              ))}
            </div>
          )}

          {step === 'configure' && selected && (
            <div className="space-y-4">
              {/* Source name */}
              <div>
                <label className="block text-xs text-studio-muted mb-1.5">
                  Source Name
                </label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  className="w-full bg-studio-bg border border-studio-border rounded px-3 py-2 text-sm text-studio-text placeholder-studio-muted/50 focus:outline-none focus:border-studio-accent"
                />
              </div>

              {/* Config fields */}
              {selected.configFields.map((field: ConfigField) => (
                <div key={field.key}>
                  <label className="block text-xs text-studio-muted mb-1.5">
                    {field.label}
                  </label>
                  {field.key === 'file' && selected.id === 'image' ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={fieldValues[field.key] ?? field.defaultValue ?? ''}
                        onChange={(e) =>
                          setFieldValues((v) => ({ ...v, [field.key]: e.target.value }))
                        }
                        placeholder={field.placeholder}
                        className="flex-1 bg-studio-bg border border-studio-border rounded px-3 py-2 text-sm text-studio-text placeholder-studio-muted/50 focus:outline-none focus:border-studio-accent"
                      />
                      <label className="px-3 py-2 bg-studio-bg border border-studio-border rounded text-sm text-studio-muted hover:text-studio-text hover:border-studio-accent cursor-pointer transition-colors shrink-0">
                        Browse
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              // In Tauri webview, file.name gives the filename.
                              // webkitRelativePath or the drop path gives full path on desktop.
                              const path = (file as any).path || file.name;
                              setFieldValues((v) => ({ ...v, [field.key]: path }));
                            }
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={fieldValues[field.key] ?? field.defaultValue ?? ''}
                      onChange={(e) =>
                        setFieldValues((v) => ({ ...v, [field.key]: e.target.value }))
                      }
                      placeholder={field.placeholder}
                      className="w-full bg-studio-bg border border-studio-border rounded px-3 py-2 text-sm text-studio-text placeholder-studio-muted/50 focus:outline-none focus:border-studio-accent"
                    />
                  )}
                </div>
              ))}

              {error && (
                <p className="text-sm text-studio-live">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setStep('pick_type'); setError(null); }}
                  className="flex-1 px-4 py-2 text-sm rounded border border-studio-border text-studio-muted hover:text-studio-text hover:border-studio-muted transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={adding}
                  className="flex-1 px-4 py-2 text-sm rounded bg-studio-accent hover:bg-studio-accent-hover text-white font-medium transition-colors disabled:opacity-50"
                >
                  {adding ? 'Adding...' : 'Add Source'}
                </button>
              </div>
            </div>
          )}

          {/* Loading overlay for type-pick direct adds */}
          {step === 'pick_type' && adding && (
            <div className="mt-4 text-center text-sm text-studio-muted">
              Adding source...
            </div>
          )}

          {step === 'pick_type' && error && (
            <p className="mt-4 text-sm text-studio-live text-center">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
