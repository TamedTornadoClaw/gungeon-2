import { World } from '../ecs/world';
import { EventQueue } from '../gameloop/events';
import { EventType, GunType, PickupType, SoundId } from '../ecs/components';
import type { Player, Position, PreviousPosition } from '../ecs/components';
import type { InputState } from '../input/inputManager';
import { getDesignParams } from '../config/designParams';
import { generateDungeon } from '../dungeon/generator';
import {
  createStairs,
  createSpawnZone,
  createWall,
  createHazard,
  createDestructible,
  createDoor,
  createChest,
  createShop,
  createBoss,
} from '../ecs/factories';
import type { DungeonData } from '../dungeon/dungeonData';
import type { EntityId, Vec3 } from '../types';

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

  // Spawn dungeon entities
  spawnDungeonEntities(world, dungeonData, newDepth);

  // Reset player position to new floor start
  const pos = world.getComponent<Position>(playerId, 'Position');
  if (pos) {
    pos.x = dungeonData.playerStart.x;
    pos.y = dungeonData.playerStart.y;
    pos.z = dungeonData.playerStart.z;
  }
  const prevPos = world.getComponent<PreviousPosition>(playerId, 'PreviousPosition');
  if (prevPos) {
    prevPos.x = dungeonData.playerStart.x;
    prevPos.y = dungeonData.playerStart.y;
    prevPos.z = dungeonData.playerStart.z;
  }

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

function spawnDungeonEntities(world: World, dungeonData: DungeonData, depth: number): void {
  const params = getDesignParams();
  const isBossFloor = depth === params.dungeon.bossFloorDepth;

  // Spawn stairs (unless boss floor)
  if (!isBossFloor) {
    createStairs(world, dungeonData.stairsPosition, depth + 1);
  }

  // Spawn room contents
  for (const room of dungeonData.rooms) {
    // Room walls (simplified: create walls around room bounds)
    const min = room.bounds.min;
    const max = room.bounds.max;
    const roomW = max.x - min.x;
    const roomH = max.z - min.z;
    const wt = params.dungeon.wallThickness;
    const wh = params.dungeon.wallHeight;

    // North wall
    createWall(world, { x: min.x + roomW / 2, y: 0, z: min.z }, { x: roomW, y: wh, z: wt });
    // South wall
    createWall(world, { x: min.x + roomW / 2, y: 0, z: max.z }, { x: roomW, y: wh, z: wt });
    // West wall
    createWall(world, { x: min.x, y: 0, z: min.z + roomH / 2 }, { x: wt, y: wh, z: roomH });
    // East wall
    createWall(world, { x: max.x, y: 0, z: min.z + roomH / 2 }, { x: wt, y: wh, z: roomH });

    // Spawn zones (enemy spawners)
    for (const sp of room.spawnPoints) {
      createSpawnZone(
        world,
        sp.position,
        { x: roomW * params.dungeon.spawnZoneScale, y: roomH * params.dungeon.spawnZoneScale },
        sp.enemyTypes,
        sp.enemyCount,
      );
    }

    // Hazards
    for (const hp of room.hazardPlacements) {
      createHazard(world, hp.hazardType, hp.position, { x: hp.width, y: 1, z: hp.height });
    }

    // Destructibles
    for (const dp of room.destructiblePlacements) {
      createDestructible(world, dp.position, { x: dp.width, y: dp.height, z: dp.depth }, dp.health);
    }

    // Chest
    if (room.hasChest) {
      const cx = (min.x + max.x) / 2 + params.dungeon.chestOffset;
      const cz = (min.z + max.z) / 2;
      const allGunTypes = [GunType.Pistol, GunType.SMG, GunType.AssaultRifle, GunType.Shotgun, GunType.LMG];
      const randomGun = allGunTypes[Math.floor(Math.random() * allGunTypes.length)];
      createChest(world, { x: cx, y: 0, z: cz }, randomGun);
    }

    // Shop
    if (room.hasShop) {
      const sx = (min.x + max.x) / 2 + params.dungeon.shopOffset;
      const sz = (min.z + max.z) / 2;
      createShop(world, { x: sx, y: 0, z: sz }, [
        {
          type: PickupType.HealthPickup,
          price: params.shop.healthPickupPrice,
          healAmount: params.shop.healthPickupHealAmount,
          sold: false,
        },
      ]);
    }
  }

  // Spawn doors at corridor endpoints
  for (const corridor of dungeonData.corridors) {
    const midX = (corridor.start.x + corridor.end.x) / 2;
    const midZ = (corridor.start.z + corridor.end.z) / 2;
    createDoor(world, { x: midX, y: 0, z: midZ });
  }

  // Boss floor: spawn boss at center
  if (isBossFloor) {
    const bossPos: Vec3 = {
      x: (dungeonData.rooms[0].bounds.min.x + dungeonData.rooms[0].bounds.max.x) / 2,
      y: 0,
      z: (dungeonData.rooms[0].bounds.min.z + dungeonData.rooms[0].bounds.max.z) / 2,
    };
    createBoss(world, bossPos, depth);
  }
}
