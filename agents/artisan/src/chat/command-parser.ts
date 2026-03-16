import { bus, type ChatMessageEvent, type CommandEvent } from '../orchestrator/events';

const VALID_COMMANDS = ['palette', 'mood', 'draw', 'style', 'speed', 'info'];

// Cooldown tracking: command -> last used timestamp
const cooldowns = new Map<string, number>();
const COOLDOWN_MS: Record<string, number> = {
  palette: 30_000,
  mood: 120_000,
  draw: 300_000,
  style: 30_000,
  speed: 30_000,
  info: 10_000,
};

export function setupCommandParser(): void {
  bus.on('chat:message', (msg: ChatMessageEvent) => {
    if (!msg.content.startsWith('!')) return;

    const parts = msg.content.slice(1).split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    if (!VALID_COMMANDS.includes(command)) return;

    // Check cooldown
    const lastUsed = cooldowns.get(command) || 0;
    const cooldown = COOLDOWN_MS[command] || 30_000;
    if (Date.now() - lastUsed < cooldown) return;

    cooldowns.set(command, Date.now());

    const event: CommandEvent = {
      command,
      args,
      username: msg.username,
      rawMessage: msg,
    };
    bus.emit('chat:command', event);
  });
}
