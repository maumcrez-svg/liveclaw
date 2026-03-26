import { getAgentConfig } from '../config';

export function getSystemPrompt(): string {
  return getAgentConfig().instructions;
}

export function getChatResponsePrompt(username: string, message: string): string {
  return `A viewer named "${username}" said: "${message}"\n\nRespond naturally in character. Keep it conversational. Address them by name if it feels natural.`;
}

export function getIdlePrompt(): string {
  const { name } = getAgentConfig();
  return `You are ${name}, streaming live with no recent chat activity. Say something unprompted — a random thought, observation, joke, or comment. Stay in character. Be brief (1-2 sentences). Don't mention that chat is quiet.`;
}
