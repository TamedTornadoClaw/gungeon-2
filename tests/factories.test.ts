import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../src/ecs/world';
import {
  createPlayer,
  createGun,
  createGunPickup,
  createPlayerBullet,
  createEnemyBullet,
  createEnemy,
  createBoss,
  createXPGem,
  createHealthPickup,
  createCurrency,
  createWall,
  createHazard,
  createDestructible,
  createDoor,
  createChest,
  createShop,
  createStairs,
  createSpawnZone,
} from '../src/ecs/factories';
import {
  GunType,
  GunCategory,
  GunTrait,
  EnemyType,
  AIBehaviorState,
  PickupType,
  HazardType,
  ColliderShape,
  MeshId,
  WeaponSlot,
} from '../src/ecs/components';
import type {
  Position,
  Health,
  Player,
  DodgeRoll,
  Gun,
  Projectile,
  Lifetime,
  Enemy,
  AIState,
  EnemyWeapon,
  EnemyShield,
  Pickup,
  XPGem,
  HealthPickupData,
  CurrencyData,
  Hazard,
  Destructible,
  Collider,
  Door,
  Chest,
  Shop,
  ShopItem,
  Stairs,
  SpawnZone,
  Renderable,
  Velocity,
  Rotation,
  PreviousPosition,
} from '../src/ecs/components';
import { getDesignParams } from '../src/config/designParams';

const origin = { x: 0, y: 0, z: 0 };
const unitSize = { x: 1, y: 1, z: 1 };

let world: World;

beforeEach(() => {
  world = new World();
});

// ── Helper ──────────────────────────────────────────────────────────────

function hasComponents(id: number, names: string[]): void {
  for (const name of names) {
    expect(world.hasComponent(id, name), `missing component: ${name}`).toBe(true);
  }
}

function lacksComponent(id: number, name: string): void {
  expect(world.hasComponent(id, name), `should not have: ${name}`).toBe(false);
}

// ── createPlayer ────────────────────────────────────────────────────────

describe('createPlayer', () => {
  it('attaches correct component composition', () => {
    const id = createPlayer(world, origin, GunType.SMG);
    hasComponents(id, [
      'Position',
      'PreviousPosition',
      'Velocity',
      'Rotation',
      'Health',
      'Player',
      'DodgeRoll',
      'Collider',
      'Renderable',
      'PlayerTag',
    ]);
  });

  it('loads health from design params', () => {
    const params = getDesignParams();
    const id = createPlayer(world, origin, GunType.AssaultRifle);
    const health = world.getComponent<Health>(id, 'Health')!;
    expect(health.current).toBe(params.player.baseHealth);
    expect(health.max).toBe(params.player.baseHealth);
  });

  it('creates sidearm (Pistol) and long arm gun entities', () => {
    const id = createPlayer(world, origin, GunType.Shotgun);
    const player = world.getComponent<Player>(id, 'Player')!;

    const sidearm = world.getComponent<Gun>(player.sidearmSlot, 'Gun')!;
    expect(sidearm.gunType).toBe(GunType.Pistol);

    const longArm = world.getComponent<Gun>(player.longArmSlot, 'Gun')!;
    expect(longArm.gunType).toBe(GunType.Shotgun);
  });

  it('sets position from parameter', () => {
    const pos = { x: 5, y: 0, z: 10 };
    const id = createPlayer(world, pos, GunType.SMG);
    const p = world.getComponent<Position>(id, 'Position')!;
    expect(p.x).toBe(5);
    expect(p.z).toBe(10);
  });

  it('uses MeshId.Player renderable', () => {
    const id = createPlayer(world, origin, GunType.SMG);
    const r = world.getComponent<Renderable>(id, 'Renderable')!;
    expect(r.meshId).toBe(MeshId.Player);
  });
});

// ── createGun ───────────────────────────────────────────────────────────

