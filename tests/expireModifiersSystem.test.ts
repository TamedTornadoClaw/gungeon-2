import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import type { DamageOverTime, SpeedModifier, Health, Player } from '../src/ecs/components';
import { HazardType, WeaponSlot } from '../src/ecs/components';
import { expireModifiersSystem } from '../src/systems/expireModifiersSystem';

function addDot(world: World, id: number, refreshed: boolean): void {
  world.addComponent<DamageOverTime>(id, 'DamageOverTime', {
    damagePerSecond: 10,
    sourceType: HazardType.Fire,
    refreshed,
  });
}

function addSpeed(world: World, id: number, refreshed: boolean): void {
  world.addComponent<SpeedModifier>(id, 'SpeedModifier', {
    multiplier: 0.5,
    refreshed,
  });
}

describe('expireModifiersSystem', () => {
  // 1. DamageOverTime with refreshed=false is removed
  it('removes DamageOverTime when refreshed is false', () => {
    const world = new World();
    const id = world.createEntity();
    addDot(world, id, false);

    expireModifiersSystem(world);

    expect(world.hasComponent(id, 'DamageOverTime')).toBe(false);
  });

  // 2. DamageOverTime with refreshed=true is kept
  it('keeps DamageOverTime when refreshed is true', () => {
    const world = new World();
    const id = world.createEntity();
    addDot(world, id, true);

    expireModifiersSystem(world);

    expect(world.hasComponent(id, 'DamageOverTime')).toBe(true);
    const dot = world.getComponent<DamageOverTime>(id, 'DamageOverTime')!;
    expect(dot.refreshed).toBe(true);
  });

  // 3. SpeedModifier with refreshed=false is removed
  it('removes SpeedModifier when refreshed is false', () => {
    const world = new World();
    const id = world.createEntity();
    addSpeed(world, id, false);

    expireModifiersSystem(world);

    expect(world.hasComponent(id, 'SpeedModifier')).toBe(false);
  });

  // 4. SpeedModifier with refreshed=true is kept
  it('keeps SpeedModifier when refreshed is true', () => {
    const world = new World();
    const id = world.createEntity();
    addSpeed(world, id, true);

    expireModifiersSystem(world);

    expect(world.hasComponent(id, 'SpeedModifier')).toBe(true);
    const mod = world.getComponent<SpeedModifier>(id, 'SpeedModifier')!;
    expect(mod.refreshed).toBe(true);
  });

  // 5. Entity has both DamageOverTime(refreshed=false) and SpeedModifier(refreshed=true)
  it('removes DamageOverTime but keeps SpeedModifier when independently flagged', () => {
    const world = new World();
    const id = world.createEntity();
    addDot(world, id, false);
    addSpeed(world, id, true);

    expireModifiersSystem(world);

    expect(world.hasComponent(id, 'DamageOverTime')).toBe(false);
    expect(world.hasComponent(id, 'SpeedModifier')).toBe(true);
  });

  // 6. Entity has both DamageOverTime(refreshed=true) and SpeedModifier(refreshed=false)
  it('keeps DamageOverTime but removes SpeedModifier when inversely flagged', () => {
    const world = new World();
    const id = world.createEntity();
    addDot(world, id, true);
    addSpeed(world, id, false);

    expireModifiersSystem(world);

    expect(world.hasComponent(id, 'DamageOverTime')).toBe(true);
    expect(world.hasComponent(id, 'SpeedModifier')).toBe(false);
  });

  // 7. Both components, both refreshed=false — both removed
  it('removes both components when both have refreshed=false', () => {
    const world = new World();
    const id = world.createEntity();
    addDot(world, id, false);
    addSpeed(world, id, false);

    expireModifiersSystem(world);

    expect(world.hasComponent(id, 'DamageOverTime')).toBe(false);
    expect(world.hasComponent(id, 'SpeedModifier')).toBe(false);
  });

  // 8. Both components, both refreshed=true — neither removed
  it('keeps both components when both have refreshed=true', () => {
    const world = new World();
    const id = world.createEntity();
    addDot(world, id, true);
    addSpeed(world, id, true);

    expireModifiersSystem(world);

    expect(world.hasComponent(id, 'DamageOverTime')).toBe(true);
    expect(world.hasComponent(id, 'SpeedModifier')).toBe(true);
  });

  // 9. Multiple entities with mixed states
  it('handles multiple entities with mixed modifier states', () => {
    const world = new World();

    // E1: DoT false
    const e1 = world.createEntity();
    addDot(world, e1, false);

    // E2: SpeedMod true
    const e2 = world.createEntity();
    addSpeed(world, e2, true);

    // E3: DoT true + SpeedMod false
    const e3 = world.createEntity();
    addDot(world, e3, true);
    addSpeed(world, e3, false);

    // E4: neither component
    const e4 = world.createEntity();
    world.addComponent(e4, 'Position', { x: 0, y: 0, z: 0 });

    expireModifiersSystem(world);

    // E1: DoT removed
    expect(world.hasComponent(e1, 'DamageOverTime')).toBe(false);

    // E2: SpeedMod kept
    expect(world.hasComponent(e2, 'SpeedModifier')).toBe(true);

    // E3: DoT kept, SpeedMod removed
    expect(world.hasComponent(e3, 'DamageOverTime')).toBe(true);
    expect(world.hasComponent(e3, 'SpeedModifier')).toBe(false);

    // E4: still exists, unaffected
    expect(world.hasEntity(e4)).toBe(true);
    expect(world.getComponent(e4, 'Position')).toEqual({ x: 0, y: 0, z: 0 });
  });

  // 10. Removing component during iteration does not skip next entity (100 entities alternating)
  it('does not skip entities when removing components during iteration (fast-check)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 200 }),
        (count) => {
          const world = new World();
          const entities: number[] = [];

          for (let i = 0; i < count; i++) {
            const id = world.createEntity();
            entities.push(id);
            // Alternate: even=false (should be removed), odd=true (should be kept)
            addDot(world, id, i % 2 !== 0);
          }

          expireModifiersSystem(world);

          for (let i = 0; i < entities.length; i++) {
            const id = entities[i];
            if (i % 2 === 0) {
              // refreshed=false → removed
              expect(world.hasComponent(id, 'DamageOverTime')).toBe(false);
            } else {
              // refreshed=true → kept
              expect(world.hasComponent(id, 'DamageOverTime')).toBe(true);
            }
            // Entity itself should still exist
            expect(world.hasEntity(id)).toBe(true);
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  // 11. System runs on entity with no Health component — still removes modifiers
  it('removes modifiers from entity without Health component', () => {
    const world = new World();
    const id = world.createEntity();
    // No Health component
    addDot(world, id, false);
    addSpeed(world, id, false);

    expireModifiersSystem(world);

    expect(world.hasComponent(id, 'DamageOverTime')).toBe(false);
    expect(world.hasComponent(id, 'SpeedModifier')).toBe(false);
    expect(world.hasEntity(id)).toBe(true);
  });

  // 12. Player entity with both modifiers refreshed=false — both removed
  it('removes both modifiers from a player entity', () => {
    const world = new World();
    const id = world.createEntity();
    world.addComponent<Player>(id, 'Player', {
      sidearmSlot: 0,
      longArmSlot: 0,
      activeSlot: WeaponSlot.Sidearm,
      currency: 0,
    });
    world.addComponent<Health>(id, 'Health', {
      current: 100,
      max: 100,
      lastDamageSourceGunSlot: null,
    });
    addDot(world, id, false);
    addSpeed(world, id, false);

    expireModifiersSystem(world);

    expect(world.hasComponent(id, 'DamageOverTime')).toBe(false);
    expect(world.hasComponent(id, 'SpeedModifier')).toBe(false);
    // Player entity still exists
    expect(world.hasEntity(id)).toBe(true);
    expect(world.hasComponent(id, 'Player')).toBe(true);
  });

  // Edge: Zero entities — system does nothing, does not throw
  it('does not throw when no entities have either component', () => {
    const world = new World();
    world.createEntity();

    expect(() => expireModifiersSystem(world)).not.toThrow();
  });

  // Edge: Entity with DamageOverTime but refreshed field missing/undefined
  it('does not crash when refreshed field is undefined', () => {
    const world = new World();
    const id = world.createEntity();
    // Manually add component with missing refreshed field
    world.addComponent(id, 'DamageOverTime', {
      damagePerSecond: 5,
      sourceType: HazardType.Spikes,
    } as unknown as DamageOverTime);

    expect(() => expireModifiersSystem(world)).not.toThrow();
    // Component should NOT be removed since refreshed is not strictly false
    // (undefined !== false)
  });

  // Property: system does not modify the refreshed flag
  it('does not modify the refreshed flag on kept components', () => {
    const world = new World();
    const id = world.createEntity();
    addDot(world, id, true);
    addSpeed(world, id, true);

    expireModifiersSystem(world);

    const dot = world.getComponent<DamageOverTime>(id, 'DamageOverTime')!;
    const mod = world.getComponent<SpeedModifier>(id, 'SpeedModifier')!;
    expect(dot.refreshed).toBe(true);
    expect(mod.refreshed).toBe(true);
  });

  // Property: system does not destroy entities
  it('never destroys entities, only removes components', () => {
    const world = new World();
    const ids: number[] = [];
    for (let i = 0; i < 10; i++) {
      const id = world.createEntity();
      ids.push(id);
      addDot(world, id, false);
      addSpeed(world, id, false);
    }

    const countBefore = world.getEntityCount();
    expireModifiersSystem(world);

    expect(world.getEntityCount()).toBe(countBefore);
    for (const id of ids) {
      expect(world.hasEntity(id)).toBe(true);
    }
  });

  // Property: idempotent
  it('is idempotent — calling twice produces no additional effect', () => {
    const world = new World();
    const id = world.createEntity();
    addDot(world, id, false);
    addSpeed(world, id, true);

    expireModifiersSystem(world);
    expireModifiersSystem(world);

    expect(world.hasComponent(id, 'DamageOverTime')).toBe(false);
    expect(world.hasComponent(id, 'SpeedModifier')).toBe(true);
    expect(world.hasEntity(id)).toBe(true);
  });
});
