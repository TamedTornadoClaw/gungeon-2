import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import { EventQueue } from '../src/gameloop/events';
import { shopSystem, purchaseShopItem } from '../src/systems/shopSystem';
import {
  AppState,
  EventType,
  PickupType,
  SoundId,
  WeaponSlot,
} from '../src/ecs/components';
import type {
  Health,
  Player,
  Position,
  Shop,
  ShopItem,
} from '../src/ecs/components';
import type { InputState } from '../src/input/inputManager';
import type { AudioEvent } from '../src/gameloop/events';
import { useAppStore } from '../src/store/appStore';

function makeInput(overrides: Partial<InputState> = {}): InputState {
  return {
    moveX: 0,
    moveY: 0,
    aimWorldX: 0,
    aimWorldY: 0,
    mouseDeltaX: 0,
    mouseDeltaY: 0,
    pointerLockLost: false,
    fireSidearm: false,
    fireLongArm: false,
    reload: false,
    dodgeRoll: false,
    interact: false,
    openUpgrade: false,
    pause: false,
    debugSpeedUp: false,
    debugSpeedDown: false,
    ...overrides,
  };
}

function createPlayer(
  world: World,
  nearShop: boolean,
  currency = 100,
  currentHealth = 100,
  maxHealth = 100,
): number {
  const id = world.createEntity();
  world.addComponent(id, 'PlayerTag', {});
  world.addComponent(id, 'ProximityFlags', {
    nearPickup: false,
    nearChest: false,
    nearShop,
    nearStairs: false,
  });
  world.addComponent<Position>(id, 'Position', { x: 0, y: 0, z: 0 });
  world.addComponent<Player>(id, 'Player', {
    sidearmSlot: 0,
    longArmSlot: 0,
    activeSlot: WeaponSlot.Sidearm,
    currency,
  });
  world.addComponent<Health>(id, 'Health', {
    current: currentHealth,
    max: maxHealth,
    lastDamageSourceGunSlot: null,
  });
  return id;
}

function createShopEntity(
  world: World,
  inventory: ShopItem[],
  position: { x: number; y: number; z: number } = { x: 5, y: 0, z: 5 },
): number {
  const id = world.createEntity();
  world.addComponent<Shop>(id, 'Shop', { inventory });
  world.addComponent(id, 'ShopTag', {});
  world.addComponent<Position>(id, 'Position', { ...position });
  return id;
}

function makeHealthItem(price: number, healAmount: number, sold = false): ShopItem {
  return { type: PickupType.HealthPickup, price, healAmount, sold };
}

function getAudioEvents(eq: EventQueue): AudioEvent[] {
  return eq.consume(EventType.Audio);
}

function setGameplayState(): void {
  // Force state to Gameplay by going Loading -> MainMenu -> WeaponSelect -> Gameplay
  const store = useAppStore.getState();
  if (store.currentState === AppState.Loading) {
    store.transition(AppState.MainMenu);
  }
  if (useAppStore.getState().currentState === AppState.MainMenu) {
    useAppStore.getState().transition(AppState.WeaponSelect);
  }
  if (useAppStore.getState().currentState === AppState.WeaponSelect) {
    useAppStore.getState().transition(AppState.Gameplay);
  }
}

