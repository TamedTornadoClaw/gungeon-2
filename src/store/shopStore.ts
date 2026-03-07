import { create } from 'zustand';
import type { PickupType } from '../ecs/components';
import type { World } from '../ecs/world';
import type { EventQueue } from '../gameloop/events';
import { purchaseShopItem } from '../systems/shopSystem';

export interface ShopItemData {
  type: PickupType;
  price: number;
  healAmount?: number;
  sold: boolean;
}

export interface ShopStore {
  items: ShopItemData[];
  worldRef: World | null;
  eventQueueRef: EventQueue | null;

  openShop: (items: ShopItemData[], world: World, eventQueue: EventQueue) => void;
  purchase: (index: number, playerCurrency: number) => boolean;
  closeShop: () => void;
}

export const useShopStore = create<ShopStore>()((set, get) => ({
  items: [],
  worldRef: null,
  eventQueueRef: null,

  openShop: (items, world, eventQueue) =>
    set({ items: items.map((i) => ({ ...i })), worldRef: world, eventQueueRef: eventQueue }),

  purchase: (index, playerCurrency) => {
    const { items, worldRef, eventQueueRef } = get();
    if (!worldRef || !eventQueueRef) return false;

    const item = items[index];
    if (!item || item.sold || playerCurrency < item.price) return false;

    const success = purchaseShopItem(worldRef, eventQueueRef, index);
    if (success) {
      const updated = items.map((it, i) => (i === index ? { ...it, sold: true } : it));
      set({ items: updated });
    }
    return success;
  },

  closeShop: () => set({ items: [], worldRef: null, eventQueueRef: null }),
}));
