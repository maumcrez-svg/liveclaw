import { GameState } from '../../game/state';
import { Button } from '../../emulator/adapter';
import { sendInput, queueLength } from '../../emulator/input';

let dialogTickCount = 0;

export function handleDialog(state: GameState): void {
  if (queueLength() > 1) return;

  dialogTickCount++;

  // Mash A to advance text. NEVER press B during dialog —
  // B cancels yes/no prompts and restarts naming screens in Pokemon Red,
  // causing infinite dialog loops.
  if (dialogTickCount % 3 === 0) {
    sendInput(Button.A, 3);
  }
}
