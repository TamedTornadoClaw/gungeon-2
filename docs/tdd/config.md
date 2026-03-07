# Design Parameters

All tunable values are centralized in `config/design-params.json`. No magic numbers in source code. Systems import and reference by name.

## Player Stats

```json
{
  "player": {
    "baseHealth": 100,
    "baseMovementSpeed": 5.0,
    "dodgeRoll": {
      "cooldown": 1.0,
      "duration": 0.3,
      "speed": 12.0,
      "iFrameDuration": 0.3
    },
    "xpCollectionRange": 3.0,
    "xpGemFlySpeed": 15.0,
    "interactRange": 2.0
  }
}
```

## Gun Base Stats

```json
{
  "guns": {
    "Pistol": {
      "category": "Sidearm",
      "damage": 15,
      "fireRate": 3.0,
      "magazineSize": 12,
      "reloadTime": 1.0,
      "spread": 0.02,
      "projectileCount": 1,
      "projectileSpeed": 30.0,
      "projectileLifetime": 1.5,
      "knockback": 0.5,
      "critChance": 0.05,
      "critMultiplier": 2.0,
      "traits": ["Damage", "CriticalChance", "CriticalMultiplier"]
    },
    "SMG": {
      "category": "LongArm",
      "damage": 6,
      "fireRate": 12.0,
      "magazineSize": 40,
      "reloadTime": 1.8,
      "spread": 0.08,
      "projectileCount": 1,
      "projectileSpeed": 28.0,
      "projectileLifetime": 1.5,
      "knockback": 0.2,
      "critChance": 0.03,
      "critMultiplier": 1.5,
      "traits": ["FireRate", "MagazineSize", "ProjectileSpeed"]
    },
    "AssaultRifle": {
      "category": "LongArm",
      "damage": 10,
      "fireRate": 8.0,
      "magazineSize": 30,
      "reloadTime": 2.0,
      "spread": 0.04,
      "projectileCount": 1,
      "projectileSpeed": 32.0,
      "projectileLifetime": 1.8,
      "knockback": 0.4,
      "critChance": 0.04,
      "critMultiplier": 1.8,
      "traits": ["FireRate", "ProjectileCount", "ProjectileSpeed"]
    },
    "Shotgun": {
      "category": "LongArm",
      "damage": 8,
      "fireRate": 1.5,
      "magazineSize": 6,
      "reloadTime": 2.5,
      "spread": 0.15,
      "projectileCount": 6,
      "projectileSpeed": 25.0,
      "projectileLifetime": 0.8,
      "knockback": 1.5,
      "critChance": 0.03,
      "critMultiplier": 1.5,
      "traits": ["ProjectileCount", "Spread", "Damage"]
    },
    "LMG": {
      "category": "LongArm",
      "damage": 12,
      "fireRate": 6.0,
      "magazineSize": 80,
      "reloadTime": 3.5,
      "spread": 0.06,
      "projectileCount": 1,
      "projectileSpeed": 30.0,
      "projectileLifetime": 2.0,
      "knockback": 1.0,
      "critChance": 0.03,
      "critMultiplier": 1.5,
      "traits": ["Damage", "MagazineSize", "Knockback"]
    }
  }
}
```

## Trait Upgrade Costs and Bonuses

```json
{
  "traits": {
    "maxLevel": 5,
    "xpCosts": [50, 150, 350, 700, 1200],
    "bonusPerLevel": {
      "Damage": [2, 4, 7, 11, 16],
      "FireRate": [0.5, 1.0, 1.5, 2.5, 4.0],
      "MagazineSize": [3, 6, 10, 16, 24],
      "ReloadTime": [-0.1, -0.2, -0.3, -0.45, -0.6],
      "Spread": [-0.01, -0.02, -0.03, -0.04, -0.05],
      "ProjectileCount": [1, 1, 2, 2, 3],
      "ProjectileSpeed": [2, 4, 6, 9, 13],
      "Knockback": [0.3, 0.6, 1.0, 1.5, 2.0],
      "CriticalChance": [0.03, 0.06, 0.10, 0.15, 0.22],
      "CriticalMultiplier": [0.3, 0.6, 1.0, 1.5, 2.0],
      "Piercing": [1, 1, 2, 2, 3],
      "Bouncing": [1, 2, 3, 4, 5]
    }
  }
}
```

## Enemy Stats

```json
{
  "enemies": {
    "KnifeRusher": {
      "baseHealth": 30,
      "baseDamage": 15,
      "baseSpeed": 6.0,
      "detectionRange": 12.0,
      "attackRange": 1.5,
      "attackCooldown": 0.8,
      "xpDrop": 15,
      "currencyDropChance": 0.3,
      "currencyDropAmount": 5
    },
    "ShieldGun": {
      "baseHealth": 60,
      "baseDamage": 10,
      "baseSpeed": 3.0,
      "detectionRange": 15.0,
      "attackRange": 10.0,
      "attackCooldown": 1.5,
      "projectileSpeed": 14.0,
      "projectileCount": 1,
      "spread": 0.03,
      "shieldHealth": 40,
      "shieldArc": 1.57,
      "xpDrop": 25,
      "currencyDropChance": 0.4,
      "currencyDropAmount": 8
    },
    "Shotgunner": {
      "baseHealth": 50,
      "baseDamage": 8,
      "baseSpeed": 3.5,
      "detectionRange": 12.0,
      "attackRange": 6.0,
      "attackCooldown": 2.0,
      "projectileSpeed": 18.0,
      "projectileCount": 5,
      "spread": 0.2,
      "xpDrop": 20,
      "currencyDropChance": 0.35,
      "currencyDropAmount": 7
    },
    "Rifleman": {
      "baseHealth": 45,
      "baseDamage": 12,
      "baseSpeed": 3.0,
      "detectionRange": 18.0,
      "attackRange": 15.0,
      "attackCooldown": 2.5,
      "projectileSpeed": 22.0,
      "projectileCount": 1,
      "spread": 0.01,
      "xpDrop": 22,
      "currencyDropChance": 0.35,
      "currencyDropAmount": 6
    },
    "SuicideBomber": {
      "baseHealth": 20,
      "baseDamage": 40,
      "baseSpeed": 7.0,
      "detectionRange": 10.0,
      "explosionRadius": 3.0,
      "xpDrop": 18,
      "currencyDropChance": 0.2,
      "currencyDropAmount": 10
    },
    "depthScaling": {
      "healthMultiplierPerDepth": 0.15,
      "damageMultiplierPerDepth": 0.10,
      "speedMultiplierPerDepth": 0.03,
      "shieldHealthMultiplierPerDepth": 0.15,
      "miniBossStatMultiplier": 2.5,
      "miniBossXPMultiplier": 3.0,
      "bossStatMultiplier": 4.0,
      "bossXPMultiplier": 10.0
    }
  }
}
```

