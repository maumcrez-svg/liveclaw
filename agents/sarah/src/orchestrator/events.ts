import { EventEmitter } from 'events';
import { GameState } from '../game/state';

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

export interface SarahEvents {
  'chat:message': (msg: ChatMessageEvent) => void;
  'chat:command': (cmd: CommandEvent) => void;
  'game:battle-start': (state: GameState) => void;
  'game:battle-end': (state: GameState) => void;
  'game:pokemon-caught': (state: GameState) => void;
  'game:pokemon-fainted': (monName: string, state: GameState) => void;
  'game:pokemon-levelup': (monName: string, newLevel: number, state: GameState) => void;
  'game:map-changed': (newMap: string, oldMap: string, state: GameState) => void;
  'game:gym-entered': (gymName: string, state: GameState) => void;
  'game:blackout': (state: GameState) => void;
  'game:stuck': (state: GameState) => void;
  'game:badge-earned': (badgeCount: number, state: GameState) => void;
  'commentary:idle': (state: GameState) => void;
}

class TypedEmitter extends EventEmitter {
  override emit(event: string, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }
}

export const bus = new TypedEmitter();
bus.setMaxListeners(30);
