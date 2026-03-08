import { World } from '../ecs/world';
import { EventQueue } from '../gameloop/events';
import { EventType } from '../ecs/components';
import type { DamageOverTime, Position, SpeedModifier } from '../ecs/components';

/**
 * HazardSystem — Position 12 in game loop.
 *
 * Emits DamageEvents for entities with DamageOverTime + Health,
 * then sets refreshed = false on both DamageOverTime and SpeedModifier
 * so ExpireModifiersSystem can clean up un-refreshed modifiers.
 */
export function hazardSystem(world: World, eventQueue: EventQueue, dt: number): void {
  const entities = world.query(['DamageOverTime', 'Health']);

  for (const id of entities) {
    const dot = world.getComponent<DamageOverTime>(id, 'DamageOverTime')!;
    const position = world.getComponent<Position>(id, 'Position');

    const amount = dot.damagePerSecond * dt;

    eventQueue.emit({
      type: EventType.Damage,
      target: id,
      amount,
      source: id,
      isCritical: false,
      impactPosition: position ? { x: position.x, y: position.y, z: position.z } : { x: 0, y: 0, z: 0 },
    });

    dot.refreshed = false;
  }

  // Mark SpeedModifiers for expiry — CollisionResponse will re-refresh
  // any that are still active from ongoing hazard overlap
  const speedEntities = world.query(['SpeedModifier']);
  for (const id of speedEntities) {
    const mod = world.getComponent<SpeedModifier>(id, 'SpeedModifier');
    if (mod) {
      mod.refreshed = false;
    }
  }
}
