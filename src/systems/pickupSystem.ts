import { World } from '../ecs/world';
import { EventQueue } from '../gameloop/events';
import type { InputState } from '../input/inputManager';
import {
  AppState,
  EventType,
  GunCategory,
  PickupType,
  SoundId,
  WeaponSlot,
} from '../ecs/components';
import type {
  CurrencyData,
  Gun,
  Health,
  HealthPickupData,
  Pickup,
  Player,
  Position,
  XPGem,
} from '../ecs/components';
import { getDesignParams } from '../config/designParams';
import { useAppStore } from '../store/appStore';
import type { EntityId } from '../types';

/**
 * PickupSystem — position 8 in system execution order.
 * Handles pickup collection: XP gems fly to player, health/currency on interact,
 * gun pickup triggers comparison screen.
 */
export function pickupSystem(
  world: World,
  input: InputState,
  eventQueue: EventQueue,
  dt: number,
): void {
  const players = world.query(['PlayerTag', 'Player', 'Position', 'Health']);
  if (players.length === 0) return;

  const playerId = players[0];
  const player = world.getComponent<Player>(playerId, 'Player')!;
  const playerPos = world.getComponent<Position>(playerId, 'Position')!;
  const playerHealth = world.getComponent<Health>(playerId, 'Health')!;

  // Skip if player is dead
  if (playerHealth.current <= 0) return;

  const params = getDesignParams();
  const flySpeed = params.player.xpGemFlySpeed;
  const collectionThreshold = 0.5;

  // Process XP gems (flying ones move toward player, collected on contact)
  processXPGems(world, eventQueue, player, playerPos, flySpeed, collectionThreshold, dt);

  // Process interact-based pickups only when interact is pressed and in Gameplay state
  if (input.interact && useAppStore.getState().currentState === AppState.Gameplay) {
    processInteractPickups(world, eventQueue, player, playerHealth);
  }
}

function processXPGems(
  world: World,
  eventQueue: EventQueue,
  player: Player,
  playerPos: Position,
  flySpeed: number,
  collectionThreshold: number,
  dt: number,
): void {
  const gems = world.query(['PickupTag', 'Pickup', 'XPGem', 'Position']);
  const toDestroy: EntityId[] = [];

  for (const gemId of gems) {
    const pickup = world.getComponent<Pickup>(gemId, 'Pickup')!;
    if (pickup.pickupType !== PickupType.XPGem) continue;

    const xpGem = world.getComponent<XPGem>(gemId, 'XPGem')!;
    if (!xpGem.isFlying) continue;

    const gemPos = world.getComponent<Position>(gemId, 'Position')!;

    // Move toward player
    const dx = playerPos.x - gemPos.x;
    const dz = playerPos.z - gemPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist <= collectionThreshold) {
      // Collect the gem
      const gunEntityId = resolveXPTarget(world, player, xpGem.sourceGunEntityId);
      if (gunEntityId !== null) {
        const gun = world.getComponent<Gun>(gunEntityId, 'Gun');
        if (gun) {
          gun.xp += xpGem.amount;
        }
      }

      eventQueue.emit({
        type: EventType.Audio,
        sound: SoundId.XPGemPickup,
        position: { x: gemPos.x, y: gemPos.y, z: gemPos.z },
      });

      toDestroy.push(gemId);
    } else {
      // Move toward player
      const nx = dx / dist;
      const nz = dz / dist;
      const moveAmount = Math.min(flySpeed * dt, dist);
      gemPos.x += nx * moveAmount;
      gemPos.z += nz * moveAmount;
    }
  }

  for (const id of toDestroy) {
    world.destroyEntity(id);
  }
}

function resolveXPTarget(
  world: World,
  player: Player,
  sourceGunEntityId: EntityId,
): EntityId | null {
  // Try the original gun entity first
  if (world.hasEntity(sourceGunEntityId)) {
    const gun = world.getComponent<Gun>(sourceGunEntityId, 'Gun');
    if (gun) return sourceGunEntityId;
  }

  // Fallback: find the gun in the same category slot
  // We need to determine which slot the original gun was in by checking its category
  // Since the entity is gone, we check both slots and pick the one that exists
  const sidearmGun = world.getComponent<Gun>(player.sidearmSlot, 'Gun');
  const longArmGun = world.getComponent<Gun>(player.longArmSlot, 'Gun');

  // Try sidearm first, then long arm — return first valid gun
  if (sidearmGun && world.hasEntity(player.sidearmSlot)) return player.sidearmSlot;
  if (longArmGun && world.hasEntity(player.longArmSlot)) return player.longArmSlot;

  return null;
}

function processInteractPickups(
  world: World,
  eventQueue: EventQueue,
  player: Player,
  playerHealth: Health,
): void {
  const pickups = world.query(['PickupTag', 'Pickup', 'NearPickup', 'Position']);

  for (const pickupId of pickups) {
    const pickup = world.getComponent<Pickup>(pickupId, 'Pickup')!;

    switch (pickup.pickupType) {
      case PickupType.HealthPickup: {
        const hpData = world.getComponent<HealthPickupData>(pickupId, 'HealthPickupData');
        if (!hpData) break;

        const healAmount = Math.max(0, hpData.healAmount);
        playerHealth.current = Math.min(playerHealth.current + healAmount, playerHealth.max);

        eventQueue.emit({
          type: EventType.Audio,
          sound: SoundId.HealthPickup,
          position: { ...world.getComponent<Position>(pickupId, 'Position')! },
        });

        world.destroyEntity(pickupId);
        return; // One interact pickup per frame
      }

      case PickupType.Currency: {
        const currencyData = world.getComponent<CurrencyData>(pickupId, 'CurrencyData');
        if (!currencyData) break;

        player.currency += currencyData.amount;

        eventQueue.emit({
          type: EventType.Audio,
          sound: SoundId.CurrencyPickup,
          position: { ...world.getComponent<Position>(pickupId, 'Position')! },
        });

        world.destroyEntity(pickupId);
        return; // One interact pickup per frame
      }

      case PickupType.GunPickup: {
        const gunData = world.getComponent<Gun>(pickupId, 'Gun');
        if (!gunData) break;

        const slot = gunData.category === GunCategory.Sidearm
          ? WeaponSlot.Sidearm
          : WeaponSlot.LongArm;

        useAppStore.getState().transition(AppState.GunComparison);
        useAppStore.setState({
          comparisonGunEntityId: pickupId,
          comparisonSlot: slot,
        });

        // Do NOT destroy — comparison screen handles accept/reject
        return;
      }

      default:
        break;
    }
  }
}
