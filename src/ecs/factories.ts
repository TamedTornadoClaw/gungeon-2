import { World } from './world';
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
} from './components';
import type {
  Position,
  PreviousPosition,
  Velocity,
  Rotation,
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
} from './components';
import { getDesignParams } from '../config/designParams';
import type { BaseEnemyParams, RangedEnemyParams } from '../config/designParams';
import type { EntityId, Vec2, Vec3 } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────

const GUN_TYPE_KEYS: Record<GunType, string> = {
  [GunType.Pistol]: 'Pistol',
  [GunType.SMG]: 'SMG',
  [GunType.AssaultRifle]: 'AssaultRifle',
  [GunType.Shotgun]: 'Shotgun',
  [GunType.LMG]: 'LMG',
};

const GUN_CATEGORY_MAP: Record<string, GunCategory> = {
  Sidearm: GunCategory.Sidearm,
  LongArm: GunCategory.LongArm,
};

const GUN_TRAIT_MAP: Record<string, GunTrait> = {
  Damage: GunTrait.Damage,
  FireRate: GunTrait.FireRate,
  MagazineSize: GunTrait.MagazineSize,
  ReloadTime: GunTrait.ReloadTime,
  Spread: GunTrait.Spread,
  ProjectileCount: GunTrait.ProjectileCount,
  ProjectileSpeed: GunTrait.ProjectileSpeed,
  Knockback: GunTrait.Knockback,
  CriticalChance: GunTrait.CriticalChance,
  CriticalMultiplier: GunTrait.CriticalMultiplier,
  Piercing: GunTrait.Piercing,
  Bouncing: GunTrait.Bouncing,
};

const ENEMY_MESH_MAP: Record<EnemyType, MeshId> = {
  [EnemyType.KnifeRusher]: MeshId.KnifeRusher,
  [EnemyType.ShieldGun]: MeshId.ShieldGun,
  [EnemyType.Shotgunner]: MeshId.Shotgunner,
  [EnemyType.Rifleman]: MeshId.Rifleman,
  [EnemyType.SuicideBomber]: MeshId.SuicideBomber,
};

const MINI_BOSS_MESH_MAP: Record<EnemyType, MeshId> = {
  [EnemyType.KnifeRusher]: MeshId.MiniBossKnifeRusher,
  [EnemyType.ShieldGun]: MeshId.MiniBossShieldGun,
  [EnemyType.Shotgunner]: MeshId.MiniBossShotgunner,
  [EnemyType.Rifleman]: MeshId.MiniBossRifleman,
  [EnemyType.SuicideBomber]: MeshId.MiniBossSuicideBomber,
};

const GUN_MESH_MAP: Record<GunType, MeshId> = {
  [GunType.Pistol]: MeshId.Pistol,
  [GunType.SMG]: MeshId.SMG,
  [GunType.AssaultRifle]: MeshId.AssaultRifle,
  [GunType.Shotgun]: MeshId.Shotgun,
  [GunType.LMG]: MeshId.LMG,
};

const HAZARD_MESH_MAP: Record<HazardType, MeshId> = {
  [HazardType.Fire]: MeshId.FireHazard,
  [HazardType.Spikes]: MeshId.SpikeHazard,
  [HazardType.Water]: MeshId.WaterHazard,
};

function pos(v: Vec3): Position {
  return { x: v.x, y: v.y, z: v.z };
}

function prevPos(v: Vec3): PreviousPosition {
  return { x: v.x, y: v.y, z: v.z };
}

function zeroVelocity(): Velocity {
  return { x: 0, y: 0, z: 0 };
}

function zeroRotation(): Rotation {
  return { y: 0 };
}

function applyDepthScaling(base: number, depth: number, multiplierPerDepth: number): number {
  return base * (1 + depth * multiplierPerDepth);
}