describe('ShopSystem', () => {
  beforeEach(() => {
    // Reset Zustand store to initial state
    useAppStore.setState({
      currentState: AppState.Loading,
      previousState: null,
      selectedLongArm: null,
      comparisonGunEntityId: null,
      comparisonSlot: null,
      forcedUpgradeGunSlot: null,
      activeShopEntityId: null,
      runStats: null,
    });
  });

  describe('shop interaction', () => {
    it('opens ShopBrowse when player is near shop and presses interact', () => {
      const world = new World();
      const eq = new EventQueue();
      createPlayer(world, true);
      const shopId = createShopEntity(world, [makeHealthItem(30, 30)]);
      setGameplayState();

      shopSystem(world, makeInput({ interact: true }), eq);

      expect(useAppStore.getState().currentState).toBe(AppState.ShopBrowse);
      expect(useAppStore.getState().activeShopEntityId).toBe(shopId);
    });

    it('does not open shop when interact is false', () => {
      const world = new World();
      const eq = new EventQueue();
      createPlayer(world, true);
      createShopEntity(world, [makeHealthItem(30, 30)]);
      setGameplayState();

      shopSystem(world, makeInput({ interact: false }), eq);

      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
      expect(useAppStore.getState().activeShopEntityId).toBeNull();
    });

    it('does not open shop when player is not near', () => {
      const world = new World();
      const eq = new EventQueue();
      createPlayer(world, false);
      createShopEntity(world, [makeHealthItem(30, 30)]);
      setGameplayState();

      shopSystem(world, makeInput({ interact: true }), eq);

      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
      expect(useAppStore.getState().activeShopEntityId).toBeNull();
    });

    it('near shop without interact does nothing after 60 frames', () => {
      const world = new World();
      const eq = new EventQueue();
      createPlayer(world, true);
      createShopEntity(world, [makeHealthItem(30, 30)]);
      setGameplayState();

      for (let i = 0; i < 60; i++) {
        shopSystem(world, makeInput({ interact: false }), eq);
      }

      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
    });

    it('does not re-enter ShopBrowse when already in ShopBrowse', () => {
      const world = new World();
      const eq = new EventQueue();
      createPlayer(world, true);
      const shopId = createShopEntity(world, [makeHealthItem(30, 30)]);
      setGameplayState();

      shopSystem(world, makeInput({ interact: true }), eq);
      expect(useAppStore.getState().currentState).toBe(AppState.ShopBrowse);
      expect(useAppStore.getState().activeShopEntityId).toBe(shopId);

      // Second interact should not re-trigger
      const shop2Id = createShopEntity(world, [makeHealthItem(20, 20)]);
      shopSystem(world, makeInput({ interact: true }), eq);

      // Should still be browsing the first shop
      expect(useAppStore.getState().currentState).toBe(AppState.ShopBrowse);
      expect(useAppStore.getState().activeShopEntityId).toBe(shopId);
      expect(useAppStore.getState().activeShopEntityId).not.toBe(shop2Id);
    });

    it('selects exactly one shop when two are in range', () => {
      const world = new World();
      const eq = new EventQueue();
      createPlayer(world, true);
      const shop1 = createShopEntity(world, [makeHealthItem(30, 30)], { x: 1, y: 0, z: 1 });
      createShopEntity(world, [makeHealthItem(20, 20)], { x: 2, y: 0, z: 2 });
      setGameplayState();

      shopSystem(world, makeInput({ interact: true }), eq);

      expect(useAppStore.getState().currentState).toBe(AppState.ShopBrowse);
      // First shop selected (deterministic)
      expect(useAppStore.getState().activeShopEntityId).toBe(shop1);
    });

    it('emits audio event when opening shop', () => {
      const world = new World();
      const eq = new EventQueue();
      createPlayer(world, true);
      createShopEntity(world, [makeHealthItem(30, 30)]);
      setGameplayState();

      shopSystem(world, makeInput({ interact: true }), eq);

      const audio = getAudioEvents(eq);
      expect(audio).toHaveLength(1);
      expect(audio[0].sound).toBe(SoundId.MenuClick);
    });

    it('handles shop with empty inventory', () => {
      const world = new World();
      const eq = new EventQueue();
      createPlayer(world, true);
      createShopEntity(world, []);
      setGameplayState();

      expect(() => shopSystem(world, makeInput({ interact: true }), eq)).not.toThrow();
      expect(useAppStore.getState().currentState).toBe(AppState.ShopBrowse);
    });

    it('closes shop when shop entity is destroyed while browsing', () => {
      const world = new World();
      const eq = new EventQueue();
      createPlayer(world, true);
      const shopId = createShopEntity(world, [makeHealthItem(30, 30)]);
      setGameplayState();

      shopSystem(world, makeInput({ interact: true }), eq);
      expect(useAppStore.getState().currentState).toBe(AppState.ShopBrowse);

      world.destroyEntity(shopId);
      shopSystem(world, makeInput(), eq);

      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
      expect(useAppStore.getState().activeShopEntityId).toBeNull();
    });
  });

  describe('purchasing', () => {
    it('succeeds with sufficient currency', () => {
      const world = new World();
      const eq = new EventQueue();
      const playerId = createPlayer(world, true, 50, 70, 100);
      const shopId = createShopEntity(world, [makeHealthItem(30, 30)]);
      setGameplayState();

      shopSystem(world, makeInput({ interact: true }), eq);
      getAudioEvents(eq); // consume shop open audio

      const result = purchaseShopItem(world, eq, 0);

      expect(result).toBe(true);
      const player = world.getComponent<Player>(playerId, 'Player')!;
      expect(player.currency).toBe(20);

      const health = world.getComponent<Health>(playerId, 'Health')!;
      expect(health.current).toBe(100); // 70 + 30 clamped to 100

      const shop = world.getComponent<Shop>(shopId, 'Shop')!;
      expect(shop.inventory[0].sold).toBe(true);

      const audio = getAudioEvents(eq);
      expect(audio).toHaveLength(1);
      expect(audio[0].sound).toBe(SoundId.CurrencyPickup);
    });

    it('succeeds with exact currency (boundary)', () => {
      const world = new World();
      const eq = new EventQueue();
      const playerId = createPlayer(world, true, 30, 70, 100);
      createShopEntity(world, [makeHealthItem(30, 30)]);
      setGameplayState();

      shopSystem(world, makeInput({ interact: true }), eq);
      getAudioEvents(eq);

      const result = purchaseShopItem(world, eq, 0);

      expect(result).toBe(true);
      const player = world.getComponent<Player>(playerId, 'Player')!;
      expect(player.currency).toBe(0);
    });

    it('fails with insufficient currency', () => {
      const world = new World();
      const eq = new EventQueue();
      const playerId = createPlayer(world, true, 29, 70, 100);
      const shopId = createShopEntity(world, [makeHealthItem(30, 30)]);
      setGameplayState();

      shopSystem(world, makeInput({ interact: true }), eq);
      getAudioEvents(eq);

      const result = purchaseShopItem(world, eq, 0);

      expect(result).toBe(false);
      const player = world.getComponent<Player>(playerId, 'Player')!;
      expect(player.currency).toBe(29);

      const health = world.getComponent<Health>(playerId, 'Health')!;
      expect(health.current).toBe(70);

      const shop = world.getComponent<Shop>(shopId, 'Shop')!;
      expect(shop.inventory[0].sold).toBe(false);

      expect(getAudioEvents(eq)).toHaveLength(0);
    });

    it('fails for already-sold item', () => {
      const world = new World();
      const eq = new EventQueue();
      const playerId = createPlayer(world, true, 100, 70, 100);
      createShopEntity(world, [makeHealthItem(30, 30, true)]);
      setGameplayState();

      shopSystem(world, makeInput({ interact: true }), eq);
      getAudioEvents(eq);

      const result = purchaseShopItem(world, eq, 0);

      expect(result).toBe(false);
      const player = world.getComponent<Player>(playerId, 'Player')!;
      expect(player.currency).toBe(100);
    });

    it('prevents double purchase of the same item', () => {
      const world = new World();
      const eq = new EventQueue();
      const playerId = createPlayer(world, true, 60, 70, 100);
      createShopEntity(world, [makeHealthItem(30, 30)]);
      setGameplayState();

      shopSystem(world, makeInput({ interact: true }), eq);
      getAudioEvents(eq);

      expect(purchaseShopItem(world, eq, 0)).toBe(true);
      getAudioEvents(eq);

      expect(purchaseShopItem(world, eq, 0)).toBe(false);

      const player = world.getComponent<Player>(playerId, 'Player')!;
      expect(player.currency).toBe(30);
    });

    it('handles multiple items in shop inventory', () => {
      const world = new World();
      const eq = new EventQueue();
      const playerId = createPlayer(world, true, 90, 10, 100);
      const shopId = createShopEntity(world, [
        makeHealthItem(30, 30),
        makeHealthItem(30, 30),
        makeHealthItem(30, 30),
      ]);
      setGameplayState();

      shopSystem(world, makeInput({ interact: true }), eq);
      getAudioEvents(eq);

      expect(purchaseShopItem(world, eq, 0)).toBe(true);
      getAudioEvents(eq);
      expect(purchaseShopItem(world, eq, 1)).toBe(true);
      getAudioEvents(eq);
      expect(purchaseShopItem(world, eq, 2)).toBe(true);

      const player = world.getComponent<Player>(playerId, 'Player')!;
      expect(player.currency).toBe(0);

      const shop = world.getComponent<Shop>(shopId, 'Shop')!;
      expect(shop.inventory.every((i) => i.sold)).toBe(true);

      const health = world.getComponent<Health>(playerId, 'Health')!;
      expect(health.current).toBe(100); // clamped
    });

    it('clamps heal to max health', () => {
      const world = new World();
      const eq = new EventQueue();
      const playerId = createPlayer(world, true, 50, 90, 100);
      createShopEntity(world, [makeHealthItem(30, 30)]);
      setGameplayState();

      shopSystem(world, makeInput({ interact: true }), eq);
      getAudioEvents(eq);

      purchaseShopItem(world, eq, 0);

      const health = world.getComponent<Health>(playerId, 'Health')!;
      expect(health.current).toBe(100); // 90 + 30 clamped to 100
    });

    it('allows purchase when player health is already full', () => {
      const world = new World();
      const eq = new EventQueue();
      const playerId = createPlayer(world, true, 50, 100, 100);
      createShopEntity(world, [makeHealthItem(30, 30)]);
      setGameplayState();

      shopSystem(world, makeInput({ interact: true }), eq);
      getAudioEvents(eq);

      const result = purchaseShopItem(world, eq, 0);

      expect(result).toBe(true);
      const player = world.getComponent<Player>(playerId, 'Player')!;
      expect(player.currency).toBe(20);

      const health = world.getComponent<Health>(playerId, 'Health')!;
      expect(health.current).toBe(100);
    });

    it('allows purchasing zero-price item with zero currency', () => {
      const world = new World();
      const eq = new EventQueue();
      const playerId = createPlayer(world, true, 0, 70, 100);
      createShopEntity(world, [makeHealthItem(0, 30)]);
      setGameplayState();

      shopSystem(world, makeInput({ interact: true }), eq);
      getAudioEvents(eq);

      const result = purchaseShopItem(world, eq, 0);

      expect(result).toBe(true);
      const player = world.getComponent<Player>(playerId, 'Player')!;
      expect(player.currency).toBe(0);

      const health = world.getComponent<Health>(playerId, 'Health')!;
      expect(health.current).toBe(100);
    });

    it('fails for invalid item index', () => {
      const world = new World();
      const eq = new EventQueue();
      createPlayer(world, true, 100, 70, 100);
      createShopEntity(world, [makeHealthItem(30, 30)]);
      setGameplayState();

      shopSystem(world, makeInput({ interact: true }), eq);
      getAudioEvents(eq);

      expect(purchaseShopItem(world, eq, -1)).toBe(false);
      expect(purchaseShopItem(world, eq, 1)).toBe(false);
      expect(purchaseShopItem(world, eq, 999)).toBe(false);
    });

    it('fails when not in ShopBrowse state', () => {
      const world = new World();
      const eq = new EventQueue();
      createPlayer(world, true, 100, 70, 100);
      createShopEntity(world, [makeHealthItem(30, 30)]);
      setGameplayState();

      // Don't open shop, just try purchasing
      const result = purchaseShopItem(world, eq, 0);
      expect(result).toBe(false);
    });

    it('fails when shop entity no longer exists', () => {
      const world = new World();
      const eq = new EventQueue();
      createPlayer(world, true, 100, 70, 100);
      const shopId = createShopEntity(world, [makeHealthItem(30, 30)]);
      setGameplayState();

      shopSystem(world, makeInput({ interact: true }), eq);
      getAudioEvents(eq);

      world.destroyEntity(shopId);
      const result = purchaseShopItem(world, eq, 0);
      expect(result).toBe(false);
    });

    it('currency never goes negative from a purchase', () => {
      const world = new World();
      const eq = new EventQueue();
      const playerId = createPlayer(world, true, 10, 70, 100);
      createShopEntity(world, [makeHealthItem(30, 30)]);
      setGameplayState();

      shopSystem(world, makeInput({ interact: true }), eq);
      getAudioEvents(eq);

      purchaseShopItem(world, eq, 0);

      const player = world.getComponent<Player>(playerId, 'Player')!;
      expect(player.currency).toBeGreaterThanOrEqual(0);
      expect(player.currency).toBe(10); // unchanged
    });
  });

  describe('property-based', () => {
    it('currency never goes negative after any number of purchase attempts', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }),
          fc.integer({ min: 0, max: 500 }),
          fc.integer({ min: 1, max: 10 }),
          (currency, price, attempts) => {
            useAppStore.setState({
              currentState: AppState.Loading,
              previousState: null,
              activeShopEntityId: null,
            });

            const world = new World();
            const eq = new EventQueue();
            const playerId = createPlayer(world, true, currency, 50, 100);
            createShopEntity(world, [makeHealthItem(price, 30)]);
            setGameplayState();

            shopSystem(world, makeInput({ interact: true }), eq);
            getAudioEvents(eq);

            for (let i = 0; i < attempts; i++) {
              purchaseShopItem(world, eq, 0);
              getAudioEvents(eq);
            }

            const player = world.getComponent<Player>(playerId, 'Player')!;
            expect(player.currency).toBeGreaterThanOrEqual(0);
          },
        ),
      );
    });

    it('sold items can never be purchased again', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }),
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 1, max: 5 }),
          (currency, price, itemCount) => {
            useAppStore.setState({
              currentState: AppState.Loading,
              previousState: null,
              activeShopEntityId: null,
            });

            const world = new World();
            const eq = new EventQueue();
            createPlayer(world, true, currency, 50, 100);
            const items = Array.from({ length: itemCount }, () => makeHealthItem(price, 10));
            const shopId = createShopEntity(world, items);
            setGameplayState();

            shopSystem(world, makeInput({ interact: true }), eq);
            getAudioEvents(eq);

            // Buy all affordable items
            for (let i = 0; i < itemCount; i++) {
              purchaseShopItem(world, eq, i);
              getAudioEvents(eq);
            }

            // Try buying all again — none should succeed
            for (let i = 0; i < itemCount; i++) {
              const shop = world.getComponent<Shop>(shopId, 'Shop')!;
              if (shop.inventory[i].sold) {
                const result = purchaseShopItem(world, eq, i);
                expect(result).toBe(false);
              }
            }
          },
        ),
      );
    });

    it('health never exceeds max after purchase', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 200 }),
          fc.integer({ min: 1, max: 200 }),
          fc.integer({ min: 1, max: 100 }),
          (currentHealth, maxHealth, healAmount) => {
            const actualMax = Math.max(currentHealth, maxHealth);

            useAppStore.setState({
              currentState: AppState.Loading,
              previousState: null,
              activeShopEntityId: null,
            });

            const world = new World();
            const eq = new EventQueue();
            createPlayer(world, true, 1000, currentHealth, actualMax);
            createShopEntity(world, [makeHealthItem(0, healAmount)]);
            setGameplayState();

            shopSystem(world, makeInput({ interact: true }), eq);
            getAudioEvents(eq);

            purchaseShopItem(world, eq, 0);

            const players = world.query(['PlayerTag', 'Health']);
            const health = world.getComponent<Health>(players[0], 'Health')!;
            expect(health.current).toBeLessThanOrEqual(health.max);
          },
        ),
      );
    });

    it('neither proximity alone nor interact alone triggers shop', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.boolean(),
          (nearShop, interact) => {
            if (nearShop && interact) return; // skip the valid case

            useAppStore.setState({
              currentState: AppState.Loading,
              previousState: null,
              activeShopEntityId: null,
            });

            const world = new World();
            const eq = new EventQueue();
            createPlayer(world, nearShop);
            createShopEntity(world, [makeHealthItem(30, 30)]);
            setGameplayState();

            shopSystem(world, makeInput({ interact }), eq);

            expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
            expect(useAppStore.getState().activeShopEntityId).toBeNull();
          },
        ),
      );
    });
  });
});
