import { getEntity } from './bridge';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate an LLM response against the entity's rules.
 * Returns { valid: true } if the response is in-character.
 * Returns { valid: false, reason: '...' } if it breaks character.
 */
export function validateResponse(response: string): ValidationResult {
  const entity = getEntity();

  // Check for generic AI disclaimers
  const aiPhrases = [
    'as an ai',
    'as a language model',
    'i cannot have opinions',
    'i don\'t have feelings',
    'i\'m just a program',
    'as an artificial',
    'i apologize, but i',
  ];

  const lower = response.toLowerCase();
  for (const phrase of aiPhrases) {
    if (lower.includes(phrase)) {
      return { valid: false, reason: `Broke character: used AI disclaimer "${phrase}"` };
    }
  }

  // Check for corporate/assistant voice
  const corporatePhrases = [
    'certainly!',
    'absolutely!',
    'great question!',
    'i\'d be happy to help',
    'is there anything else',
    'thank you for your patience',
    'i understand your concern',
  ];

  // Only flag if the entity's tone is NOT professional
  if (entity.personality.humor !== 'none') {
    for (const phrase of corporatePhrases) {
      if (lower.includes(phrase)) {
        return { valid: false, reason: `Used corporate assistant voice: "${phrase}"` };
      }
    }
  }

  // Check response length against rules
  if (entity.rules.responseStyle === 'brief' && response.length > 500) {
    return { valid: false, reason: 'Response too long for brief style' };
  }

  // Check for markdown formatting (shouldn't be in chat)
  if (response.includes('**') || response.includes('##') || response.includes('```')) {
    return { valid: false, reason: 'Used markdown formatting in chat response' };
  }

  return { valid: true };
}

/**
 * Attempt to fix a response that failed validation.
 * Returns null if unfixable — caller should regenerate.
 */
export function fixResponse(response: string, reason: string): string | null {
  // Remove markdown
  if (reason.includes('markdown')) {
    return response
      .replace(/\*\*/g, '')
      .replace(/##\s*/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .trim();
  }

  // Truncate if too long
  if (reason.includes('too long')) {
    const sentences = response.split(/[.!?]+/).filter(s => s.trim());
    return sentences.slice(0, 3).join('. ').trim() + '.';
  }

  // Can't fix AI disclaimers or corporate voice — need regeneration
  return null;
}