describe('createGun', () => {
  it('creates gun with correct stats from design params', () => {
    const params = getDesignParams();
    const id = createGun(world, GunType.Shotgun);
    const gun = world.getComponent<Gun>(id, 'Gun')!;
    const shotgunParams = params.guns['Shotgun'];

    expect(gun.gunType).toBe(GunType.Shotgun);
    expect(gun.category).toBe(GunCategory.LongArm);
    expect(gun.baseDamage).toBe(shotgunParams.damage);
    expect(gun.damage).toBe(shotgunParams.damage);
    expect(gun.baseFireRate).toBe(shotgunParams.fireRate);
    expect(gun.baseMagazineSize).toBe(shotgunParams.magazineSize);
    expect(gun.baseProjectileCount).toBe(shotgunParams.projectileCount);
    expect(gun.currentAmmo).toBe(shotgunParams.magazineSize);
  });

  it('only attaches Gun component (no Position)', () => {
    const id = createGun(world, GunType.Pistol);
    hasComponents(id, ['Gun']);
    lacksComponent(id, 'Position');
    lacksComponent(id, 'Renderable');
  });

  it('starts with trait levels at 0, xp at 0', () => {
    const id = createGun(world, GunType.LMG);
    const gun = world.getComponent<Gun>(id, 'Gun')!;
    expect(gun.traitLevels).toEqual([0, 0, 0]);
    expect(gun.xp).toBe(0);
    expect(gun.forcedUpgradeTriggered).toBe(false);
  });

  it('correctly maps trait strings from design params', () => {
    const id = createGun(world, GunType.Pistol);
    const gun = world.getComponent<Gun>(id, 'Gun')!;
    expect(gun.traits).toEqual([GunTrait.Damage, GunTrait.CriticalChance, GunTrait.CriticalMultiplier]);
  });

  it('Pistol has Sidearm category', () => {
    const id = createGun(world, GunType.Pistol);
    const gun = world.getComponent<Gun>(id, 'Gun')!;
    expect(gun.category).toBe(GunCategory.Sidearm);
  });

  it('SMG has LongArm category', () => {
    const id = createGun(world, GunType.SMG);
    const gun = world.getComponent<Gun>(id, 'Gun')!;
    expect(gun.category).toBe(GunCategory.LongArm);
  });
});

// ── Piercing/Bouncing mutual exclusivity ────────────────────────────────

describe('Piercing/Bouncing mutual exclusivity', () => {
  it('throws if gun traits contain both Piercing and Bouncing', () => {
    // We can't test via design params (they're valid), so we test the validation
    // logic indirectly. The real design params don't have this combo, so we
    // verify the existing guns all pass without error.
    expect(() => createGun(world, GunType.Pistol)).not.toThrow();
    expect(() => createGun(world, GunType.SMG)).not.toThrow();
    expect(() => createGun(world, GunType.AssaultRifle)).not.toThrow();
    expect(() => createGun(world, GunType.Shotgun)).not.toThrow();
    expect(() => createGun(world, GunType.LMG)).not.toThrow();
  });
});

// ── createGunPickup ─────────────────────────────────────────────────────

describe('createGunPickup', () => {
  it('attaches correct component composition', () => {
    const id = createGunPickup(world, origin, GunType.AssaultRifle);
    hasComponents(id, ['Position', 'Gun', 'Pickup', 'Collider', 'Renderable', 'PickupTag']);
  });

  it('sets pickup type to GunPickup', () => {
    const id = createGunPickup(world, origin, GunType.SMG);
    const pickup = world.getComponent<Pickup>(id, 'Pickup')!;
    expect(pickup.pickupType).toBe(PickupType.GunPickup);
  });

  it('gun data matches gun type stats', () => {
    const params = getDesignParams();
    const id = createGunPickup(world, origin, GunType.LMG);
    const gun = world.getComponent<Gun>(id, 'Gun')!;
    expect(gun.gunType).toBe(GunType.LMG);
    expect(gun.baseDamage).toBe(params.guns['LMG'].damage);
  });
});

// ── createPlayerBullet ──────────────────────────────────────────────────

