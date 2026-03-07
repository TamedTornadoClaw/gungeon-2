import { World } from '../ecs/world';
import { AIBehaviorState } from '../ecs/components';
import type { AIState, EnemyWeapon, Position, Rotation } from '../ecs/components';
import { createEnemyBullet } from '../ecs/factories';

/**
 * EnemyWeaponSystem — fires enemy projectiles when AI state is Attack and cooldown allows.
 * Runs at position 5.5 in the game loop, after AISystem and before MovementSystem.
 */
export function enemyWeaponSystem(
  world: World,
  dt: number,
  rng: () => number = Math.random,
): void {
  const entities = world.query(['EnemyWeapon', 'AIState', 'Position', 'Rotation']);

  for (const id of entities) {
    const weapon = world.getComponent<EnemyWeapon>(id, 'EnemyWeapon')!;
    const ai = world.getComponent<AIState>(id, 'AIState')!;
    const position = world.getComponent<Position>(id, 'Position')!;
    const rotation = world.getComponent<Rotation>(id, 'Rotation')!;

    // Cooldown ticks every frame regardless of state
    weapon.fireCooldown -= dt;

    // Only fire in Attack state with cooldown ready
    if (ai.state !== AIBehaviorState.Attack || weapon.fireCooldown > 0) {
      continue;
    }

    // Fire projectiles
    for (let i = 0; i < weapon.projectileCount; i++) {
      const spreadOffset = (rng() - 0.5) * weapon.spread;
      const angle = rotation.y + spreadOffset;

      const vx = Math.sin(angle) * weapon.projectileSpeed;
      const vz = Math.cos(angle) * weapon.projectileSpeed;

      createEnemyBullet(
        world,
        { x: position.x, y: position.y, z: position.z },
        { x: vx, y: 0, z: vz },
        weapon,
        id,
      );
    }

    // Reset cooldown
    weapon.fireCooldown = 1 / weapon.fireRate;
  }
}
