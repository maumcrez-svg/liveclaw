import { EventEmitter } from 'events';

export interface ChatMessageEvent {
  id: string;
  username: string;
  content: string;
  type: string;
  createdAt: string;
}

export interface CommandEvent {
  command: string;
  args: string;
  username: string;
  rawMessage: ChatMessageEvent;
}

export interface ArtisanEvents {
  'chat:message': (msg: ChatMessageEvent) => void;
  'chat:command': (cmd: CommandEvent) => void;
  'mood:change': (mood: string, previous: string) => void;
  'dalle:start': (prompt: string) => void;
  'dalle:complete': (imageBase64: string, prompt: string) => void;
  'visual:mode': (mode: string) => void;
  'visual:palette': (palette: string[]) => void;
}

class TypedEmitter extends EventEmitter {
  override emit(event: string, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }
}

export const bus = new TypedEmitter();
bus.setMaxListeners(30);
