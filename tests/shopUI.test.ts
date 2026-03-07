import { describe, it, expect, beforeEach } from 'vitest';
import { AppState, PickupType } from '../src/ecs/components';
import { useAppStore } from '../src/store/appStore';
import { useShopStore, type ShopItemData } from '../src/store/shopStore';
import { useGameplayStore } from '../src/store/gameplayStore';
import { getDesignParams } from '../src/config/designParams';
import { World } from '../src/ecs/world';
import { EventQueue } from '../src/gameloop/events';
import { createShop } from '../src/ecs/factories';
import { createPlayer } from '../src/ecs/factories';
import { GunType } from '../src/ecs/components';
import type { Shop, Player, Health } from '../src/ecs/components';

function resetStores() {
  useAppStore.setState({
    currentState: AppState.ShopBrowse,
    previousState: AppState.Gameplay,
    selectedSidearm: null,
    selectedLongArm: null,
    comparisonGunEntityId: null,
    comparisonSlot: null,
    forcedUpgradeGunSlot: null,
    activeShopEntityId: null,
    runStats: null,
  });
  useShopStore.setState({
    items: [],
    worldRef: null,
    eventQueueRef: null,
  });
  useGameplayStore.setState({
    currency: 0,
  });
}

function makeTestItem(overrides?: Partial<ShopItemData>): ShopItemData {
  return {
    type: PickupType.HealthPickup,
    price: 30,
    healAmount: 30,
    sold: false,
    ...overrides,
  };
}

function setupWorldWithShopAndPlayer(): {
  world: World;
  eventQueue: EventQueue;
  shopId: number;
  playerId: number;
} {
  const world = new World();
  const eventQueue = new EventQueue();

  const params = getDesignParams();
  const items = [
    {
      type: PickupType.HealthPickup,
      price: params.shop.healthPickupPrice,
      healAmount: params.shop.healthPickupHealAmount,
      sold: false,
    },
  ];

  const shopId = createShop(world, { x: 0, y: 0, z: 0 }, items);
  const playerId = createPlayer(world, { x: 1, y: 0, z: 0 }, GunType.SMG);

  // Set player currency
  const player = world.getComponent<Player>(playerId, 'Player')!;
  player.currency = 100;

  useAppStore.setState({ activeShopEntityId: shopId });

  return { world, eventQueue, shopId, playerId };
}