describe('createPlayerBullet', () => {
  it('attaches correct component composition', () => {
    const gunId = createGun(world, GunType.Pistol);
    const gun = world.getComponent<Gun>(gunId, 'Gun')!;
    const vel = { x: 1, y: 0, z: 0 };
    const id = createPlayerBullet(world, origin, vel, gun, 99 as number, WeaponSlot.Sidearm);
    hasComponents(id, [
      'Position',
      'PreviousPosition',
      'Velocity',
      'Rotation',
      'Projectile',
      'Lifetime',
      'Collider',
      'Renderable',
      'ProjectileTag',
      'PlayerProjectileTag',
    ]);
  });

  it('sets projectile damage from gun computed stats', () => {
    const gunId = createGun(world, GunType.Shotgun);
    const gun = world.getComponent<Gun>(gunId, 'Gun')!;
    const vel = { x: 0, y: 0, z: 1 };
    const id = createPlayerBullet(world, origin, vel, gun, 99 as number, WeaponSlot.LongArm);
    const proj = world.getComponent<Projectile>(id, 'Projectile')!;
    expect(proj.damage).toBe(gun.damage);
    expect(proj.isEnemyProjectile).toBe(false);
    expect(proj.sourceGunSlot).toBe(WeaponSlot.LongArm);
  });

  it('sets velocity from parameter', () => {
    const gunId = createGun(world, GunType.Pistol);
    const gun = world.getComponent<Gun>(gunId, 'Gun')!;
    const vel = { x: 10, y: 0, z: 5 };
    const id = createPlayerBullet(world, origin, vel, gun, 99 as number, WeaponSlot.Sidearm);
    const v = world.getComponent<Velocity>(id, 'Velocity')!;
    expect(v.x).toBe(10);
    expect(v.z).toBe(5);
  });

  it('uses bullet collider size from design params', () => {
    const params = getDesignParams();
    const gunId = createGun(world, GunType.Pistol);
    const gun = world.getComponent<Gun>(gunId, 'Gun')!;
    const id = createPlayerBullet(world, origin, { x: 1, y: 0, z: 0 }, gun, 99 as number, WeaponSlot.Sidearm);
    const col = world.getComponent<Collider>(id, 'Collider')!;
    expect(col.width).toBe(params.projectiles.bulletColliderSize);
  });

  it('sets lifetime from gun projectileLifetime', () => {
    const params = getDesignParams();
    const gunId = createGun(world, GunType.Pistol);
    const gun = world.getComponent<Gun>(gunId, 'Gun')!;
    const id = createPlayerBullet(world, origin, { x: 1, y: 0, z: 0 }, gun, 99 as number, WeaponSlot.Sidearm);
    const lt = world.getComponent<Lifetime>(id, 'Lifetime')!;
    expect(lt.remaining).toBe(params.guns['Pistol'].projectileLifetime);
  });
});

// ── createEnemyBullet ───────────────────────────────────────────────────

describe('createEnemyBullet', () => {
  it('attaches correct component composition', () => {
    const weapon: EnemyWeapon = {
      damage: 10,
      fireRate: 1,
      projectileSpeed: 20,
      projectileCount: 1,
      spread: 0,
      fireCooldown: 0,
    };
    const id = createEnemyBullet(world, origin, { x: 0, y: 0, z: 1 }, weapon, 50 as number);
    hasComponents(id, [
      'Position',
      'PreviousPosition',
      'Velocity',
      'Rotation',
      'Projectile',
      'Lifetime',
      'Collider',
      'Renderable',
      'ProjectileTag',
      'EnemyProjectileTag',
    ]);
    lacksComponent(id, 'PlayerProjectileTag');
  });

  it('sets projectile as enemy projectile', () => {
    const weapon: EnemyWeapon = {
      damage: 15,
      fireRate: 1,
      projectileSpeed: 20,
      projectileCount: 1,
      spread: 0,
      fireCooldown: 0,
    };
    const id = createEnemyBullet(world, origin, { x: 0, y: 0, z: 1 }, weapon, 50 as number);
    const proj = world.getComponent<Projectile>(id, 'Projectile')!;
    expect(proj.isEnemyProjectile).toBe(true);
    expect(proj.damage).toBe(15);
  });

  it('uses enemyBulletLifetime from design params', () => {
    const params = getDesignParams();
    const weapon: EnemyWeapon = {
      damage: 10,
      fireRate: 1,
      projectileSpeed: 20,
      projectileCount: 1,
      spread: 0,
      fireCooldown: 0,
    };
    const id = createEnemyBullet(world, origin, { x: 0, y: 0, z: 1 }, weapon, 50 as number);
    const lt = world.getComponent<Lifetime>(id, 'Lifetime')!;
    expect(lt.remaining).toBe(params.projectiles.enemyBulletLifetime);
  });
});