export function validateTraitExclusivity(traits: GunTrait[]): void {
  const hasPiercing = traits.includes(GunTrait.Piercing);
  const hasBouncing = traits.includes(GunTrait.Bouncing);
  if (hasPiercing && hasBouncing) {
    throw new Error('Gun cannot have both Piercing and Bouncing traits');
  }
}

// ── Factory Functions ──────────────────────────────────────────────────────

export function createPlayer(world: World, position: Vec3, longArmType: GunType): EntityId {
  const params = getDesignParams();
  const id = world.createEntity();

  world.addComponent<Position>(id, 'Position', pos(position));
  world.addComponent<PreviousPosition>(id, 'PreviousPosition', prevPos(position));
  world.addComponent<Velocity>(id, 'Velocity', zeroVelocity());
  world.addComponent<Rotation>(id, 'Rotation', zeroRotation());
  world.addComponent<Health>(id, 'Health', {
    current: params.player.baseHealth,
    max: params.player.baseHealth,
    lastDamageSourceGunSlot: null,
  });
  world.addComponent<Player>(id, 'Player', {
    sidearmSlot: createGun(world, GunType.Pistol),
    longArmSlot: createGun(world, longArmType),
    activeSlot: WeaponSlot.LongArm,
    currency: 0,
  });
  world.addComponent<DodgeRoll>(id, 'DodgeRoll', {
    cooldownRemaining: 0,
    isRolling: false,
    rollTimer: 0,
    rollDirectionX: 0,
    rollDirectionY: 0,
  });
  const playerCollider = params.entityColliders.player;
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: playerCollider.width,
    height: playerCollider.height,
    depth: playerCollider.depth,
    isStatic: false,
    isTrigger: false,
  });
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: MeshId.Player,
    visible: true,
    scale: 1,
  });
  world.addComponent(id, 'PlayerTag', {});

  return id;
}

export function createGun(world: World, gunType: GunType): EntityId {
  const params = getDesignParams();
  const key = GUN_TYPE_KEYS[gunType];
  const gunParams = params.guns[key];
  if (!gunParams) {
    throw new Error(`Unknown gun type key: ${key}`);
  }

  const traits = gunParams.traits.map((t) => {
    const trait = GUN_TRAIT_MAP[t];
    if (trait === undefined) {
      throw new Error(`Unknown gun trait: ${t}`);
    }
    return trait;
  }) as [GunTrait, GunTrait, GunTrait];

  validateTraitExclusivity(traits);

  const category = GUN_CATEGORY_MAP[gunParams.category];
  if (category === undefined) {
    throw new Error(`Unknown gun category: ${gunParams.category}`);
  }

  const id = world.createEntity();

  world.addComponent<Gun>(id, 'Gun', {
    gunType,
    category,
    baseDamage: gunParams.damage,
    baseFireRate: gunParams.fireRate,
    baseMagazineSize: gunParams.magazineSize,
    baseReloadTime: gunParams.reloadTime,
    baseSpread: gunParams.spread,
    baseProjectileCount: gunParams.projectileCount,
    baseProjectileSpeed: gunParams.projectileSpeed,
    baseKnockback: gunParams.knockback,
    baseCritChance: gunParams.critChance,
    baseCritMultiplier: gunParams.critMultiplier,
    damage: gunParams.damage,
    fireRate: gunParams.fireRate,
    magazineSize: gunParams.magazineSize,
    reloadTime: gunParams.reloadTime,
    spread: gunParams.spread,
    projectileCount: gunParams.projectileCount,
    projectileSpeed: gunParams.projectileSpeed,
    knockback: gunParams.knockback,
    critChance: gunParams.critChance,
    critMultiplier: gunParams.critMultiplier,
    currentAmmo: gunParams.magazineSize,
    isReloading: false,
    reloadTimer: 0,
    fireCooldown: 0,
    fireRequested: false,
    traits,
    traitLevels: [0, 0, 0],
    xp: 0,
    forcedUpgradeTriggered: false,
  });

  return id;
}