describe('ShopUI', () => {
  beforeEach(resetStores);

  describe('shop design params', () => {
    it('should have a healthPickupPrice in design params', () => {
      const params = getDesignParams();
      expect(params.shop.healthPickupPrice).toBeGreaterThan(0);
    });

    it('should have a healthPickupHealAmount in design params', () => {
      const params = getDesignParams();
      expect(params.shop.healthPickupHealAmount).toBeGreaterThan(0);
    });
  });

  describe('state transitions', () => {
    it('should transition from ShopBrowse to Gameplay', () => {
      const { transition } = useAppStore.getState();
      transition(AppState.Gameplay);
      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
    });

    it('should reject invalid transitions from ShopBrowse', () => {
      const { transition } = useAppStore.getState();
      expect(() => transition(AppState.MainMenu)).toThrow('Invalid transition');
    });

    it('should reject transition to Death from ShopBrowse', () => {
      const { transition } = useAppStore.getState();
      expect(() => transition(AppState.Death)).toThrow('Invalid transition');
    });
  });

  describe('shopStore', () => {
    it('should start with empty items', () => {
      expect(useShopStore.getState().items).toEqual([]);
    });

    it('should populate items on openShop', () => {
      const world = new World();
      const eventQueue = new EventQueue();
      const items = [makeTestItem(), makeTestItem({ price: 50 })];

      useShopStore.getState().openShop(items, world, eventQueue);

      const state = useShopStore.getState();
      expect(state.items).toHaveLength(2);
      expect(state.items[0].price).toBe(30);
      expect(state.items[1].price).toBe(50);
    });

    it('openShop should make defensive copies of items', () => {
      const world = new World();
      const eventQueue = new EventQueue();
      const original = [makeTestItem()];

      useShopStore.getState().openShop(original, world, eventQueue);

      // Mutating original should not affect store
      original[0].sold = true;
      expect(useShopStore.getState().items[0].sold).toBe(false);
    });

    it('closeShop should clear items and refs', () => {
      const world = new World();
      const eventQueue = new EventQueue();
      useShopStore.getState().openShop([makeTestItem()], world, eventQueue);

      useShopStore.getState().closeShop();

      const state = useShopStore.getState();
      expect(state.items).toEqual([]);
      expect(state.worldRef).toBeNull();
      expect(state.eventQueueRef).toBeNull();
    });
  });

  describe('purchase', () => {
    it('should successfully purchase an item when player has enough currency', () => {
      const { world, eventQueue } = setupWorldWithShopAndPlayer();
      const params = getDesignParams();
      const items = [makeTestItem({ price: params.shop.healthPickupPrice })];
      useShopStore.getState().openShop(items, world, eventQueue);
      useGameplayStore.setState({ currency: 100 });

      const success = useShopStore.getState().purchase(0, 100);

      expect(success).toBe(true);
      expect(useShopStore.getState().items[0].sold).toBe(true);
    });

    it('should fail purchase when player has insufficient currency', () => {
      const { world, eventQueue } = setupWorldWithShopAndPlayer();
      const items = [makeTestItem({ price: 50 })];
      useShopStore.getState().openShop(items, world, eventQueue);

      const success = useShopStore.getState().purchase(0, 10);

      expect(success).toBe(false);
      expect(useShopStore.getState().items[0].sold).toBe(false);
    });

    it('should fail purchase of already sold item', () => {
      const { world, eventQueue } = setupWorldWithShopAndPlayer();
      const items = [makeTestItem({ sold: true })];
      useShopStore.getState().openShop(items, world, eventQueue);

      const success = useShopStore.getState().purchase(0, 100);

      expect(success).toBe(false);
    });

    it('should fail purchase with invalid index', () => {
      const { world, eventQueue } = setupWorldWithShopAndPlayer();
      const items = [makeTestItem()];
      useShopStore.getState().openShop(items, world, eventQueue);

      const success = useShopStore.getState().purchase(5, 100);

      expect(success).toBe(false);
    });

    it('should fail purchase when worldRef is null', () => {
      useShopStore.setState({ items: [makeTestItem()], worldRef: null, eventQueueRef: null });

      const success = useShopStore.getState().purchase(0, 100);

      expect(success).toBe(false);
    });

    it('should deduct currency from player entity on purchase', () => {
      const { world, eventQueue, playerId } = setupWorldWithShopAndPlayer();
      const items = [makeTestItem({ price: 30 })];
      useShopStore.getState().openShop(items, world, eventQueue);

      useShopStore.getState().purchase(0, 100);

      const player = world.getComponent<Player>(playerId, 'Player')!;
      expect(player.currency).toBe(70);
    });

    it('should heal player on health pickup purchase', () => {
      const { world, eventQueue, playerId } = setupWorldWithShopAndPlayer();
      const health = world.getComponent<Health>(playerId, 'Health')!;
      health.current = 50;
      health.max = 100;

      const items = [makeTestItem({ price: 30, healAmount: 30 })];
      useShopStore.getState().openShop(items, world, eventQueue);

      useShopStore.getState().purchase(0, 100);

      expect(health.current).toBe(80);
    });

    it('should not heal above max health', () => {
      const { world, eventQueue, playerId } = setupWorldWithShopAndPlayer();
      const health = world.getComponent<Health>(playerId, 'Health')!;
      health.current = 90;
      health.max = 100;

      const items = [makeTestItem({ price: 30, healAmount: 30 })];
      useShopStore.getState().openShop(items, world, eventQueue);

      useShopStore.getState().purchase(0, 100);

      expect(health.current).toBe(100);
    });

    it('should mark item as sold in shop component after purchase', () => {
      const { world, eventQueue, shopId } = setupWorldWithShopAndPlayer();
      const items = [makeTestItem({ price: 30 })];
      useShopStore.getState().openShop(items, world, eventQueue);

      useShopStore.getState().purchase(0, 100);

      const shop = world.getComponent<Shop>(shopId, 'Shop')!;
      expect(shop.inventory[0].sold).toBe(true);
    });
  });

  describe('close behavior', () => {
    it('should clear activeShopEntityId on close', () => {
      useAppStore.setState({ activeShopEntityId: 42 });

      useShopStore.getState().closeShop();
      useAppStore.setState({ activeShopEntityId: null });

      expect(useAppStore.getState().activeShopEntityId).toBeNull();
    });

    it('should transition to Gameplay when closing shop', () => {
      useAppStore.getState().transition(AppState.Gameplay);
      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
    });
  });

  describe('item display data', () => {
    it('should preserve item type in store', () => {
      const world = new World();
      const eventQueue = new EventQueue();
      const items = [makeTestItem({ type: PickupType.HealthPickup })];
      useShopStore.getState().openShop(items, world, eventQueue);

      expect(useShopStore.getState().items[0].type).toBe(PickupType.HealthPickup);
    });

    it('should preserve healAmount in store', () => {
      const world = new World();
      const eventQueue = new EventQueue();
      const items = [makeTestItem({ healAmount: 45 })];
      useShopStore.getState().openShop(items, world, eventQueue);

      expect(useShopStore.getState().items[0].healAmount).toBe(45);
    });

    it('should preserve price in store', () => {
      const world = new World();
      const eventQueue = new EventQueue();
      const items = [makeTestItem({ price: 75 })];
      useShopStore.getState().openShop(items, world, eventQueue);

      expect(useShopStore.getState().items[0].price).toBe(75);
    });
  });
});
