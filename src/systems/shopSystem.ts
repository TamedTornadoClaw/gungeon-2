import { World } from '../ecs/world';
import { EventQueue } from '../gameloop/events';
import { AppState, EventType, PickupType, SoundId } from '../ecs/components';
import type { Health, Player, Position, Shop, ShopItem } from '../ecs/components';
import type { InputState } from '../input/inputManager';
import { useAppStore } from '../store/appStore';

interface ProximityFlags {
  nearPickup: boolean;
  nearChest: boolean;
  nearShop: boolean;
  nearStairs: boolean;
}

/**
 * ShopSystem — handles shop interactions: opening the shop UI and purchasing items.
 *
 * Runs after CollisionResponseSystem (which sets nearShop flag on ProximityFlags).
 * When the player is near a shop and presses interact during Gameplay:
 *   - Transitions to ShopBrowse state
 *   - Sets activeShopEntityId in Zustand store
 *
 * Purchase flow is triggered externally (from UI) by calling purchaseShopItem().
 */
export function shopSystem(world: World, input: InputState, eventQueue: EventQueue): void {
  const appStore = useAppStore.getState();

  // Handle shop entity destroyed while browsing
  if (appStore.currentState === AppState.ShopBrowse) {
    const activeId = appStore.activeShopEntityId;
    if (activeId !== null && !world.hasEntity(activeId)) {
      appStore.transition(AppState.Gameplay);
      useAppStore.setState({ activeShopEntityId: null });
    }
    return;
  }

  if (appStore.currentState !== AppState.Gameplay) return;
  if (!input.interact) return;

  const players = world.query(['PlayerTag', 'ProximityFlags']);
  if (players.length === 0) return;

  const playerId = players[0];
  const flags = world.getComponent<ProximityFlags>(playerId, 'ProximityFlags');
  if (!flags || !flags.nearShop) return;

  const shops = world.query(['Shop', 'ShopTag', 'Position']);
  if (shops.length === 0) return;

  // Select the first shop entity (deterministic: lowest entity ID from query order)
  const shopId = shops[0];

  appStore.transition(AppState.ShopBrowse);
  useAppStore.setState({ activeShopEntityId: shopId });

  eventQueue.emit({
    type: EventType.Audio,
    sound: SoundId.MenuClick,
  });
}

/**
 * Purchase an item from the active shop.
 * Called by the shop UI when the player clicks a purchase button.
 */
export function purchaseShopItem(
  world: World,
  eventQueue: EventQueue,
  itemIndex: number,
): boolean {
  const appStore = useAppStore.getState();
  if (appStore.currentState !== AppState.ShopBrowse) return false;

  const shopId = appStore.activeShopEntityId;
  if (shopId === null || !world.hasEntity(shopId)) return false;

  const shop = world.getComponent<Shop>(shopId, 'Shop');
  if (!shop) return false;

  if (itemIndex < 0 || itemIndex >= shop.inventory.length) return false;

  const item: ShopItem = shop.inventory[itemIndex];
  if (item.sold) return false;

  const players = world.query(['PlayerTag', 'Player', 'Health']);
  if (players.length === 0) return false;

  const playerId = players[0];
  const player = world.getComponent<Player>(playerId, 'Player');
  const health = world.getComponent<Health>(playerId, 'Health');
  if (!player || !health) return false;

  if (player.currency < item.price) return false;

  // Deduct currency
  player.currency -= item.price;

  // Apply item effect
  if (item.type === PickupType.HealthPickup && item.healAmount !== undefined) {
    health.current = Math.min(health.current + item.healAmount, health.max);
  }

  // Mark as sold
  item.sold = true;

  // Emit audio
  const shopPos = world.getComponent<Position>(shopId, 'Position');
  eventQueue.emit({
    type: EventType.Audio,
    sound: SoundId.CurrencyPickup,
    position: shopPos ? { x: shopPos.x, y: shopPos.y, z: shopPos.z } : undefined,
  });

  return true;
}
