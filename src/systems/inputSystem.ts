/**
 * InputSystem — thin wrapper that calls InputManager.poll() and returns InputState.
 *
 * System execution order: 1 (runs before PlayerControlSystem).
 *
 * Integration: Called by the game loop each fixed-timestep tick.
 * The returned InputState is passed to all downstream systems that
 * need player input (PlayerControlSystem, PickupSystem, etc.).
 */
import type { InputManager, InputState } from '../input/inputManager';

export function inputSystem(inputManager: InputManager): InputState {
  return inputManager.poll();
}
