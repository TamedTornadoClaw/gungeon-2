# Entity Component Definitions

## Architecture

ECS-style: entities are numeric IDs, components are plain TypeScript objects, systems are functions that iterate over entities with specific component sets. No class inheritance for entity types.

Use a lightweight ECS approach — hand-rolled for this game's scope (~500 entities max). Entity storage is a sparse set of component maps keyed by EntityId.

```typescript
type EntityId = number;
```

## Enums

All categorical identifiers are enums. Never raw string literals.

```typescript
enum WeaponSlot {
  Sidearm,
  LongArm,
}

enum GunType {
  Pistol,
  SMG,
  AssaultRifle,
  Shotgun,
  LMG,
}

enum GunCategory {
  Sidearm,
  LongArm,
}

enum GunTrait {
  Damage,
  FireRate,
  MagazineSize,
  ReloadTime,
  Spread,
  ProjectileCount,
  ProjectileSpeed,
  Knockback,
  CriticalChance,
  CriticalMultiplier,
  Piercing,
  Bouncing,
}

enum EnemyType {
  KnifeRusher,
  ShieldGun,
  Shotgunner,
  Rifleman,
  SuicideBomber,
}

enum AIBehaviorState {
  Idle,
  Chase,
  Attack,
  Flee,
  Dead,
}

enum PickupType {
  XPGem,
  HealthPickup,
  Currency,
  GunPickup,
}

enum HazardType {
  Fire,
  Spikes,
  Water,
}

enum ColliderShape {
  AABB,
}

enum ParticleEffect {
  MuzzleFlash,
  BloodSplat,
  Sparks,
  Explosion,
  XPGemTrail,
  BulletImpactWall,
  BulletImpactEnemy,
  DestructibleDebrisWood,
  DestructibleDebrisStone,
  DestructibleDebrisMetal,
}

enum SoundId {
  // Weapons
  PistolFire,
  SMGFire,
  AssaultRifleFire,
  ShotgunFire,
  LMGFire,
  Reload,
  EmptyClipClick,
  // Player
  Footstep,
  DodgeRollWhoosh,
  PlayerHitGrunt,
  PlayerDeath,
  // Enemies
  EnemyHitFlesh,
  EnemyHitArmor,
  EnemyDeath,
  KnifeSwing,
  EnemyGunshot,
  Explosion,
  // Pickups
  XPGemPickup,
  HealthPickup,
  CurrencyPickup,
  GunPickup,
  // UI
  MenuClick,
  MenuHover,
  ComparisonScreenOpen,
  GunSwapConfirm,
  LevelUpNotification,
  UpgradeSpent,
  Pause,
  Unpause,
  // Environment
  ChestOpen,
  DoorOpen,
  DestructibleBreakWood,
  DestructibleBreakStone,
  DestructibleBreakMetal,
  FireAmbient,
  WaterAmbient,
}

enum MeshId {
  Player,
  KnifeRusher,
  ShieldGun,
  Shotgunner,
  Rifleman,
  SuicideBomber,
  MiniBossKnifeRusher,
  MiniBossShieldGun,
  MiniBossShotgunner,
  MiniBossRifleman,
  MiniBossSuicideBomber,
  Boss,
  Pistol,
  SMG,
  AssaultRifle,
  Shotgun,
  LMG,
  Bullet,
  EnemyBullet,
  XPGem,
  HealthPickup,
  Currency,
  GunPickupGlow,
  Wall,
  Floor,
  Pit,
  FireHazard,
  SpikeHazard,
  WaterHazard,
  Crate,
  Pillar,
  Barrel,
  Door,
  Chest,
  Shop,
  Stairs,
  EnemyShieldMesh,
}
```

## Components

### Core Components

```typescript
interface Position {
  x: number;
  y: number;
  z: number;
}

interface PreviousPosition {
  x: number;
  y: number;
  z: number;
}

interface Velocity {
  x: number;
  y: number;
  z: number;
}

interface Rotation {
  /** Radians around Y axis (yaw) — top-down aiming direction */
  y: number;
}
```

### Health & Defense