export function createGunPickup(world: World, position: Vec3, gunType: GunType): EntityId {
  const id = world.createEntity();
  const gunEntityId = createGun(world, gunType);

  // Copy the Gun component from the gun entity to this pickup entity
  const gunData = world.getComponent<Gun>(gunEntityId, 'Gun')!;
  const pickupParams = getDesignParams();
  const gpCollider = pickupParams.entityColliders.gunPickup;
  world.addComponent<Position>(id, 'Position', pos(position));
  world.addComponent<Gun>(id, 'Gun', { ...gunData });
  world.addComponent<Pickup>(id, 'Pickup', { pickupType: PickupType.GunPickup });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: gpCollider.width,
    height: gpCollider.height,
    depth: gpCollider.depth,
    isStatic: true,
    isTrigger: true,
  });
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: GUN_MESH_MAP[gunType],
    visible: true,
    scale: 1,
  });
  world.addComponent(id, 'PickupTag', {});

  // Clean up the temporary gun entity
  world.destroyEntity(gunEntityId);

  return id;
}

export function createPlayerBullet(
  world: World,
  position: Vec3,
  velocity: Vec3,
  gun: Gun,
  owner: EntityId,
  gunSlot: WeaponSlot,
): EntityId {
  const params = getDesignParams();
  const key = GUN_TYPE_KEYS[gun.gunType];
  const gunParams = params.guns[key];
  const id = world.createEntity();

  // Determine piercing/bouncing from gun traits
  let piercingRemaining = 0;
  let bouncesRemaining = 0;
  for (let i = 0; i < gun.traits.length; i++) {
    if (gun.traits[i] === GunTrait.Piercing && gun.traitLevels[i] > 0) {
      const bonuses = params.traits.bonusPerLevel['Piercing'];
      piercingRemaining = bonuses[gun.traitLevels[i] - 1];
    }
    if (gun.traits[i] === GunTrait.Bouncing && gun.traitLevels[i] > 0) {
      const bonuses = params.traits.bonusPerLevel['Bouncing'];
      bouncesRemaining = bonuses[gun.traitLevels[i] - 1];
    }
  }

  world.addComponent<Position>(id, 'Position', pos(position));
  world.addComponent<PreviousPosition>(id, 'PreviousPosition', prevPos(position));
  world.addComponent<Velocity>(id, 'Velocity', { x: velocity.x, y: velocity.y, z: velocity.z });
  world.addComponent<Rotation>(id, 'Rotation', {
    y: Math.atan2(velocity.x, velocity.z),
  });
  world.addComponent<Projectile>(id, 'Projectile', {
    owner,
    sourceGunSlot: gunSlot,
    damage: gun.damage,
    isCritical: false,
    knockback: gun.knockback,
    piercingRemaining,
    bouncesRemaining,
    alreadyHit: [],
    isEnemyProjectile: false,
  });
  world.addComponent<Lifetime>(id, 'Lifetime', {
    remaining: gunParams.projectileLifetime,
  });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: params.projectiles.bulletColliderSize,
    height: params.projectiles.bulletColliderSize,
    depth: params.projectiles.bulletColliderSize,
    isStatic: false,
    isTrigger: true,
  });
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: MeshId.Bullet,
    visible: true,
    scale: 1,
  });
  world.addComponent(id, 'ProjectileTag', {});
  world.addComponent(id, 'PlayerProjectileTag', {});

  return id;
}

