import { World } from '../ecs/world';
import type { Position, SpawnZone, Health } from '../ecs/components';
import { createEnemy } from '../ecs/factories';
import { getDesignParams } from '../config/designParams';

export function spawnSystem(
  world: World,
  depth: number,
  rng: () => number = Math.random,
): void {
  const params = getDesignParams();
  const miniBossChance = params.dungeon.miniBossChancePerRoom;

  const zoneIds = world.query(['SpawnZone', 'Position']);

  for (const zoneId of zoneIds) {
    const zone = world.getComponent<SpawnZone>(zoneId, 'SpawnZone')!;

    if (!zone.activated || zone.cleared) continue;

    // Spawn enemies if not yet spawned
    if (zone.spawnedEnemies.length === 0) {
      if (zone.enemyCount === 0) {
        zone.cleared = true;
        continue;
      }

      const zonePos = world.getComponent<Position>(zoneId, 'Position')!;
      const halfW = zone.width / 2;
      const halfH = zone.height / 2;

      // Roll for mini-boss
      const hasMiniBoss = rng() < miniBossChance;
      const miniBossIndex = hasMiniBoss ? Math.floor(rng() * zone.enemyCount) : -1;

      for (let i = 0; i < zone.enemyCount; i++) {
        const enemyType = zone.enemyTypes[Math.floor(rng() * zone.enemyTypes.length)];
        const x = zonePos.x - halfW + rng() * zone.width;
        const z = zonePos.z - halfH + rng() * zone.height;
        const isMini = i === miniBossIndex;

        const enemyId = createEnemy(
          world,
          enemyType,
          { x, y: 0, z },
          depth - 1,
          isMini,
        );
        zone.spawnedEnemies.push(enemyId);
      }
    }

    // Check if all spawned enemies are dead or destroyed
    let allDead = true;
    for (const enemyId of zone.spawnedEnemies) {
      if (!world.hasEntity(enemyId)) continue;
      const health = world.getComponent<Health>(enemyId, 'Health');
      if (health && health.current > 0) {
        allDead = false;
        break;
      }
    }

    if (allDead) {
      zone.cleared = true;
    }
  }
}
