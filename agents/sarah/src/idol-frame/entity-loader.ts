import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// EntityManifest — mirrors idol-frame v0 schema, simplified for Sarah
// ---------------------------------------------------------------------------

export interface EntityBlock {
  id: string;
  name: string;
  archetype: string;
  role: string;
  domain: string;
}

export interface VoiceBlock {
  tone: string;
  cadence: string;
  density: string;
  slang_level: string;
  vocabulary?: string;
  cursing?: string;
}

export interface HumorBlock {
  style: string;
  aggression: string;
  absurdity: string;
}

export interface EmotionalBaseline {
  anxiety: string;
  confidence: string;
  empathy: string;
}

export interface IdentityCore {
  voice: VoiceBlock;
  humor: HumorBlock;
  emotional_baseline: EmotionalBaseline;
  values: string[];
  flaws: string[];
  taboo_zones: string[];
}

export interface ContinuityBlock {
  must_preserve: string[];
  mutable_zones: string[];
}

export interface MemoryPolicy {
  store: string[];
  ignore: string[];
}

export interface ValidationBlock {
  reject_if: string[];
}

export interface EntityManifest {
  entity: EntityBlock;
  identity_core: IdentityCore;
  continuity: ContinuityBlock;
  manifestations: Record<string, Record<string, string | number | boolean>>;
  memory_policy: MemoryPolicy;
  validation: ValidationBlock;
}

// ---------------------------------------------------------------------------
// YAML parser — minimal, avoids js-yaml dependency
// Handles the flat structure of sarah.yaml without external deps
// ---------------------------------------------------------------------------

function parseSimpleYaml(raw: string): any {
  const lines = raw.split('\n');
  const result: any = {};
  const stack: Array<{ indent: number; obj: any; key: string }> = [
    { indent: -1, obj: result, key: '' },
  ];

  for (const line of lines) {
    // Skip empty lines and comments
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S/);
    const trimmed = line.trim();

    // Pop stack to find parent at correct indentation
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].obj;

    // Array item
    if (trimmed.startsWith('- ')) {
      const value = trimmed.slice(2).trim();
      const parentKey = stack[stack.length - 1].key;
      if (Array.isArray(parent)) {
        parent.push(parseValue(value));
      } else if (parentKey && Array.isArray(parent[parentKey])) {
        parent[parentKey].push(parseValue(value));
      }
      continue;
    }

    // Key-value or key-block
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const valueStr = trimmed.slice(colonIdx + 1).trim();

    if (valueStr === '') {
      // Could be an object or array — peek ahead
      const nextNonEmpty = lines
        .slice(lines.indexOf(line) + 1)
        .find((l) => l.trim() !== '' && !l.trim().startsWith('#'));
      if (nextNonEmpty && nextNonEmpty.trim().startsWith('- ')) {
        parent[key] = [];
      } else {
        parent[key] = {};
      }
      stack.push({ indent, obj: parent[key], key });
    } else {
      parent[key] = parseValue(valueStr);
    }
  }

  return result;
}

function parseValue(val: string): string | number | boolean {
  if (val === 'true') return true;
  if (val === 'false') return false;
  const num = Number(val);
  if (!isNaN(num) && val !== '') return num;
  // Strip surrounding quotes
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  return val;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

let cachedManifest: EntityManifest | null = null;

export function loadEntityManifest(): EntityManifest {
  if (cachedManifest) return cachedManifest;

  const yamlPath = path.join(__dirname, 'sarah.yaml');
  const raw = fs.readFileSync(yamlPath, 'utf-8');
  const parsed = parseSimpleYaml(raw);

  cachedManifest = parsed as EntityManifest;
  console.log(`[IdolFrame] Loaded entity manifest: ${cachedManifest.entity.name} (${cachedManifest.entity.id})`);
  return cachedManifest;
}

export function getManifest(): EntityManifest {
  if (!cachedManifest) return loadEntityManifest();
  return cachedManifest;
}