export function createEnemyBullet(
  world: World,
  position: Vec3,
  velocity: Vec3,
  enemyWeapon: EnemyWeapon,
  owner: EntityId,
): EntityId {
  const params = getDesignParams();
  const id = world.createEntity();

  world.addComponent<Position>(id, 'Position', pos(position));
  world.addComponent<PreviousPosition>(id, 'PreviousPosition', prevPos(position));
  world.addComponent<Velocity>(id, 'Velocity', { x: velocity.x, y: velocity.y, z: velocity.z });
  world.addComponent<Rotation>(id, 'Rotation', {
    y: Math.atan2(velocity.x, velocity.z),
  });
  world.addComponent<Projectile>(id, 'Projectile', {
    owner,
    damage: enemyWeapon.damage,
    isCritical: false,
    knockback: 0,
    piercingRemaining: 0,
    bouncesRemaining: 0,
    alreadyHit: [],
    isEnemyProjectile: true,
  });
  world.addComponent<Lifetime>(id, 'Lifetime', {
    remaining: params.projectiles.enemyBulletLifetime,
  });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: params.projectiles.bulletColliderSize,
    height: params.projectiles.bulletColliderSize,
    depth: params.projectiles.bulletColliderSize,
    isStatic: false,
    isTrigger: true,
  });
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: MeshId.EnemyBullet,
    visible: true,
    scale: 1,
  });
  world.addComponent(id, 'ProjectileTag', {});
  world.addComponent(id, 'EnemyProjectileTag', {});

  return id;
}

export function createEnemy(
  world: World,
  enemyType: EnemyType,
  position: Vec3,
  depth: number,
  isMini: boolean,
): EntityId {
  const params = getDesignParams();
  const scaling = params.enemies.depthScaling;
  const enemyParamsMap: Record<EnemyType, BaseEnemyParams> = {
    [EnemyType.KnifeRusher]: params.enemies.KnifeRusher,
    [EnemyType.ShieldGun]: params.enemies.ShieldGun,
    [EnemyType.Shotgunner]: params.enemies.Shotgunner,
    [EnemyType.Rifleman]: params.enemies.Rifleman,
    [EnemyType.SuicideBomber]: params.enemies.SuicideBomber,
  };
  const baseParams = enemyParamsMap[enemyType];
  const id = world.createEntity();

  const baseHealth = baseParams.baseHealth;
  const baseDamage = baseParams.baseDamage;

  let scaledHealth = applyDepthScaling(baseHealth, depth, scaling.healthMultiplierPerDepth);
  let scaledDamage = applyDepthScaling(baseDamage, depth, scaling.damageMultiplierPerDepth);

  if (isMini) {
    scaledHealth *= scaling.miniBossStatMultiplier;
    scaledDamage *= scaling.miniBossStatMultiplier;
  }

  world.addComponent<Position>(id, 'Position', pos(position));
  world.addComponent<PreviousPosition>(id, 'PreviousPosition', prevPos(position));
  world.addComponent<Velocity>(id, 'Velocity', zeroVelocity());
  world.addComponent<Rotation>(id, 'Rotation', zeroRotation());
  world.addComponent<Health>(id, 'Health', {
    current: scaledHealth,
    max: scaledHealth,
    lastDamageSourceGunSlot: null,
  });
  world.addComponent<Enemy>(id, 'Enemy', {
    enemyType,
    isMini,
    hasExploded: false,
  });
  world.addComponent<AIState>(id, 'AIState', {
    state: AIBehaviorState.Idle,
    target: null,
    attackCooldown: 0,
    stateTimer: 0,
  });

  // Ranged enemies get EnemyWeapon
  const hasWeapon =
    enemyType === EnemyType.ShieldGun ||
    enemyType === EnemyType.Shotgunner ||
    enemyType === EnemyType.Rifleman;

  if (hasWeapon) {
    const ranged = baseParams as RangedEnemyParams;

    world.addComponent<EnemyWeapon>(id, 'EnemyWeapon', {
      damage: scaledDamage,
      fireRate: 1 / ranged.attackCooldown,
      projectileSpeed: ranged.projectileSpeed,
      projectileCount: ranged.projectileCount,
      spread: ranged.spread,
      fireCooldown: 0,
    });
  }

  // ShieldGun gets EnemyShield
  if (enemyType === EnemyType.ShieldGun) {
    const shieldParams = params.enemies.ShieldGun;
    let shieldHealth = applyDepthScaling(
      shieldParams.shieldHealth,
      depth,
      scaling.shieldHealthMultiplierPerDepth,
    );
    if (isMini) {
      shieldHealth *= scaling.miniBossStatMultiplier;
    }

    world.addComponent<EnemyShield>(id, 'EnemyShield', {
      health: shieldHealth,
      maxHealth: shieldHealth,
      facingAngle: 0,
      coverageArc: shieldParams.shieldArc,
    });
  }

  const enemyCollider = params.entityColliders.enemy;
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: enemyCollider.width,
    height: enemyCollider.height,
    depth: enemyCollider.depth,
    isStatic: false,
    isTrigger: false,
  });
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: isMini ? MINI_BOSS_MESH_MAP[enemyType] : ENEMY_MESH_MAP[enemyType],
    visible: false,
    scale: isMini ? scaling.miniBossScale : 1,
  });
  world.addComponent(id, 'EnemyTag', {});

  return id;
}

