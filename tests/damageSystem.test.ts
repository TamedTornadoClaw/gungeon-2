import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import { EventQueue } from '../src/gameloop/events';
import { damageSystem } from '../src/systems/damageSystem';
import {
  EventType,
  ParticleEffect,
  SoundId,
  WeaponSlot,
} from '../src/ecs/components';
import type {
  Health,
  Shield,
  Armor,
  Projectile,
  Destructible,
} from '../src/ecs/components';

// ── Helpers ─────────────────────────────────────────────────────────────────

function createEnemyWithHealth(
  world: World,
  hp: number,
  opts?: { shield?: number; armor?: number; shieldRegenRate?: number; shieldRegenDelay?: number },
): number {
  const id = world.createEntity();
  world.addComponent<Health>(id, 'Health', {
    current: hp,
    max: hp,
    lastDamageSourceGunSlot: null,
  });
  world.addComponent<Position>(id, 'Position', { x: 0, y: 0, z: 0 });
  world.addComponent(id, 'EnemyTag', {});
  if (opts?.shield !== undefined) {
    world.addComponent<Shield>(id, 'Shield', {
      current: opts.shield,
      max: opts.shield,
      regenRate: opts.shieldRegenRate ?? 5,
      regenDelay: opts.shieldRegenDelay ?? 3,
      timeSinceLastHit: 10,
    });
  }
  if (opts?.armor !== undefined) {
    world.addComponent<Armor>(id, 'Armor', {
      current: opts.armor,
      max: opts.armor,
    });
  }
  return id;
}

function createDestructibleEntity(world: World, hp: number): number {
  const id = world.createEntity();
  world.addComponent<Destructible>(id, 'Destructible', {
    health: hp,
    maxHealth: hp,
  });
  world.addComponent<Position>(id, 'Position', { x: 0, y: 0, z: 0 });
  world.addComponent(id, 'DestructibleTag', {});
  return id;
}

function createPlayerProjectileSource(world: World, gunSlot: WeaponSlot): number {
  const id = world.createEntity();
  world.addComponent<Projectile>(id, 'Projectile', {
    owner: 0,
    sourceGunSlot: gunSlot,
    damage: 10,
    isCritical: false,
    knockback: 0,
    piercingRemaining: 0,
    bouncesRemaining: 0,
    alreadyHit: [],
    isEnemyProjectile: false,
  });
  return id;
}

function createEnemyProjectileSource(world: World): number {
  const id = world.createEntity();
  world.addComponent<Projectile>(id, 'Projectile', {
    owner: 0,
    damage: 10,
    isCritical: false,
    knockback: 0,
    piercingRemaining: 0,
    bouncesRemaining: 0,
    alreadyHit: [],
    isEnemyProjectile: true,
  });
  return id;
}