## Hazards

```json
{
  "hazards": {
    "fire": {
      "damagePerSecond": 10
    },
    "spikes": {
      "damage": 20,
      "cooldown": 1.0
    },
    "water": {
      "speedMultiplier": 0.5
    }
  }
}
```

## Dungeon Generation

```json
{
  "dungeon": {
    "roomMinSize": 20,
    "roomMaxSize": 50,
    "corridorWidth": 7,
    "roomsPerFloor": 8,
    "enemiesPerRoom": { "min": 3, "max": 8 },
    "miniBossChancePerRoom": 0.1,
    "chestChancePerRoom": 0.25,
    "shopChancePerFloor": 0.5,
    "healthPickupDropChance": 0.05,
    "bossFloorDepth": 10
  }
}
```

## Shop

```json
{
  "shop": {
    "healthPickupPrice": 30,
    "healthPickupHealAmount": 30
  }
}
```

## Gun Mechanics

```json
{
  "gunMechanics": {
    "minReloadTime": 0.2,
    "weaponSwapTime": 0.0
  }
}
```

**Design decision:** Weapon switching is instant (`weaponSwapTime: 0`). The GDD's "switching to your sidearm is faster than reloading" means the player can fire the sidearm immediately instead of waiting for a long arm reload — not that switching itself has a delay. Both guns reload passively in the background.

**Gun loot:** v1 guns always have their thematic trait set from config (no randomization). Found guns are the same as starter guns of that type. Gun rarity and trait randomization are deferred to post-v1 (GDD Open Question 7).

## Projectiles

```json
{
  "projectiles": {
    "bulletColliderSize": 0.2,
    "enemyBulletLifetime": 2.0
  }
}
```

Note: Player bullet lifetime is per-gun (see `projectileLifetime` in gun stats). Enemy bullet lifetime uses the global value.

## Destructibles

```json
{
  "destructibles": {
    "crateHealth": 30,
    "pillarHealth": 60,
    "barrelHealth": 20
  }
}
```

## Camera

```json
{
  "camera": {
    "fov": 50,
    "angle": 45,
    "distance": 20,
    "followSmoothing": 0.1
  }
}
```

## Screen Effects

```json
{
  "screenEffects": {
    "shake": {
      "damping": 0.9,
      "playerHitIntensity": 0.3,
      "explosionIntensity": 0.6,
      "bigHitIntensity": 0.15
    },
    "hitFlash": {
      "duration": 0.08,
      "opacity": 0.4
    },
    "damageVignette": {
      "healthThreshold": 0.25,
      "pulseSpeed": 2.0
    }
  }
}
```

## Damage Numbers

```json
{
  "damageNumbers": {
    "lifetime": 0.8,
    "driftSpeed": 2.0,
    "critScale": 1.5
  }
}
```

## Game Loop

```json
{
  "gameLoop": {
    "fixedTimestep": 0.01667,
    "maxFrameTime": 0.1
  }
}
```

**Spiral-of-death protection:** If accumulated time exceeds `maxFrameTime`, excess time is discarded (not carried to the next frame). This caps simulation steps at ~6 per real frame. If the simulation consistently exceeds budget, gameplay slows down rather than spiraling. This is the intended behavior — a brief hitch catches up, sustained overload degrades gracefully.

## Manifest Schemas

### Sound Manifest (`config/sound-manifest.json`)

```typescript
interface SoundManifest {
  [key: SoundId]: {
    path: string;           // relative path to audio file
    volume: number;         // 0-1
    pitchMin: number;       // pitch variation lower bound (e.g., 0.9)
    pitchMax: number;       // pitch variation upper bound (e.g., 1.1)
    maxInstances: number;   // max simultaneous plays (prevents stacking)
    loop: boolean;          // true for ambient sounds (FireAmbient, WaterAmbient)
  };
}
```

### Particle Manifest (`config/particle-manifest.json`)

```typescript
interface ParticleManifest {
  [key: ParticleEffect]: {
    count: number;          // particles to spawn
    lifetime: number;       // seconds
    speed: number;          // initial speed
    spread: number;         // radians — cone angle of emission
    sizeStart: number;      // initial particle size
    sizeEnd: number;        // final particle size (interpolated)
    colorStart: string;     // hex color at birth
    colorEnd: string;       // hex color at death
    emissive: boolean;      // whether particles glow
    gravity: number;        // downward acceleration (0 for no gravity)
  };
}
```

## All values are design levers. Changing them in the JSON file changes game behavior without code modification.
