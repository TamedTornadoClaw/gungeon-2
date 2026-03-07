/**
 * ExpireModifiersSystem — removes DamageOverTime and SpeedModifier components
 * where `refreshed === false`.
 *
 * System execution order: position 24, runs AFTER CollisionResponse (refreshes)
 * and AFTER HazardSystem (applies damage and sets refreshed = false).
 * Entities NOT in a hazard zone will have refreshed = false and should have
 * the modifier removed.
 *
 * Integration: Called by the game loop each fixed-timestep tick, after DeathSystem.
 */
import type { DamageOverTime, SpeedModifier } from '../ecs/components';
import type { World } from '../ecs/world';

export function expireModifiersSystem(world: World): void {
  const dotEntities = world.query(['DamageOverTime']);
  for (const id of dotEntities) {
    const dot = world.getComponent<DamageOverTime>(id, 'DamageOverTime');
    if (dot && dot.refreshed === false) {
      world.removeComponent(id, 'DamageOverTime');
    }
  }

  const speedEntities = world.query(['SpeedModifier']);
  for (const id of speedEntities) {
    const mod = world.getComponent<SpeedModifier>(id, 'SpeedModifier');
    if (mod && mod.refreshed === false) {
      world.removeComponent(id, 'SpeedModifier');
    }
  }
}