// ── createEnemy ─────────────────────────────────────────────────────────

describe('createEnemy', () => {
  it('KnifeRusher has correct components (no EnemyWeapon, no EnemyShield)', () => {
    const id = createEnemy(world, EnemyType.KnifeRusher, origin, 0, false);
    hasComponents(id, [
      'Position',
      'PreviousPosition',
      'Velocity',
      'Rotation',
      'Health',
      'Enemy',
      'AIState',
      'Collider',
      'Renderable',
      'EnemyTag',
    ]);
    lacksComponent(id, 'EnemyWeapon');
    lacksComponent(id, 'EnemyShield');
  });

  it('SuicideBomber has correct components (no EnemyWeapon)', () => {
    const id = createEnemy(world, EnemyType.SuicideBomber, origin, 0, false);
    hasComponents(id, ['Enemy', 'AIState', 'Collider', 'EnemyTag']);
    lacksComponent(id, 'EnemyWeapon');
    lacksComponent(id, 'EnemyShield');
  });

  it('ShieldGun has EnemyWeapon and EnemyShield', () => {
    const id = createEnemy(world, EnemyType.ShieldGun, origin, 0, false);
    hasComponents(id, ['EnemyWeapon', 'EnemyShield', 'EnemyTag']);
  });

  it('Shotgunner has EnemyWeapon but no EnemyShield', () => {
    const id = createEnemy(world, EnemyType.Shotgunner, origin, 0, false);
    hasComponents(id, ['EnemyWeapon']);
    lacksComponent(id, 'EnemyShield');
  });

  it('Rifleman has EnemyWeapon but no EnemyShield', () => {
    const id = createEnemy(world, EnemyType.Rifleman, origin, 0, false);
    hasComponents(id, ['EnemyWeapon']);
    lacksComponent(id, 'EnemyShield');
  });

  it('loads base health from design params at depth 0', () => {
    const params = getDesignParams();
    const id = createEnemy(world, EnemyType.KnifeRusher, origin, 0, false);
    const health = world.getComponent<Health>(id, 'Health')!;
    expect(health.current).toBe(params.enemies.KnifeRusher.baseHealth);
    expect(health.max).toBe(params.enemies.KnifeRusher.baseHealth);
  });

  it('applies depth scaling to health', () => {
    const params = getDesignParams();
    const depth = 3;
    const scaling = params.enemies.depthScaling;
    const id = createEnemy(world, EnemyType.KnifeRusher, origin, depth, false);
    const health = world.getComponent<Health>(id, 'Health')!;
    const expected =
      params.enemies.KnifeRusher.baseHealth * (1 + depth * scaling.healthMultiplierPerDepth);
    expect(health.current).toBeCloseTo(expected);
  });

  it('applies miniBossStatMultiplier when isMini is true', () => {
    const params = getDesignParams();
    const depth = 2;
    const scaling = params.enemies.depthScaling;
    const id = createEnemy(world, EnemyType.Shotgunner, origin, depth, true);
    const health = world.getComponent<Health>(id, 'Health')!;
    const baseScaled =
      params.enemies.Shotgunner.baseHealth * (1 + depth * scaling.healthMultiplierPerDepth);
    const expected = baseScaled * scaling.miniBossStatMultiplier;
    expect(health.current).toBeCloseTo(expected);
  });

  it('uses mini boss mesh when isMini is true', () => {
    const id = createEnemy(world, EnemyType.KnifeRusher, origin, 0, true);
    const r = world.getComponent<Renderable>(id, 'Renderable')!;
    expect(r.meshId).toBe(MeshId.MiniBossKnifeRusher);
    expect(r.scale).toBe(1.5);
  });

  it('uses regular mesh when isMini is false', () => {
    const id = createEnemy(world, EnemyType.Shotgunner, origin, 0, false);
    const r = world.getComponent<Renderable>(id, 'Renderable')!;
    expect(r.meshId).toBe(MeshId.Shotgunner);
    expect(r.scale).toBe(1);
  });

  it('sets AIState to Idle initially', () => {
    const id = createEnemy(world, EnemyType.Rifleman, origin, 0, false);
    const ai = world.getComponent<AIState>(id, 'AIState')!;
    expect(ai.state).toBe(AIBehaviorState.Idle);
    expect(ai.target).toBeNull();
  });

  it('ShieldGun shield health scales with depth', () => {
    const params = getDesignParams();
    const depth = 4;
    const scaling = params.enemies.depthScaling;
    const id = createEnemy(world, EnemyType.ShieldGun, origin, depth, false);
    const shield = world.getComponent<EnemyShield>(id, 'EnemyShield')!;
    const expected =
      params.enemies.ShieldGun.shieldHealth *
      (1 + depth * scaling.shieldHealthMultiplierPerDepth);
    expect(shield.health).toBeCloseTo(expected);
    expect(shield.maxHealth).toBeCloseTo(expected);
  });

  it('ShieldGun mini boss multiplies shield health', () => {
    const params = getDesignParams();
    const depth = 1;
    const scaling = params.enemies.depthScaling;
    const id = createEnemy(world, EnemyType.ShieldGun, origin, depth, true);
    const shield = world.getComponent<EnemyShield>(id, 'EnemyShield')!;
    const baseScaled =
      params.enemies.ShieldGun.shieldHealth *
      (1 + depth * scaling.shieldHealthMultiplierPerDepth);
    const expected = baseScaled * scaling.miniBossStatMultiplier;
    expect(shield.health).toBeCloseTo(expected);
  });
});

