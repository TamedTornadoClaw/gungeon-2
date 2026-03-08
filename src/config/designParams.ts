import designParamsJson from '../../config/design-params.json';

// --- Interfaces ---

export interface DodgeRollParams {
  cooldown: number;
  duration: number;
  speed: number;
  iFrameDuration: number;
}

export interface PlayerParams {
  baseHealth: number;
  baseMovementSpeed: number;
  dodgeRoll: DodgeRollParams;
  xpCollectionRange: number;
  xpGemFlySpeed: number;
  xpGemCollectionThreshold: number;
  interactRange: number;
}

export interface GunParams {
  category: string;
  damage: number;
  fireRate: number;
  magazineSize: number;
  reloadTime: number;
  spread: number;
  projectileCount: number;
  projectileSpeed: number;
  projectileLifetime: number;
  knockback: number;
  critChance: number;
  critMultiplier: number;
  traits: [string, string, string];
}

export interface TraitsParams {
  maxLevel: number;
  xpCosts: number[];
  bonusPerLevel: Record<string, number[]>;
}

export interface BaseEnemyParams {
  baseHealth: number;
  baseDamage: number;
  baseSpeed: number;
  detectionRange: number;
  xpDrop: number;
  currencyDropChance: number;
  currencyDropAmount: number;
}

export interface MeleeEnemyParams extends BaseEnemyParams {
  attackRange: number;
  attackCooldown: number;
}

export interface RangedEnemyParams extends BaseEnemyParams {
  attackRange: number;
  attackCooldown: number;
  projectileSpeed: number;
  projectileCount: number;
  spread: number;
}

export interface ShieldGunEnemyParams extends RangedEnemyParams {
  shieldHealth: number;
  shieldArc: number;
}

export interface SuicideBomberParams extends BaseEnemyParams {
  explosionRadius: number;
}

export interface DepthScalingParams {
  healthMultiplierPerDepth: number;
  damageMultiplierPerDepth: number;
  speedMultiplierPerDepth: number;
  shieldHealthMultiplierPerDepth: number;
  miniBossStatMultiplier: number;
  miniBossXPMultiplier: number;
  bossStatMultiplier: number;
  bossXPMultiplier: number;
  bossScale: number;
  miniBossScale: number;
  bossProjectileSpeed: number;
}

export interface EnemiesParams {
  KnifeRusher: MeleeEnemyParams;
  ShieldGun: ShieldGunEnemyParams;
  Shotgunner: RangedEnemyParams;
  Rifleman: RangedEnemyParams;
  SuicideBomber: SuicideBomberParams;
  depthScaling: DepthScalingParams;
}

export interface HazardsParams {
  fire: { damagePerSecond: number };
  spikes: { damage: number; cooldown: number };
  water: { speedMultiplier: number };
}

export interface DungeonParams {
  roomMinSize: number;
  roomMaxSize: number;
  corridorWidth: number;
  roomsPerFloor: number;
  enemiesPerRoom: { min: number; max: number };
  miniBossChancePerRoom: number;
  chestChancePerRoom: number;
  shopChancePerFloor: number;
  healthPickupDropChance: number;
  bossFloorDepth: number;
  wallThickness: number;
  wallHeight: number;
  spawnZoneScale: number;
  chestOffset: number;
  shopOffset: number;
}

export interface ShopParams {
  healthPickupPrice: number;
  healthPickupHealAmount: number;
}

export interface GunMechanicsParams {
  minReloadTime: number;
  weaponSwapTime: number;
}

export interface ProjectilesParams {
  bulletColliderSize: number;
  enemyBulletLifetime: number;
  muzzleForwardOffset: number;
  muzzleHeight: number;
}

export interface ColliderDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface EntityCollidersParams {
  player: ColliderDimensions;
  enemy: ColliderDimensions;
  boss: ColliderDimensions;
  door: ColliderDimensions;
  shop: ColliderDimensions;
  stairs: ColliderDimensions;
  chest: ColliderDimensions;
  gunPickup: ColliderDimensions;
  xpGem: ColliderDimensions;
  healthPickup: ColliderDimensions;
  currency: ColliderDimensions;
}

export interface DestructiblesParams {
  crateHealth: number;
  pillarHealth: number;
  barrelHealth: number;
}

