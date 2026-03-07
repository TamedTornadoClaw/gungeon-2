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
}

export interface DestructiblesParams {
  crateHealth: number;
  pillarHealth: number;
  barrelHealth: number;
}

export interface CameraParams {
  fov: number;
  angle: number;
  distance: number;
  followSmoothing: number;
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

export interface GameLoopParams {
  fixedTimestep: number;
  maxFrameTime: number;
}

export interface InputParams {
  gamepadDeadZone: number;
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
  destructibles: DestructiblesParams;
  camera: CameraParams;
  screenEffects: ScreenEffectsParams;
  damageNumbers: DamageNumbersParams;
  gameLoop: GameLoopParams;
  input: InputParams;
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
  'destructibles',
  'camera',
  'screenEffects',
  'damageNumbers',
  'gameLoop',
  'input',
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