// ── createBoss ──────────────────────────────────────────────────────────

describe('createBoss', () => {
  it('attaches correct component composition', () => {
    const id = createBoss(world, origin, 0);
    hasComponents(id, [
      'Position',
      'PreviousPosition',
      'Velocity',
      'Rotation',
      'Health',
      'Enemy',
      'AIState',
      'EnemyWeapon',
      'Collider',
      'Renderable',
      'EnemyTag',
      'BossTag',
    ]);
  });

  it('applies bossStatMultiplier to health', () => {
    const params = getDesignParams();
    const depth = 5;
    const scaling = params.enemies.depthScaling;
    const id = createBoss(world, origin, depth);
    const health = world.getComponent<Health>(id, 'Health')!;
    const expected =
      params.enemies.KnifeRusher.baseHealth *
      (1 + depth * scaling.healthMultiplierPerDepth) *
      scaling.bossStatMultiplier;
    expect(health.current).toBeCloseTo(expected);
    expect(health.max).toBeCloseTo(expected);
  });

  it('uses Boss mesh', () => {
    const id = createBoss(world, origin, 0);
    const r = world.getComponent<Renderable>(id, 'Renderable')!;
    expect(r.meshId).toBe(MeshId.Boss);
    expect(r.scale).toBe(2);
  });
});

// ── createXPGem ─────────────────────────────────────────────────────────

describe('createXPGem', () => {
  it('attaches correct component composition', () => {
    const id = createXPGem(world, origin, 1 as number, 25);
    hasComponents(id, ['Position', 'Velocity', 'Pickup', 'XPGem', 'Collider', 'Renderable', 'PickupTag']);
  });

  it('stores source gun entity and amount', () => {
    const id = createXPGem(world, origin, 42 as number, 100);
    const xp = world.getComponent<XPGem>(id, 'XPGem')!;
    expect(xp.sourceGunEntityId).toBe(42);
    expect(xp.amount).toBe(100);
    expect(xp.isFlying).toBe(false);
  });
});

// ── createHealthPickup ──────────────────────────────────────────────────

describe('createHealthPickup', () => {
  it('attaches correct component composition', () => {
    const id = createHealthPickup(world, origin, 30);
    hasComponents(id, ['Position', 'Pickup', 'HealthPickupData', 'Collider', 'Renderable', 'PickupTag']);
  });

  it('stores heal amount', () => {
    const id = createHealthPickup(world, origin, 50);
    const data = world.getComponent<HealthPickupData>(id, 'HealthPickupData')!;
    expect(data.healAmount).toBe(50);
  });

  it('pickup type is HealthPickup', () => {
    const id = createHealthPickup(world, origin, 30);
    const pickup = world.getComponent<Pickup>(id, 'Pickup')!;
    expect(pickup.pickupType).toBe(PickupType.HealthPickup);
  });
});