```typescript
interface Health {
  current: number;
  max: number;
  /** Written by DamageSystem when damage comes from a player projectile.
      DeathSystem reads this to attribute kills for XP gem spawning.
      Survives projectile destruction. */
  lastDamageSourceGunSlot: WeaponSlot | null;
}

interface Armor {
  current: number;
  max: number;
}

interface Shield {
  current: number;
  max: number;
  regenRate: number;       // per second
  regenDelay: number;      // seconds after last hit before regen starts
  timeSinceLastHit: number;
}
```

### Combat

```typescript
interface Damage {
  amount: number;
  source: EntityId;
  isCritical: boolean;
}

interface DamageOverTime {
  damagePerSecond: number;
  sourceType: HazardType;
  /** Refreshed each frame while overlapping hazard. If not refreshed, expires next frame. */
  refreshed: boolean;
}

interface Knockback {
  force: number;
  directionX: number;
  directionY: number;
}

interface Invincible {
  remaining: number; // seconds remaining
}

interface SpeedModifier {
  multiplier: number;
  /** Refreshed each frame while overlapping source. Expires if not refreshed. */
  refreshed: boolean;
}
```

### Player

```typescript
interface Player {
  sidearmSlot: EntityId;  // gun entity
  longArmSlot: EntityId;  // gun entity
  activeSlot: WeaponSlot;
  currency: number;
}

interface DodgeRoll {
  cooldownRemaining: number;
  isRolling: boolean;
  rollTimer: number;
  rollDirectionX: number;
  rollDirectionY: number;
}
```

### Guns

```typescript
interface Gun {
  gunType: GunType;
  category: GunCategory;

  // Base stats (from design params, modified by trait levels)
  baseDamage: number;
  baseFireRate: number;        // shots per second
  baseMagazineSize: number;
  baseReloadTime: number;      // seconds
  baseSpread: number;          // radians
  baseProjectileCount: number;
  baseProjectileSpeed: number;
  baseKnockback: number;
  baseCritChance: number;      // 0-1
  baseCritMultiplier: number;

  // Current computed stats (recalculated when traits change)
  damage: number;
  fireRate: number;
  magazineSize: number;
  reloadTime: number;
  spread: number;
  projectileCount: number;
  projectileSpeed: number;
  knockback: number;
  critChance: number;
  critMultiplier: number;

  // Ammo state
  currentAmmo: number;
  isReloading: boolean;
  reloadTimer: number;
  fireCooldown: number;
  fireRequested: boolean; // set by PlayerControlSystem, consumed by ProjectileSystem

  // Traits — Piercing and Bouncing are mutually exclusive (enforced by factory)
  traits: [GunTrait, GunTrait, GunTrait];
  traitLevels: [number, number, number]; // level per trait slot

  // XP
  xp: number;

  // Forced upgrade tracking
  forcedUpgradeTriggered: boolean;
}
```

**Constraint:** `createGun` factory validates that a gun's traits array never contains both `GunTrait.Piercing` and `GunTrait.Bouncing`. This invariant is tested.

### Projectile

```typescript
interface Projectile {
  owner: EntityId;
  sourceGunSlot?: WeaponSlot; // which gun slot fired this — for XP gem attribution. Undefined for enemy projectiles.
  damage: number;
  isCritical: boolean;
  knockback: number;
  piercingRemaining: number;  // 0 = no piercing
  bouncesRemaining: number;   // 0 = no bouncing
  alreadyHit: EntityId[];     // prevents double-hit on pierce
  isEnemyProjectile: boolean; // true if fired by an enemy
}

interface Lifetime {
  remaining: number; // seconds
}
```

### Enemy

```typescript
interface Enemy {
  enemyType: EnemyType;
  isMini: boolean;        // mini-boss variant
  hasExploded: boolean;   // SuicideBomber only — set by CollisionResponse on contact explosion, checked by DeathSystem to prevent double-explosion
}

interface AIState {
  state: AIBehaviorState;
  target: EntityId | null;
  attackCooldown: number;
  stateTimer: number;
}

interface EnemyWeapon {
  damage: number;
  fireRate: number;         // shots per second
  projectileSpeed: number;
  projectileCount: number;  // 1 for single shot, >1 for spread (shotgunner)
  spread: number;           // radians
  fireCooldown: number;
}
```