export function createBoss(world: World, position: Vec3, depth: number): EntityId {
  const params = getDesignParams();
  const scaling = params.enemies.depthScaling;
  // Boss uses KnifeRusher as base archetype with bossStatMultiplier
  const bossBase = params.enemies.KnifeRusher;
  const id = world.createEntity();

  const scaledHealth =
    applyDepthScaling(bossBase.baseHealth, depth, scaling.healthMultiplierPerDepth) *
    scaling.bossStatMultiplier;
  const scaledDamage =
    applyDepthScaling(bossBase.baseDamage, depth, scaling.damageMultiplierPerDepth) *
    scaling.bossStatMultiplier;

  world.addComponent<Position>(id, 'Position', pos(position));
  world.addComponent<PreviousPosition>(id, 'PreviousPosition', prevPos(position));
  world.addComponent<Velocity>(id, 'Velocity', zeroVelocity());
  world.addComponent<Rotation>(id, 'Rotation', zeroRotation());
  world.addComponent<Health>(id, 'Health', {
    current: scaledHealth,
    max: scaledHealth,
    lastDamageSourceGunSlot: null,
  });
  world.addComponent<Enemy>(id, 'Enemy', {
    enemyType: EnemyType.KnifeRusher,
    isMini: false,
    hasExploded: false,
  });
  world.addComponent<AIState>(id, 'AIState', {
    state: AIBehaviorState.Idle,
    target: null,
    attackCooldown: 0,
    stateTimer: 0,
  });
  world.addComponent<EnemyWeapon>(id, 'EnemyWeapon', {
    damage: scaledDamage,
    fireRate: 1 / bossBase.attackCooldown,
    projectileSpeed: scaling.bossProjectileSpeed,
    projectileCount: 1,
    spread: 0,
    fireCooldown: 0,
  });
  const bossCollider = params.entityColliders.boss;
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: bossCollider.width,
    height: bossCollider.height,
    depth: bossCollider.depth,
    isStatic: false,
    isTrigger: false,
  });
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: MeshId.Boss,
    visible: false,
    scale: scaling.bossScale,
  });
  world.addComponent(id, 'EnemyTag', {});
  world.addComponent(id, 'BossTag', {});

  return id;
}

export function createXPGem(
  world: World,
  position: Vec3,
  sourceGunEntityId: EntityId,
  amount: number,
): EntityId {
  const params = getDesignParams();
  const xpCollider = params.entityColliders.xpGem;
  const id = world.createEntity();

  world.addComponent<Position>(id, 'Position', pos(position));
  world.addComponent<Velocity>(id, 'Velocity', zeroVelocity());
  world.addComponent<Pickup>(id, 'Pickup', { pickupType: PickupType.XPGem });
  const sourceGun = world.getComponent<Gun>(sourceGunEntityId, 'Gun');
  const sourceCategory = sourceGun ? sourceGun.category : GunCategory.Sidearm;
  world.addComponent<XPGem>(id, 'XPGem', {
    sourceGunEntityId,
    sourceCategory,
    amount,
    isFlying: false,
  });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: xpCollider.width,
    height: xpCollider.height,
    depth: xpCollider.depth,
    isStatic: false,
    isTrigger: true,
  });
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: MeshId.XPGem,
    visible: true,
    scale: 1,
  });
  world.addComponent(id, 'PickupTag', {});

  return id;
}

