import { GameState } from '../../game/state';
import { Button } from '../../emulator/adapter';
import { sendInput, queueLength } from '../../emulator/input';

let dialogTickCount = 0;

export function handleDialog(state: GameState): void {
  if (queueLength() > 1) return;

  dialogTickCount++;

  // Mash A every 4 frames to advance text
  if (dialogTickCount % 4 === 0) {
    sendInput(Button.A, 3);
  }

  // Occasionally press B to cancel dialogs
  if (dialogTickCount % 20 === 10) {
    sendInput(Button.B, 3);
  }
}
