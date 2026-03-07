import { World } from '../ecs/world';
import { AppState, WeaponSlot } from '../ecs/components';
import type { Player, Gun } from '../ecs/components';
import { getDesignParams } from '../config/designParams';
import { useAppStore } from '../store/appStore';

/**
 * Checks each gun's XP against the forced upgrade threshold.
 * When XP >= maxCost (the highest xpCosts[level] among non-maxed traits),
 * sets forcedUpgradeTriggered=true and transitions to ForcedUpgrade state.
 *
 * Runs at step 17 in the system execution order, after PickupSystem.
 */
export function gunXPSystem(world: World): void {
  const params = getDesignParams();
  const { xpCosts, maxLevel } = params.traits;

  const playerEntities = world.query(['Player']);
  if (playerEntities.length === 0) return;

  const playerId = playerEntities[0];
  const player = world.getComponent<Player>(playerId, 'Player');
  if (!player) return;

  const slots: [WeaponSlot, number | undefined][] = [
    [WeaponSlot.Sidearm, player.sidearmSlot],
    [WeaponSlot.LongArm, player.longArmSlot],
  ];

  for (const [slot, gunEntityId] of slots) {
    if (gunEntityId === undefined) continue;

    const gun = world.getComponent<Gun>(gunEntityId, 'Gun');
    if (!gun) continue;

    if (gun.forcedUpgradeTriggered) continue;

    // Calculate maxCost: highest xpCosts[level] among non-maxed traits
    let maxCost = -1;
    for (const level of gun.traitLevels) {
      if (level >= maxLevel) continue;
      const cost = xpCosts[level];
      if (cost > maxCost) {
        maxCost = cost;
      }
    }

    // All traits maxed — nothing to upgrade
    if (maxCost === -1) continue;

    if (gun.xp >= maxCost) {
      gun.forcedUpgradeTriggered = true;
      const store = useAppStore.getState();
      store.transition(AppState.ForcedUpgrade);
      useAppStore.setState({ forcedUpgradeGunSlot: slot });
      // Only trigger for one gun per frame
      return;
    }
  }
}