export function createHealthPickup(world: World, position: Vec3, healAmount: number): EntityId {
  const params = getDesignParams();
  const hpCollider = params.entityColliders.healthPickup;
  const id = world.createEntity();

  world.addComponent<Position>(id, 'Position', pos(position));
  world.addComponent<Pickup>(id, 'Pickup', { pickupType: PickupType.HealthPickup });
  world.addComponent<HealthPickupData>(id, 'HealthPickupData', { healAmount });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: hpCollider.width,
    height: hpCollider.height,
    depth: hpCollider.depth,
    isStatic: true,
    isTrigger: true,
  });
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: MeshId.HealthPickup,
    visible: true,
    scale: 1,
  });
  world.addComponent(id, 'PickupTag', {});

  return id;
}

export function createCurrency(world: World, position: Vec3, amount: number): EntityId {
  const params = getDesignParams();
  const curCollider = params.entityColliders.currency;
  const id = world.createEntity();

  world.addComponent<Position>(id, 'Position', pos(position));
  world.addComponent<Pickup>(id, 'Pickup', { pickupType: PickupType.Currency });
  world.addComponent<CurrencyData>(id, 'CurrencyData', { amount });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: curCollider.width,
    height: curCollider.height,
    depth: curCollider.depth,
    isStatic: true,
    isTrigger: true,
  });
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: MeshId.Currency,
    visible: true,
    scale: 1,
  });
  world.addComponent(id, 'PickupTag', {});

  return id;
}

export function createWall(world: World, position: Vec3, size: Vec3): EntityId {
  const id = world.createEntity();

  world.addComponent<Position>(id, 'Position', pos(position));
  world.addComponent<PreviousPosition>(id, 'PreviousPosition', prevPos(position));
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: size.x,
    height: size.y,
    depth: size.z,
    isStatic: true,
    isTrigger: false,
  });
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: MeshId.Wall,
    visible: false,
    scale: size.y / 3,
    scaleX: size.x,
    scaleZ: size.z,
  });
  world.addComponent(id, 'WallTag', {});
  world.addComponent(id, 'DungeonEntityTag', {});

  return id;
}

export function createFloor(world: World, position: Vec3, size: Vec3): EntityId {
  const id = world.createEntity();

  world.addComponent<Position>(id, 'Position', pos(position));
  world.addComponent<PreviousPosition>(id, 'PreviousPosition', prevPos(position));
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: MeshId.Floor,
    visible: false,
    scale: 1,
    scaleX: size.x,
    scaleZ: size.z,
  });
  world.addComponent(id, 'DungeonEntityTag', {});

  return id;
}

export function createHazard(
  world: World,
  hazardType: HazardType,
  position: Vec3,
  size: Vec3,
): EntityId {
  const id = world.createEntity();

  world.addComponent<Position>(id, 'Position', pos(position));
  world.addComponent<PreviousPosition>(id, 'PreviousPosition', prevPos(position));
  world.addComponent<Hazard>(id, 'Hazard', { hazardType });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: size.x,
    height: size.y,
    depth: size.z,
    isStatic: true,
    isTrigger: true,
  });
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: HAZARD_MESH_MAP[hazardType],
    visible: false,
    scale: 1,
    scaleX: size.x,
    scaleZ: size.z,
  });
  world.addComponent(id, 'HazardTag', {});
  world.addComponent(id, 'DungeonEntityTag', {});

  return id;
}

