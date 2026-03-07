import type { EntityId } from '../types';

// ── Enums ──────────────────────────────────────────────────────────────────

export enum AppState {
  Loading,
  MainMenu,
  WeaponSelect,
  Gameplay,
  Paused,
  GunComparison,
  GunUpgrade,
  ForcedUpgrade,
  ShopBrowse,
  Death,
  Victory,
  Settings,
}

export enum WeaponSlot {
  Sidearm,
  LongArm,
}

export enum GunType {
  Pistol,
  SMG,
  AssaultRifle,
  Shotgun,
  LMG,
}

export enum GunCategory {
  Sidearm,
  LongArm,
}

export enum GunTrait {
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

export enum EnemyType {
  KnifeRusher,
  ShieldGun,
  Shotgunner,
  Rifleman,
  SuicideBomber,
}

export enum AIBehaviorState {
  Idle,
  Chase,
  Attack,
  Flee,
  Dead,
}

export enum PickupType {
  XPGem,
  HealthPickup,
  Currency,
  GunPickup,
}

export enum HazardType {
  Fire,
  Spikes,
  Water,
}

export enum DestructibleType {
  Crate = 'Crate',
  Pillar = 'Pillar',
  Barrel = 'Barrel',
}

export enum LogicalAction {
  MoveUp = 'moveUp',
  MoveDown = 'moveDown',
  MoveLeft = 'moveLeft',
  MoveRight = 'moveRight',
  FireSidearm = 'fireSidearm',
  FireLongArm = 'fireLongArm',
  Reload = 'reload',
  DodgeRoll = 'dodgeRoll',
  Interact = 'interact',
  OpenUpgrade = 'openUpgrade',
  Pause = 'pause',
}

export enum ColliderShape {
  AABB,
}

export enum ParticleEffect {
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

export enum SoundId {
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

export enum EventType {
  Damage = 'Damage',
  Particle = 'Particle',
  Audio = 'Audio',
  DamageNumber = 'DamageNumber',
  DoorInteract = 'DoorInteract',
}

export enum MeshId {
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

// ── Core Components ────────────────────────────────────────────────────────

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface PreviousPosition {
  x: number;
  y: number;
  z: number;
}

export interface Velocity {
  x: number;
  y: number;
  z: number;
}

export interface Rotation {
  /** Radians around Y axis (yaw) — top-down aiming direction */
  y: number;
}

// ── Health & Defense ───────────────────────────────────────────────────────

export interface Health {
  current: number;
  max: number;
  /** Written by DamageSystem when damage comes from a player projectile.
      DeathSystem reads this to attribute kills for XP gem spawning.
      Survives projectile destruction. */
  lastDamageSourceGunSlot: WeaponSlot | null;
}

export interface Armor {
  current: number;
  max: number;
}

export interface Shield {
  current: number;
  max: number;
  regenRate: number;
  regenDelay: number;
  timeSinceLastHit: number;
}

// ── Combat ─────────────────────────────────────────────────────────────────

export interface Damage {
  amount: number;
  source: EntityId;
  isCritical: boolean;
}

export interface DamageOverTime {
  damagePerSecond: number;
  sourceType: HazardType;
  /** Refreshed each frame while overlapping hazard. If not refreshed, expires next frame. */
  refreshed: boolean;
}

export interface Knockback {
  force: number;
  directionX: number;
  directionY: number;
}

export interface Invincible {
  remaining: number;
}

export interface SpikeCooldown {
  remaining: number;
}

export interface SpeedModifier {
  multiplier: number;
  /** Refreshed each frame while overlapping source. Expires if not refreshed. */
  refreshed: boolean;
}

// ── Player ─────────────────────────────────────────────────────────────────

export interface Player {
  sidearmSlot: EntityId;
  longArmSlot: EntityId;
  activeSlot: WeaponSlot;
  currency: number;
}

export interface DodgeRoll {
  cooldownRemaining: number;
  isRolling: boolean;
  rollTimer: number;
  rollDirectionX: number;
  rollDirectionY: number;
}

// ── Guns ───────────────────────────────────────────────────────────────────

export interface Gun {
  gunType: GunType;
  category: GunCategory;

