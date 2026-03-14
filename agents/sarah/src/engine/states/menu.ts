import { GameState } from '../../game/state';
import { Button } from '../../emulator/adapter';
import { sendInput, queueLength } from '../../emulator/input';
import { transitionTo, FSMState } from '../fsm';

let menuTickCount = 0;

export function handleMenu(state: GameState): void {
  if (queueLength() > 1) return;

  menuTickCount++;

  if (menuTickCount > 15) {
    sendInput(Button.B, 4);
    menuTickCount = 0;
    transitionTo(FSMState.EXPLORING);
  }
}