export function createDestructible(
  world: World,
  position: Vec3,
  size: Vec3,
  health: number,
): EntityId {
  const id = world.createEntity();

  world.addComponent<Position>(id, 'Position', pos(position));
  world.addComponent<Destructible>(id, 'Destructible', {
    health,
    maxHealth: health,
  });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: size.x,
    height: size.y,
    depth: size.z,
    isStatic: true,
    isTrigger: false,
  });
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: MeshId.Crate,
    visible: false,
    scale: 1,
  });
  world.addComponent(id, 'DestructibleTag', {});
  world.addComponent(id, 'DungeonEntityTag', {});

  return id;
}

export function createDoor(world: World, position: Vec3): EntityId {
  const params = getDesignParams();
  const doorCollider = params.entityColliders.door;
  const id = world.createEntity();

  world.addComponent<Position>(id, 'Position', pos(position));
  world.addComponent<Door>(id, 'Door', { isOpen: false });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: doorCollider.width,
    height: doorCollider.height,
    depth: doorCollider.depth,
    isStatic: true,
    isTrigger: false,
  });
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: MeshId.Door,
    visible: false,
    scale: 1,
  });
  world.addComponent(id, 'DoorTag', {});
  world.addComponent(id, 'DungeonEntityTag', {});

  return id;
}

export function createChest(world: World, position: Vec3, gunType: GunType): EntityId {
  const params = getDesignParams();
  const chestCollider = params.entityColliders.chest;
  const id = world.createEntity();

  world.addComponent<Position>(id, 'Position', pos(position));
  world.addComponent<Chest>(id, 'Chest', { isOpen: false, gunType });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: chestCollider.width,
    height: chestCollider.height,
    depth: chestCollider.depth,
    isStatic: true,
    isTrigger: false,
  });
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: MeshId.Chest,
    visible: false,
    scale: 1,
  });
  world.addComponent(id, 'ChestTag', {});
  world.addComponent(id, 'DungeonEntityTag', {});

  return id;
}

export function createShop(world: World, position: Vec3, inventory: ShopItem[]): EntityId {
  const params = getDesignParams();
  const shopCollider = params.entityColliders.shop;
  const id = world.createEntity();

  world.addComponent<Position>(id, 'Position', pos(position));
  world.addComponent<Shop>(id, 'Shop', { inventory });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: shopCollider.width,
    height: shopCollider.height,
    depth: shopCollider.depth,
    isStatic: true,
    isTrigger: true,
  });
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: MeshId.Shop,
    visible: false,
    scale: 1,
  });
  world.addComponent(id, 'ShopTag', {});
  world.addComponent(id, 'DungeonEntityTag', {});

  return id;
}

export function createStairs(world: World, position: Vec3, targetDepth: number): EntityId {
  const params = getDesignParams();
  const stairsCollider = params.entityColliders.stairs;
  const id = world.createEntity();

  world.addComponent<Position>(id, 'Position', pos(position));
  world.addComponent<Stairs>(id, 'Stairs', { targetDepth });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: stairsCollider.width,
    height: stairsCollider.height,
    depth: stairsCollider.depth,
    isStatic: true,
    isTrigger: true,
  });
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: MeshId.Stairs,
    visible: false,
    scale: 1,
  });
  world.addComponent(id, 'StairsTag', {});
  world.addComponent(id, 'DungeonEntityTag', {});

  return id;
}

export function createSpawnZone(
  world: World,
  position: Vec3,
  size: Vec2,
  enemies: EnemyType[],
  count: number,
): EntityId {
  const id = world.createEntity();

  world.addComponent<Position>(id, 'Position', pos(position));
  world.addComponent<SpawnZone>(id, 'SpawnZone', {
    width: size.x,
    height: size.y,
    enemyTypes: enemies,
    enemyCount: count,
    activated: false,
    spawnedEnemies: [],
    cleared: false,
  });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: size.x,
    height: 1,
    depth: size.y,
    isStatic: true,
    isTrigger: true,
  });

  return id;
}
