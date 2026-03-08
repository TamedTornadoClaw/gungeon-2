import { World } from '../ecs/world';
import { EventQueue } from '../gameloop/events';
import { EventType, SoundId } from '../ecs/components';
import type { Player } from '../ecs/components';
import type { InputState } from '../input/inputManager';
import { generateDungeon } from '../dungeon/generator';
import { createDungeonEntities, setPlayerStartPosition } from '../dungeon/dungeonEntityCreator';
import { buildAimCollisionMesh } from '../rendering/aimRaycast';
import type { EntityId } from '../types';

interface ProximityFlags {
  nearChest: boolean;
  nearDoor: boolean;
  nearShop: boolean;
  nearStairs: boolean;
}

export interface FloorState {
  currentDepth: number;
  seed: number;
}

/**
 * FloorTransitionSystem — handles transition to the next dungeon floor
 * when the player reaches stairs and presses interact.
 *
 * Integration: Runs after CollisionResponseSystem sets nearStairs flag.
 * Called each frame with the current world, input state, and event queue.
 */
export function floorTransitionSystem(
  world: World,
  input: InputState,
  eventQueue: EventQueue,
  floorState: FloorState,
): void {
  if (!input.interact) return;

  const players = world.query(['PlayerTag', 'ProximityFlags']);
  if (players.length === 0) return;

  const playerId = players[0];
  const flags = world.getComponent<ProximityFlags>(playerId, 'ProximityFlags');
  if (!flags || !flags.nearStairs) return;

  const player = world.getComponent<Player>(playerId, 'Player');
  if (!player) return;

  // Collect entities to preserve: player + gun entities
  const preserveSet = new Set<EntityId>();
  preserveSet.add(playerId);
  preserveSet.add(player.sidearmSlot);
  preserveSet.add(player.longArmSlot);

  // Destroy all entities except preserved ones
  const allEntities = world.query([]);
  for (const entityId of allEntities) {
    if (!preserveSet.has(entityId)) {
      world.destroyEntity(entityId);
    }
  }

  // Increment depth
  floorState.currentDepth += 1;
  const newDepth = floorState.currentDepth;

  // Generate new dungeon
  floorState.seed += 1;
  const dungeonData = generateDungeon(floorState.seed, newDepth);

  // Spawn dungeon entities (walls, floors, hazards, etc.) and rebuild spatial hash
  createDungeonEntities(world, dungeonData, newDepth);

  // Rebuild BVH collision mesh for aim raycasting on the new floor
  buildAimCollisionMesh(world);

  // Reset player position to new floor start
  setPlayerStartPosition(world, playerId, dungeonData.playerStart);

  // Clear nearStairs to prevent double transition
  flags.nearStairs = false;

  // Clear any remaining events from old floor before emitting new ones
  eventQueue.clear();

  // Emit floor transition audio after clear so it isn't discarded
  eventQueue.emit({
    type: EventType.Audio,
    sound: SoundId.FloorTransition,
    position: { x: dungeonData.playerStart.x, y: dungeonData.playerStart.y, z: dungeonData.playerStart.z },
  });
}
