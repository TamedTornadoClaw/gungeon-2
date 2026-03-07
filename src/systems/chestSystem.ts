import { World } from '../ecs/world';
import { EventQueue } from '../gameloop/events';
import { EventType, SoundId } from '../ecs/components';
import type { Chest, Position } from '../ecs/components';
import type { InputState } from '../input/inputManager';
import { createGunPickup } from '../ecs/factories';

interface ProximityFlags {
  nearChest: boolean;
}

/**
 * ChestSystem — opens chests on interact, spawns gun pickup.
 *
 * Runs after CollisionResponseSystem (which sets nearChest flag on ProximityFlags).
 * When the player is near a chest, presses interact, and the chest is closed:
 *   - Sets chest.isOpen = true
 *   - Spawns a GunPickup at the chest's position
 *   - Emits AudioEvent(ChestOpen)
 */
export function chestSystem(world: World, input: InputState, eventQueue: EventQueue): void {
  if (!input.interact) return;

  const players = world.query(['PlayerTag', 'ProximityFlags']);
  if (players.length === 0) return;

  const playerId = players[0];
  const flags = world.getComponent<ProximityFlags>(playerId, 'ProximityFlags');
  if (!flags || !flags.nearChest) return;

  const chests = world.query(['Chest', 'ChestTag', 'Position']);

  for (const chestId of chests) {
    const chest = world.getComponent<Chest>(chestId, 'Chest');
    if (!chest || chest.isOpen) continue;

    const position = world.getComponent<Position>(chestId, 'Position');
    if (!position) continue;

    chest.isOpen = true;

    createGunPickup(world, { x: position.x, y: position.y, z: position.z }, chest.gunType);

    eventQueue.emit({
      type: EventType.Audio,
      sound: SoundId.ChestOpen,
      position: { x: position.x, y: position.y, z: position.z },
    });

    // Only open one chest per interact
    break;
  }
}