### Shield (Enemy Shield Component)

```typescript
interface EnemyShield {
  health: number;
  maxHealth: number;
  /** Angle in radians — shield blocks damage from this facing direction */
  facingAngle: number;
  /** Half-width of shield coverage arc in radians */
  coverageArc: number;
}
```

### Pickups

```typescript
interface Pickup {
  pickupType: PickupType;
}

interface XPGem {
  /** Tracks the gun entity that earned this XP, not the slot — survives weapon swaps */
  sourceGunEntityId: EntityId;
  amount: number;
  isFlying: boolean;    // true when in auto-collect range, flying toward player
}

interface HealthPickupData {
  healAmount: number;
}

interface CurrencyData {
  amount: number;
}
```

### Environment

```typescript
interface Hazard {
  hazardType: HazardType;
}

interface Destructible {
  health: number;
  maxHealth: number;
}

interface Collider {
  type: ColliderShape;
  width: number;
  height: number;
  depth: number;
  isStatic: boolean;    // walls, hazards — don't move
  isTrigger: boolean;   // pickups, hazards — overlap detection, no physics push
}

interface Door {
  isOpen: boolean;
}

interface Chest {
  isOpen: boolean;
  gunType: GunType;     // what gun this chest contains
}

interface Shop {
  inventory: ShopItem[];
}

interface ShopItem {
  type: PickupType;
  price: number;
  healAmount?: number;  // for health pickups
  sold: boolean;
}

interface Stairs {
  targetDepth: number;
}

interface SpawnZone {
  /** Rectangular zone defined by center position + dimensions */
  width: number;
  height: number;
  enemyTypes: EnemyType[];
  enemyCount: number;
  activated: boolean;       // true once player has entered this zone
  spawnedEnemies: EntityId[]; // track spawned enemies for cleared check
  cleared: boolean;         // true once all spawned enemies are dead (checked by SpawnSystem each frame)
}
```

### Rendering

```typescript
interface Renderable {
  meshId: MeshId;
  visible: boolean;
  scale: number;
}
```

### Tags (marker components — no data)

```typescript
// Marker components are empty objects. Their presence on an entity is the signal.
interface PlayerTag {}
interface EnemyTag {}
interface ProjectileTag {}
interface PlayerProjectileTag {}
interface EnemyProjectileTag {}
interface PickupTag {}
interface WallTag {}
interface HazardTag {}
interface DestructibleTag {}
interface DoorTag {}
interface ChestTag {}
interface ShopTag {}
interface StairsTag {}
interface BossTag {}
```

## Entity Compositions

### Player Entity
`Position, PreviousPosition, Velocity, Rotation, Health, Player, DodgeRoll, Collider, Renderable, PlayerTag`
- Optional: `Armor, Shield, Invincible, DamageOverTime, SpeedModifier`
- **v1 note:** Armor and Shield components exist for future extensibility but have no acquisition mechanism in v1 (explicitly out of scope per GDD). Player starts with 0 armor and 0 shields.

### Gun Entity (attached to player — no Position, not in the world)
`Gun`

### Gun Pickup Entity (on the ground)
`Position, Gun, Pickup, Collider, Renderable, PickupTag`
- The pickup entity IS the gun entity. It has the Gun component directly. When picked up, the entity is removed from the world and the Gun component data is transferred to the player's slot.

### Bullet Entity (player)
`Position, PreviousPosition, Velocity, Rotation, Projectile, Lifetime, Collider, Renderable, ProjectileTag, PlayerProjectileTag`

### Bullet Entity (enemy)
`Position, PreviousPosition, Velocity, Rotation, Projectile, Lifetime, Collider, Renderable, ProjectileTag, EnemyProjectileTag`

### Enemy Entities

**Knife Rusher:**
`Position, PreviousPosition, Velocity, Rotation, Health, Enemy, AIState, Collider, Renderable, EnemyTag`

**Shield + Gun:**
`Position, PreviousPosition, Velocity, Rotation, Health, Enemy, AIState, EnemyWeapon, EnemyShield, Collider, Renderable, EnemyTag`

