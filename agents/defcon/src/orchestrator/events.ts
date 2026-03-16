import { EventEmitter } from 'events';

export interface ChatMessageEvent {
  id: string;
  username: string;
  content: string;
  type: string;
}

export interface CommandEvent {
  command: string;
  args: string;
  username: string;
  rawMessage: ChatMessageEvent;
}

export interface IntelArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  timestamp: number;
}

export interface DefconEvents {
  'chat:message': (msg: ChatMessageEvent) => void;
  'chat:command': (cmd: CommandEvent) => void;
  'intel:new-article': (article: IntelArticle) => void;
  'intel:new-tweet': (tweet: IntelArticle) => void;
  'intel:defcon-change': (newLevel: number, oldLevel: number) => void;
  'intel:osint-update': (count: number) => void;
  'intel:flight-count': (count: number) => void;
  'intel:vessel-count': (count: number) => void;
  'intel:military-flight': (flight: { callsign: string; type: string; lat: number; lon: number; alt: number; heading: number }) => void;
  'sitrep:request': () => void;
  'mode:change': (mode: string) => void;
}

class TypedEmitter extends EventEmitter {
  override emit(event: string, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }
}

export const bus = new TypedEmitter();
bus.setMaxListeners(30);