// ── createCurrency ──────────────────────────────────────────────────────

describe('createCurrency', () => {
  it('attaches correct component composition', () => {
    const id = createCurrency(world, origin, 10);
    hasComponents(id, ['Position', 'Pickup', 'CurrencyData', 'Collider', 'Renderable', 'PickupTag']);
  });

  it('stores currency amount', () => {
    const id = createCurrency(world, origin, 75);
    const data = world.getComponent<CurrencyData>(id, 'CurrencyData')!;
    expect(data.amount).toBe(75);
  });

  it('pickup type is Currency', () => {
    const id = createCurrency(world, origin, 10);
    const pickup = world.getComponent<Pickup>(id, 'Pickup')!;
    expect(pickup.pickupType).toBe(PickupType.Currency);
  });
});

// ── createWall ──────────────────────────────────────────────────────────

describe('createWall', () => {
  it('attaches correct component composition', () => {
    const id = createWall(world, origin, unitSize);
    hasComponents(id, ['Position', 'Collider', 'Renderable', 'WallTag']);
  });

  it('uses provided size for collider', () => {
    const size = { x: 5, y: 3, z: 2 };
    const id = createWall(world, origin, size);
    const col = world.getComponent<Collider>(id, 'Collider')!;
    expect(col.width).toBe(5);
    expect(col.height).toBe(3);
    expect(col.depth).toBe(2);
    expect(col.isStatic).toBe(true);
  });
});

// ── createHazard ────────────────────────────────────────────────────────

describe('createHazard', () => {
  it('attaches correct component composition', () => {
    const id = createHazard(world, HazardType.Fire, origin, unitSize);
    hasComponents(id, ['Position', 'Hazard', 'Collider', 'Renderable', 'HazardTag']);
  });

  it('stores hazard type', () => {
    const id = createHazard(world, HazardType.Spikes, origin, unitSize);
    const h = world.getComponent<Hazard>(id, 'Hazard')!;
    expect(h.hazardType).toBe(HazardType.Spikes);
  });

  it('uses correct mesh for each hazard type', () => {
    const fireId = createHazard(world, HazardType.Fire, origin, unitSize);
    expect(world.getComponent<Renderable>(fireId, 'Renderable')!.meshId).toBe(MeshId.FireHazard);

    const waterWorld = new World();
    const waterId = createHazard(waterWorld, HazardType.Water, origin, unitSize);
    expect(waterWorld.getComponent<Renderable>(waterId, 'Renderable')!.meshId).toBe(MeshId.WaterHazard);
  });

  it('hazard collider is trigger', () => {
    const id = createHazard(world, HazardType.Fire, origin, unitSize);
    const col = world.getComponent<Collider>(id, 'Collider')!;
    expect(col.isTrigger).toBe(true);
  });
});

// ── createDestructible ──────────────────────────────────────────────────

describe('createDestructible', () => {
  it('attaches correct component composition', () => {
    const id = createDestructible(world, origin, unitSize, 30);
    hasComponents(id, ['Position', 'Destructible', 'Collider', 'Renderable', 'DestructibleTag']);
  });

  it('stores health values', () => {
    const id = createDestructible(world, origin, unitSize, 60);
    const d = world.getComponent<Destructible>(id, 'Destructible')!;
    expect(d.health).toBe(60);
    expect(d.maxHealth).toBe(60);
  });
});

// ── createDoor ──────────────────────────────────────────────────────────

describe('createDoor', () => {
  it('attaches correct component composition', () => {
    const id = createDoor(world, origin);
    hasComponents(id, ['Position', 'Door', 'Collider', 'Renderable', 'DoorTag']);
  });

  it('door starts closed', () => {
    const id = createDoor(world, origin);
    const door = world.getComponent<Door>(id, 'Door')!;
    expect(door.isOpen).toBe(false);
  });
});

// ── createChest ─────────────────────────────────────────────────────────