**Shotgunner:**
`Position, PreviousPosition, Velocity, Rotation, Health, Enemy, AIState, EnemyWeapon, Collider, Renderable, EnemyTag`

**Rifleman:**
`Position, PreviousPosition, Velocity, Rotation, Health, Enemy, AIState, EnemyWeapon, Collider, Renderable, EnemyTag`

**Suicide Bomber:**
`Position, PreviousPosition, Velocity, Rotation, Health, Enemy, AIState, Collider, Renderable, EnemyTag`

**Boss:**
`Position, PreviousPosition, Velocity, Rotation, Health, Enemy, AIState, EnemyWeapon, Collider, Renderable, EnemyTag, BossTag`
- Boss is a sized-up enemy with `isMini = false` and `BossTag`. Stats are scaled by `bossStatMultiplier` from design params. v1 boss uses enhanced rifleman or shotgunner behavior with higher stats.

### Pickup Entities

**XP Gem:**
`Position, Velocity, Pickup, XPGem, Collider, Renderable, PickupTag`

**Health Pickup:**
`Position, Pickup, HealthPickupData, Collider, Renderable, PickupTag`

**Currency:**
`Position, Pickup, CurrencyData, Collider, Renderable, PickupTag`

### Environment Entities

**Wall:**
`Position, Collider, Renderable, WallTag`

**Pit (impassable terrain — acts like wall):**
`Position, Collider(isStatic=true, isTrigger=false), Renderable(Pit), WallTag`

**Hazard (Fire/Spikes/Water):**
`Position, Hazard, Collider, Renderable, HazardTag`

**Destructible Cover:**
`Position, Destructible, Collider, Renderable, DestructibleTag`

**Door:**
`Position, Door, Collider, Renderable, DoorTag`

**Chest:**
`Position, Chest, Collider, Renderable, ChestTag`

**Shop:**
`Position, Shop, Collider, Renderable, ShopTag`

**Stairs (floor exit):**
`Position, Stairs, Collider, Renderable, StairsTag`

**Spawn Zone (invisible trigger):**
`Position, SpawnZone, Collider`
- Collider is a trigger (isTrigger = true). When player overlaps and `activated === false`, spawn enemies and set `activated = true`.

## Entity Factory Functions

Each entity type has a factory function that creates the entity and attaches the correct components with default values from design params.

```typescript
function createPlayer(world: World, position: Vec3, longArmType: GunType): EntityId;
function createGun(world: World, gunType: GunType): EntityId;
function createGunPickup(world: World, position: Vec3, gunType: GunType): EntityId;
function createPlayerBullet(world: World, position: Vec3, velocity: Vec3, gun: Gun, owner: EntityId, gunSlot: WeaponSlot): EntityId;
function createEnemyBullet(world: World, position: Vec3, velocity: Vec3, enemyWeapon: EnemyWeapon, owner: EntityId): EntityId;
function createEnemy(world: World, enemyType: EnemyType, position: Vec3, depth: number, isMini: boolean): EntityId;
function createBoss(world: World, position: Vec3, depth: number): EntityId;
function createXPGem(world: World, position: Vec3, sourceGunEntityId: EntityId, amount: number): EntityId;
function createHealthPickup(world: World, position: Vec3, healAmount: number): EntityId;
function createCurrency(world: World, position: Vec3, amount: number): EntityId;
function createWall(world: World, position: Vec3, size: Vec3): EntityId;
function createHazard(world: World, hazardType: HazardType, position: Vec3, size: Vec3): EntityId;
function createDestructible(world: World, position: Vec3, size: Vec3, health: number): EntityId;
function createDoor(world: World, position: Vec3): EntityId;
function createChest(world: World, position: Vec3, gunType: GunType): EntityId;
function createShop(world: World, position: Vec3, inventory: ShopItem[]): EntityId;
function createStairs(world: World, position: Vec3, targetDepth: number): EntityId;
function createSpawnZone(world: World, position: Vec3, size: Vec2, enemies: EnemyType[], count: number): EntityId;
```

**Validation:** `createGun` rejects trait arrays containing both `GunTrait.Piercing` and `GunTrait.Bouncing`. This is a hard invariant — throws on violation.

All factory functions read base stats from the centralized design params config. No magic numbers.