export interface WallFadeParams {
  opacity: number;
  radius: number;
}

export interface CameraParams {
  fov: number;
  angle: number;
  distance: number;
  followSmoothing: number;
  mouseSensitivity: number;
  pitchMin: number;
  pitchMax: number;
  shoulderOffsetX: number;
  shoulderHeight: number;
  orbitDistance: number;
  lookAhead: number;
  lookHeight: number;
  wallFade: WallFadeParams;
}

export interface ShakeParams {
  damping: number;
  playerHitIntensity: number;
  explosionIntensity: number;
  bigHitIntensity: number;
}

export interface HitFlashParams {
  duration: number;
  opacity: number;
}

export interface DamageVignetteParams {
  healthThreshold: number;
  pulseSpeed: number;
}

export interface ScreenEffectsParams {
  shake: ShakeParams;
  hitFlash: HitFlashParams;
  damageVignette: DamageVignetteParams;
}

export interface DamageNumbersParams {
  lifetime: number;
  driftSpeed: number;
  critScale: number;
}

export interface LoadingScreenParams {
  loadDurationMs: number;
  progressIntervalMs: number;
}

export interface GameLoopParams {
  fixedTimestep: number;
  maxFrameTime: number;
}

export interface InputParams {
  gamepadDeadZone: number;
}

export interface EmissiveParams {
  color: string;
  intensity: number;
}

export interface TransparencyParams {
  opacity: number;
}

export interface SceneMeshesParams {
  defaultPoolSize: number;
  poolSizes: Record<string, number>;
  colors: Record<string, string>;
  emissive: Record<string, EmissiveParams>;
  transparency: Record<string, TransparencyParams>;
}

export interface ParticleEffectParams {
  count: number;
  lifetime: number;
  speed: number;
  spread: number;
  sizeStart: number;
  sizeEnd: number;
  colorStart: string;
  colorEnd: string;
  gravity: number;
  emissive: boolean;
}

export interface ParticlesParams {
  maxParticles: number;
  maxParticlesPerType: number;
  effects: Record<string, ParticleEffectParams>;
}

export interface VisibilityParams {
  fogOfWarRadius: number;
  losMaxRange: number;
}

export interface DesignParams {
  player: PlayerParams;
  guns: Record<string, GunParams>;
  traits: TraitsParams;
  enemies: EnemiesParams;
  hazards: HazardsParams;
  dungeon: DungeonParams;
  shop: ShopParams;
  gunMechanics: GunMechanicsParams;
  projectiles: ProjectilesParams;
  entityColliders: EntityCollidersParams;
  destructibles: DestructiblesParams;
  camera: CameraParams;
  visibility: VisibilityParams;
  screenEffects: ScreenEffectsParams;
  particles: ParticlesParams;
  loadingScreen: LoadingScreenParams;
  damageNumbers: DamageNumbersParams;
  gameLoop: GameLoopParams;
  input: InputParams;
  sceneMeshes: SceneMeshesParams;
}

// --- Required sections ---

const REQUIRED_SECTIONS: ReadonlyArray<keyof DesignParams> = [
  'player',
  'guns',
  'traits',
  'enemies',
  'hazards',
  'dungeon',
  'shop',
  'gunMechanics',
  'projectiles',
  'entityColliders',
  'destructibles',
  'camera',
  'visibility',
  'screenEffects',
  'particles',
  'loadingScreen',
  'damageNumbers',
  'gameLoop',
  'input',
  'sceneMeshes',
] as const;

// --- Validation ---

export function validateDesignParams(data: unknown): DesignParams {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Design params must be a non-null object');
  }

  const obj = data as Record<string, unknown>;

  for (const section of REQUIRED_SECTIONS) {
    if (!(section in obj)) {
      throw new Error(`Missing required section: "${section}"`);
    }
    if (typeof obj[section] !== 'object' || obj[section] === null) {
      throw new Error(`Section "${section}" must be a non-null object`);
    }
  }

  return data as DesignParams;
}

// --- Singleton ---

let cachedParams: DesignParams | null = null;

export function getDesignParams(): DesignParams {
  if (cachedParams === null) {
    cachedParams = validateDesignParams(designParamsJson);
  }
  return cachedParams;
}