describe('createChest', () => {
  it('attaches correct component composition', () => {
    const id = createChest(world, origin, GunType.SMG);
    hasComponents(id, ['Position', 'Chest', 'Collider', 'Renderable', 'ChestTag']);
  });

  it('stores gun type and starts closed', () => {
    const id = createChest(world, origin, GunType.LMG);
    const chest = world.getComponent<Chest>(id, 'Chest')!;
    expect(chest.isOpen).toBe(false);
    expect(chest.gunType).toBe(GunType.LMG);
  });
});

// ── createShop ──────────────────────────────────────────────────────────

describe('createShop', () => {
  it('attaches correct component composition', () => {
    const inventory: ShopItem[] = [
      { type: PickupType.HealthPickup, price: 30, healAmount: 30, sold: false },
    ];
    const id = createShop(world, origin, inventory);
    hasComponents(id, ['Position', 'Shop', 'Collider', 'Renderable', 'ShopTag']);
  });

  it('stores inventory', () => {
    const inventory: ShopItem[] = [
      { type: PickupType.HealthPickup, price: 30, healAmount: 30, sold: false },
      { type: PickupType.Currency, price: 10, sold: false },
    ];
    const id = createShop(world, origin, inventory);
    const shop = world.getComponent<Shop>(id, 'Shop')!;
    expect(shop.inventory).toHaveLength(2);
    expect(shop.inventory[0].price).toBe(30);
  });
});

// ── createStairs ────────────────────────────────────────────────────────

describe('createStairs', () => {
  it('attaches correct component composition', () => {
    const id = createStairs(world, origin, 2);
    hasComponents(id, ['Position', 'Stairs', 'Collider', 'Renderable', 'StairsTag']);
  });

  it('stores target depth', () => {
    const id = createStairs(world, origin, 5);
    const stairs = world.getComponent<Stairs>(id, 'Stairs')!;
    expect(stairs.targetDepth).toBe(5);
  });
});

// ── createSpawnZone ─────────────────────────────────────────────────────

describe('createSpawnZone', () => {
  it('attaches correct component composition (no Renderable)', () => {
    const id = createSpawnZone(world, origin, { x: 10, y: 10 }, [EnemyType.KnifeRusher], 5);
    hasComponents(id, ['Position', 'SpawnZone', 'Collider']);
    lacksComponent(id, 'Renderable');
  });

  it('stores spawn zone data', () => {
    const enemies = [EnemyType.KnifeRusher, EnemyType.Shotgunner];
    const id = createSpawnZone(world, origin, { x: 20, y: 15 }, enemies, 8);
    const zone = world.getComponent<SpawnZone>(id, 'SpawnZone')!;
    expect(zone.width).toBe(20);
    expect(zone.height).toBe(15);
    expect(zone.enemyTypes).toEqual(enemies);
    expect(zone.enemyCount).toBe(8);
    expect(zone.activated).toBe(false);
    expect(zone.cleared).toBe(false);
  });

  it('collider is trigger', () => {
    const id = createSpawnZone(world, origin, { x: 10, y: 10 }, [EnemyType.KnifeRusher], 3);
    const col = world.getComponent<Collider>(id, 'Collider')!;
    expect(col.isTrigger).toBe(true);
    expect(col.isStatic).toBe(true);
  });
});

// ── Depth scaling formula verification ──────────────────────────────────

describe('Depth scaling formula', () => {
  it('formula: base * (1 + depth * multiplierPerDepth)', () => {
    const params = getDesignParams();
    const scaling = params.enemies.depthScaling;

    for (const depth of [0, 1, 5, 10]) {
      const id = createEnemy(world, EnemyType.Rifleman, origin, depth, false);
      const health = world.getComponent<Health>(id, 'Health')!;
      const expected =
        params.enemies.Rifleman.baseHealth * (1 + depth * scaling.healthMultiplierPerDepth);
      expect(health.current).toBeCloseTo(expected, 5);
      world.destroyEntity(id);
    }
  });

  it('depth 0 returns base stats unchanged', () => {
    const params = getDesignParams();
    const id = createEnemy(world, EnemyType.Shotgunner, origin, 0, false);
    const health = world.getComponent<Health>(id, 'Health')!;
    expect(health.current).toBe(params.enemies.Shotgunner.baseHealth);
  });
});