function emitDamage(
  eq: EventQueue,
  target: number,
  source: number,
  amount: number,
  isCritical = false,
): void {
  eq.emit({
    type: EventType.Damage,
    target,
    source,
    amount,
    isCritical,
    impactPosition: { x: 1, y: 2, z: 3 },
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('damageSystem', () => {
  // 1. Pure health damage (no shield, no armor)
  it('reduces health and emits BloodSplat + EnemyHitFlesh for enemy with no defenses', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 100);
    const source = world.createEntity();

    emitDamage(eq, target, source, 25);
    damageSystem(world, eq);

    const health = world.getComponent<Health>(target, 'Health')!;
    expect(health.current).toBe(75);

    const particles = eq.consume<EventType.Particle>(EventType.Particle);
    expect(particles).toHaveLength(1);
    expect(particles[0].effect).toBe(ParticleEffect.BloodSplat);

    const audio = eq.consume<EventType.Audio>(EventType.Audio);
    expect(audio).toHaveLength(1);
    expect(audio[0].sound).toBe(SoundId.EnemyHitFlesh);
  });

  // 2. Damage exceeds remaining health — clamp at 0
  it('clamps health at 0 when damage exceeds remaining', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 10);
    const source = world.createEntity();

    emitDamage(eq, target, source, 50);
    damageSystem(world, eq);

    const health = world.getComponent<Health>(target, 'Health')!;
    expect(health.current).toBe(0);
  });

  // 3. Shield absorbs partial damage — remainder to health
  it('routes partial shield damage to health and resets timeSinceLastHit', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 100, { shield: 10 });
    const source = world.createEntity();

    emitDamage(eq, target, source, 25);
    damageSystem(world, eq);

    const health = world.getComponent<Health>(target, 'Health')!;
    const shield = world.getComponent<Shield>(target, 'Shield')!;
    expect(shield.current).toBe(0);
    expect(shield.timeSinceLastHit).toBe(0);
    expect(health.current).toBe(85);
  });

  // 4. Shield absorbs all damage — health unchanged
  it('does not reduce health when shield absorbs all damage', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 100, { shield: 50 });
    const source = world.createEntity();

    emitDamage(eq, target, source, 20);
    damageSystem(world, eq);

    const health = world.getComponent<Health>(target, 'Health')!;
    const shield = world.getComponent<Shield>(target, 'Shield')!;
    expect(shield.current).toBe(30);
    expect(shield.timeSinceLastHit).toBe(0);
    expect(health.current).toBe(100);
  });

  // 5. Shield at zero is skipped — timeSinceLastHit NOT reset
  it('does not reset timeSinceLastHit when shield is at 0', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 100, { shield: 0 });
    const source = world.createEntity();

    const shield = world.getComponent<Shield>(target, 'Shield')!;
    shield.timeSinceLastHit = 5;

    emitDamage(eq, target, source, 10);
    damageSystem(world, eq);

    expect(shield.timeSinceLastHit).toBe(5);
    const health = world.getComponent<Health>(target, 'Health')!;
    expect(health.current).toBe(90);
  });

  // 6. Armor absorbs partial damage — remainder to health
  it('routes partial armor damage to health', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 100, { armor: 10 });
    const source = world.createEntity();

    emitDamage(eq, target, source, 25);
    damageSystem(world, eq);

    const health = world.getComponent<Health>(target, 'Health')!;
    const armor = world.getComponent<Armor>(target, 'Armor')!;
    expect(armor.current).toBe(0);
    expect(health.current).toBe(85);
  });

  // 7. Armor absorbs all damage — health unchanged
  it('does not reduce health when armor absorbs all damage', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 100, { armor: 50 });
    const source = world.createEntity();

    emitDamage(eq, target, source, 20);
    damageSystem(world, eq);

    const health = world.getComponent<Health>(target, 'Health')!;
    const armor = world.getComponent<Armor>(target, 'Armor')!;
    expect(armor.current).toBe(30);
    expect(health.current).toBe(100);
  });

  // 8. Shield + Armor + Health cascade
  it('cascades 50 damage through shield(10) + armor(15) + health', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 100, { shield: 10, armor: 15 });
    const source = world.createEntity();

    emitDamage(eq, target, source, 50);
    damageSystem(world, eq);

    const health = world.getComponent<Health>(target, 'Health')!;
    const shield = world.getComponent<Shield>(target, 'Shield')!;
    const armor = world.getComponent<Armor>(target, 'Armor')!;
    expect(shield.current).toBe(0);
    expect(armor.current).toBe(0);
    expect(health.current).toBe(75); // 50 - 10 - 15 = 25 to health → 100 - 25 = 75
  });

  // 9. Zero damage event — no state change
  it('does not change state on zero damage event', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 100, { shield: 10 });
    const source = world.createEntity();

    const shield = world.getComponent<Shield>(target, 'Shield')!;
    shield.timeSinceLastHit = 5;

    emitDamage(eq, target, source, 0);
    damageSystem(world, eq);

    const health = world.getComponent<Health>(target, 'Health')!;
    expect(health.current).toBe(100);
    expect(shield.current).toBe(10);
    expect(shield.timeSinceLastHit).toBe(5);
  });

  // 10. Multiple damage events same target same frame
  it('processes multiple damage events to same target sequentially', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 100);
    const source = world.createEntity();

    emitDamage(eq, target, source, 20);
    emitDamage(eq, target, source, 30);
    emitDamage(eq, target, source, 15);
    damageSystem(world, eq);

    const health = world.getComponent<Health>(target, 'Health')!;
    expect(health.current).toBe(35); // 100 - 20 - 30 - 15
  });

  // 11. lastDamageSourceGunSlot written for player projectile
  it('writes lastDamageSourceGunSlot for player projectile source', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 100);
    const source = createPlayerProjectileSource(world, WeaponSlot.LongArm);

    emitDamage(eq, target, source, 10);
    damageSystem(world, eq);

    const health = world.getComponent<Health>(target, 'Health')!;
    expect(health.lastDamageSourceGunSlot).toBe(WeaponSlot.LongArm);
  });

  // 12. lastDamageSourceGunSlot NOT written for enemy projectile
  it('does not write lastDamageSourceGunSlot for enemy projectile', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 100);
    const source = createEnemyProjectileSource(world);

    emitDamage(eq, target, source, 10);
    damageSystem(world, eq);

    const health = world.getComponent<Health>(target, 'Health')!;
    expect(health.lastDamageSourceGunSlot).toBeNull();
  });

  // 13. lastDamageSourceGunSlot NOT written for non-projectile damage (melee)
  it('does not write lastDamageSourceGunSlot for non-projectile source', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 100);
    const source = world.createEntity(); // no Projectile component

    emitDamage(eq, target, source, 10);
    damageSystem(world, eq);

    const health = world.getComponent<Health>(target, 'Health')!;
    expect(health.lastDamageSourceGunSlot).toBeNull();
  });

  // 14. Correct particle type: BloodSplat for enemy, Sparks for destructible
  it('emits Sparks for destructible entities', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createDestructibleEntity(world, 50);
    const source = world.createEntity();

    emitDamage(eq, target, source, 10);
    damageSystem(world, eq);

    const destructible = world.getComponent<Destructible>(target, 'Destructible')!;
    expect(destructible.health).toBe(40);

    const particles = eq.consume<EventType.Particle>(EventType.Particle);
    expect(particles).toHaveLength(1);
    expect(particles[0].effect).toBe(ParticleEffect.Sparks);
  });

  // 15. Audio: EnemyHitArmor when shield/armor absorbed, EnemyHitFlesh when health-only
  it('emits EnemyHitArmor when shield absorbs damage', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 100, { shield: 50 });
    const source = world.createEntity();

    emitDamage(eq, target, source, 10);
    damageSystem(world, eq);

    const audio = eq.consume<EventType.Audio>(EventType.Audio);
    expect(audio).toHaveLength(1);
    expect(audio[0].sound).toBe(SoundId.EnemyHitArmor);
  });

  it('emits EnemyHitArmor when armor absorbs damage', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 100, { armor: 50 });
    const source = world.createEntity();

    emitDamage(eq, target, source, 10);
    damageSystem(world, eq);

    const audio = eq.consume<EventType.Audio>(EventType.Audio);
    expect(audio).toHaveLength(1);
    expect(audio[0].sound).toBe(SoundId.EnemyHitArmor);
  });

  // 16. Critical hit DamageNumberEvent includes isCritical=true
  it('emits DamageNumberEvent with isCritical=true for critical hits', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 100);
    const source = world.createEntity();

    emitDamage(eq, target, source, 30, true);
    damageSystem(world, eq);

    const dmgNumbers = eq.consume<EventType.DamageNumber>(EventType.DamageNumber);
    expect(dmgNumbers).toHaveLength(1);
    expect(dmgNumbers[0].isCritical).toBe(true);
    expect(dmgNumbers[0].amount).toBe(30);
  });

  // 17. Damage to entity already at health=0 — stays 0
  it('keeps health at 0 when entity already dead', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 0);
    const source = world.createEntity();

    emitDamage(eq, target, source, 10);
    damageSystem(world, eq);

    const health = world.getComponent<Health>(target, 'Health')!;
    expect(health.current).toBe(0);
  });

  // Edge: Source entity no longer exists — no crash, skip sourceGunSlot
  it('does not crash when source entity no longer exists', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 100);
    const source = world.createEntity();
    world.destroyEntity(source);

    emitDamage(eq, target, source, 10);
    damageSystem(world, eq);

    const health = world.getComponent<Health>(target, 'Health')!;
    expect(health.current).toBe(90);
    expect(health.lastDamageSourceGunSlot).toBeNull();
  });

  // Edge: Shield.current fractional (0.001) — still routes through shield
  it('routes through fractional shield value', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 100, { shield: 0.001 });
    const source = world.createEntity();

    emitDamage(eq, target, source, 10);
    damageSystem(world, eq);

    const shield = world.getComponent<Shield>(target, 'Shield')!;
    expect(shield.current).toBe(0);
    expect(shield.timeSinceLastHit).toBe(0);

    const health = world.getComponent<Health>(target, 'Health')!;
    expect(health.current).toBeCloseTo(90.001);
  });

  // Edge: Very large damage — all layers clamp at 0
  it('handles very large damage through all layers', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 100, { shield: 10, armor: 15 });
    const source = world.createEntity();

    emitDamage(eq, target, source, 999999);
    damageSystem(world, eq);

    const shield = world.getComponent<Shield>(target, 'Shield')!;
    const armor = world.getComponent<Armor>(target, 'Armor')!;
    const health = world.getComponent<Health>(target, 'Health')!;
    expect(shield.current).toBe(0);
    expect(armor.current).toBe(0);
    expect(health.current).toBe(0);
  });

  // DamageNumberEvent position matches impact position
  it('emits DamageNumberEvent with correct position', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyWithHealth(world, 100);
    const source = world.createEntity();

    eq.emit({
      type: EventType.Damage,
      target,
      source,
      amount: 10,
      isCritical: false,
      impactPosition: { x: 5, y: 10, z: 15 },
    });
    damageSystem(world, eq);

    const dmgNumbers = eq.consume<EventType.DamageNumber>(EventType.DamageNumber);
    expect(dmgNumbers[0].position).toEqual({ x: 5, y: 10, z: 15 });
  });

  // Property-based: health never goes negative
  it('property: health never goes negative for any damage amount', () => {
    fc.assert(
      fc.property(
        fc.nat(10000),
        fc.nat(10000),
        (initialHealth, damageAmount) => {
          const world = new World();
          const eq = new EventQueue();
          const target = createEnemyWithHealth(world, initialHealth);
          const source = world.createEntity();

          emitDamage(eq, target, source, damageAmount);
          damageSystem(world, eq);

          const health = world.getComponent<Health>(target, 'Health')!;
          return health.current >= 0;
        },
      ),
    );
  });

  // Property-based: shield never goes negative
  it('property: shield never goes negative for any damage amount', () => {
    fc.assert(
      fc.property(
        fc.nat(10000),
        fc.nat(10000),
        fc.nat(10000),
        (initialHealth, initialShield, damageAmount) => {
          const world = new World();
          const eq = new EventQueue();
          const target = createEnemyWithHealth(world, initialHealth, { shield: initialShield });
          const source = world.createEntity();

          emitDamage(eq, target, source, damageAmount);
          damageSystem(world, eq);

          const shield = world.getComponent<Shield>(target, 'Shield')!;
          const health = world.getComponent<Health>(target, 'Health')!;
          return shield.current >= 0 && health.current >= 0;
        },
      ),
    );
  });

  // Property-based: total damage absorbed equals original damage (or total pool)
  it('property: damage absorbed across layers is consistent', () => {
    fc.assert(
      fc.property(
        fc.nat(10000),
        fc.nat(10000),
        fc.nat(10000),
        fc.nat(10000),
        (initialHealth, initialShield, initialArmor, damageAmount) => {
          const world = new World();
          const eq = new EventQueue();
          const target = createEnemyWithHealth(world, initialHealth, {
            shield: initialShield,
            armor: initialArmor,
          });
          const source = world.createEntity();

          emitDamage(eq, target, source, damageAmount);
          damageSystem(world, eq);

          const shield = world.getComponent<Shield>(target, 'Shield')!;
          const armor = world.getComponent<Armor>(target, 'Armor')!;
          const health = world.getComponent<Health>(target, 'Health')!;

          const shieldAbsorbed = initialShield - shield.current;
          const armorAbsorbed = initialArmor - armor.current;
          const healthAbsorbed = initialHealth - health.current;
          const totalAbsorbed = shieldAbsorbed + armorAbsorbed + healthAbsorbed;
          const totalPool = initialShield + initialArmor + initialHealth;

          const expectedAbsorbed = Math.min(damageAmount, totalPool);
          return Math.abs(totalAbsorbed - expectedAbsorbed) < 0.001;
        },
      ),
    );
  });

  // Property-based: destructible health never goes negative
  it('property: destructible health never goes negative', () => {
    fc.assert(
      fc.property(
        fc.nat(10000),
        fc.nat(10000),
        (initialHealth, damageAmount) => {
          const world = new World();
          const eq = new EventQueue();
          const target = createDestructibleEntity(world, initialHealth);
          const source = world.createEntity();

          emitDamage(eq, target, source, damageAmount);
          damageSystem(world, eq);

          const destructible = world.getComponent<Destructible>(target, 'Destructible')!;
          return destructible.health >= 0;
        },
      ),
    );
  });
});