  // Base stats (from design params, modified by trait levels)
  baseDamage: number;
  baseFireRate: number;
  baseMagazineSize: number;
  baseReloadTime: number;
  baseSpread: number;
  baseProjectileCount: number;
  baseProjectileSpeed: number;
  baseKnockback: number;
  baseCritChance: number;
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
  fireRequested: boolean;

  // Traits — Piercing and Bouncing are mutually exclusive (enforced by factory)
  traits: [GunTrait, GunTrait, GunTrait];
  traitLevels: [number, number, number];

  // XP
  xp: number;

  // Forced upgrade tracking
  forcedUpgradeTriggered: boolean;
}

// ── Projectile ─────────────────────────────────────────────────────────────

export interface Projectile {
  owner: EntityId;
  sourceGunSlot?: WeaponSlot;
  damage: number;
  isCritical: boolean;
  knockback: number;
  piercingRemaining: number;
  bouncesRemaining: number;
  alreadyHit: EntityId[];
  isEnemyProjectile: boolean;
}

export interface Lifetime {
  remaining: number;
}

// ── Enemy ──────────────────────────────────────────────────────────────────

export interface Enemy {
  enemyType: EnemyType;
  isMini: boolean;
  hasExploded: boolean;
}

export interface AIState {
  state: AIBehaviorState;
  target: EntityId | null;
  attackCooldown: number;
  stateTimer: number;
}

export interface EnemyWeapon {
  damage: number;
  fireRate: number;
  projectileSpeed: number;
  projectileCount: number;
  spread: number;
  fireCooldown: number;
}

// ── Enemy Shield ───────────────────────────────────────────────────────────

export interface EnemyShield {
  health: number;
  maxHealth: number;
  /** Angle in radians — shield blocks damage from this facing direction */
  facingAngle: number;
  /** Half-width of shield coverage arc in radians */
  coverageArc: number;
}

// ── Pickups ────────────────────────────────────────────────────────────────

export interface Pickup {
  pickupType: PickupType;
}

export interface XPGem {
  /** Tracks the gun entity that earned this XP, not the slot — survives weapon swaps */
  sourceGunEntityId: EntityId;
  /** Category of the source gun at spawn time — used for slot-based fallback */
  sourceCategory: GunCategory;
  amount: number;
  isFlying: boolean;
}

export interface HealthPickupData {
  healAmount: number;
}

export interface CurrencyData {
  amount: number;
}

// ── Environment ────────────────────────────────────────────────────────────

export interface Hazard {
  hazardType: HazardType;
}

export interface Destructible {
  health: number;
  maxHealth: number;
}

export interface Collider {
  type: ColliderShape;
  width: number;
  height: number;
  depth: number;
  isStatic: boolean;
  isTrigger: boolean;
}

export interface Door {
  isOpen: boolean;
}

export interface Chest {
  isOpen: boolean;
  gunType: GunType;
}

export interface Shop {
  inventory: ShopItem[];
}

export interface ShopItem {
  type: PickupType;
  price: number;
  healAmount?: number;
  sold: boolean;
}

export interface Stairs {
  targetDepth: number;
}

export interface SpawnZone {
  /** Rectangular zone defined by center position + dimensions */
  width: number;
  height: number;
  enemyTypes: EnemyType[];
  enemyCount: number;
  activated: boolean;
  spawnedEnemies: EntityId[];
  cleared: boolean;
}

// ── Rendering ──────────────────────────────────────────────────────────────

export interface Renderable {
  meshId: MeshId;
  visible: boolean;
  scale: number;
}

// ── Tags (marker components — no data) ─────────────────────────────────────

export type PlayerTag = Record<string, never>;
export type EnemyTag = Record<string, never>;
export type ProjectileTag = Record<string, never>;
export type PlayerProjectileTag = Record<string, never>;
export type EnemyProjectileTag = Record<string, never>;
export type PickupTag = Record<string, never>;
export type WallTag = Record<string, never>;
export type HazardTag = Record<string, never>;
export type DestructibleTag = Record<string, never>;
export type DoorTag = Record<string, never>;
export type ChestTag = Record<string, never>;
export type ShopTag = Record<string, never>;
export type StairsTag = Record<string, never>;
export type BossTag = Record<string, never>;
