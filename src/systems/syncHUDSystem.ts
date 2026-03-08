import { World } from '../ecs/world';
import { useGameplayStore, type GunHUDData } from '../store/gameplayStore';
import type { Player, Health, Gun } from '../ecs/components';
import { WeaponSlot } from '../ecs/components';

function extractGunHUDData(world: World, gunEntityId: number): GunHUDData | null {
  const gun = world.getComponent<Gun>(gunEntityId, 'Gun');
  if (!gun) return null;
  return {
    gunType: gun.gunType,
    currentAmmo: gun.currentAmmo,
    magazineSize: gun.magazineSize,
    isReloading: gun.isReloading,
    reloadTimer: gun.reloadTimer,
    reloadTime: gun.reloadTime,
  };
}

export function syncHUDSystem(world: World): void {
  const playerIds = world.query(['Player', 'Health']);
  if (playerIds.length === 0) return;

  const playerId = playerIds[0];
  const player = world.getComponent<Player>(playerId, 'Player')!;
  const health = world.getComponent<Health>(playerId, 'Health')!;

  const store = useGameplayStore.getState();

  store.setHealth(health.current, health.max);
  store.setCurrency(player.currency);
  store.setActiveSlot(player.activeSlot);

  const sidearmData = extractGunHUDData(world, player.sidearmSlot);
  const longArmData = extractGunHUDData(world, player.longArmSlot);

  store.setSidearmGun(sidearmData);
  store.setLongArmGun(longArmData);

  // Set activeGun based on the active slot
  const activeData = player.activeSlot === WeaponSlot.Sidearm ? sidearmData : longArmData;
  store.setActiveGun(activeData);
}
