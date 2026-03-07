import { World } from '../ecs/world';
import { GunTrait } from '../ecs/components';
import type { Gun } from '../ecs/components';
import { getDesignParams } from '../config/designParams';

/** Map GunTrait enum values to the stat property names on the Gun component. */
const TRAIT_TO_STAT: Partial<Record<GunTrait, keyof Gun>> = {
  [GunTrait.Damage]: 'damage',
  [GunTrait.FireRate]: 'fireRate',
  [GunTrait.MagazineSize]: 'magazineSize',
  [GunTrait.ReloadTime]: 'reloadTime',
  [GunTrait.Spread]: 'spread',
  [GunTrait.ProjectileCount]: 'projectileCount',
  [GunTrait.ProjectileSpeed]: 'projectileSpeed',
  [GunTrait.Knockback]: 'knockback',
  [GunTrait.CriticalChance]: 'critChance',
  [GunTrait.CriticalMultiplier]: 'critMultiplier',
};

/** Map GunTrait enum values to their base stat property names on the Gun component. */
const TRAIT_TO_BASE_STAT: Partial<Record<GunTrait, keyof Gun>> = {
  [GunTrait.Damage]: 'baseDamage',
  [GunTrait.FireRate]: 'baseFireRate',
  [GunTrait.MagazineSize]: 'baseMagazineSize',
  [GunTrait.ReloadTime]: 'baseReloadTime',
  [GunTrait.Spread]: 'baseSpread',
  [GunTrait.ProjectileCount]: 'baseProjectileCount',
  [GunTrait.ProjectileSpeed]: 'baseProjectileSpeed',
  [GunTrait.Knockback]: 'baseKnockback',
  [GunTrait.CriticalChance]: 'baseCritChance',
  [GunTrait.CriticalMultiplier]: 'baseCritMultiplier',
};

/**
 * GunStatSystem — on-demand system, called after trait upgrades.
 * Recalculates computed gun stats from base stats + trait bonuses.
 */
export function gunStatSystem(world: World): void {
  const params = getDesignParams();
  const bonusPerLevel = params.traits.bonusPerLevel;
  const minReloadTime = params.gunMechanics.minReloadTime;

  const gunEntities = world.query(['Gun']);

  for (const id of gunEntities) {
    const gun = world.getComponent<Gun>(id, 'Gun')!;

    // Reset all computed stats to base values
    gun.damage = gun.baseDamage;
    gun.fireRate = gun.baseFireRate;
    gun.magazineSize = gun.baseMagazineSize;
    gun.reloadTime = gun.baseReloadTime;
    gun.spread = gun.baseSpread;
    gun.projectileCount = gun.baseProjectileCount;
    gun.projectileSpeed = gun.baseProjectileSpeed;
    gun.knockback = gun.baseKnockback;
    gun.critChance = gun.baseCritChance;
    gun.critMultiplier = gun.baseCritMultiplier;

    // Apply trait bonuses
    for (let i = 0; i < gun.traits.length; i++) {
      const trait = gun.traits[i];
      const level = gun.traitLevels[i];
      if (level <= 0) continue;

      const traitName = GunTrait[trait];
      const bonuses = bonusPerLevel[traitName];
      if (!bonuses) continue;

      const bonus = bonuses[level - 1];
      if (bonus === undefined) continue;

      const statKey = TRAIT_TO_STAT[trait];
      const baseStatKey = TRAIT_TO_BASE_STAT[trait];
      if (statKey && baseStatKey) {
        (gun[statKey] as number) = (gun[baseStatKey] as number) + bonus;
      }
    }

    // Post-processing: round magazineSize, clamp reloadTime
    gun.magazineSize = Math.round(gun.magazineSize);
    gun.reloadTime = Math.max(gun.reloadTime, minReloadTime);
  }
}
