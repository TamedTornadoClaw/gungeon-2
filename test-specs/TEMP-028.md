# Test Spec: TEMP-028 — ShopSystem

## Properties (must ALWAYS hold)
- If player is near a shop (`nearShop` flag from CollisionResponseSystem) and `input.interact === true`: game state transitions to `ShopBrowse` and `activeShopEntityId` is stored in Zustand state.
- Neither proximity alone nor interact alone triggers the shop transition.
- Purchase is only allowed when `player.currency >= item.price` AND `item.sold === false`. Both conditions must hold.
- On valid purchase: currency is deducted by exactly `item.price`, the item effect is applied (v1: heal player), `item.sold` is set to `true`, and an AudioEvent is emitted.
- A sold item (`item.sold === true`) can never be purchased again.
- Currency can never go negative as a result of a purchase.
- v1 shops only sell health pickups. No other item types appear in shop inventory.

## Adversarial Test Cases

### Case: Normal shop interaction opens ShopBrowse
- **Setup:** Create a shop entity with inventory containing one health pickup (price: 30, healAmount: 30, sold: false). Player is near (`nearShop = true`). `input.interact = true`.
- **Why this matters:** The baseline path into the shop UI. If this fails, the shop is inaccessible.
- **Expected behavior:** Game state transitions to `ShopBrowse`. `activeShopEntityId` is set to the shop's entity ID in Zustand.

### Case: Interact without near flag does nothing
- **Setup:** Player is far from any shop. `nearShop = false`. `input.interact = true`.
- **Why this matters:** Prevents remote shop access. Without proximity check, players could open shops from anywhere.
- **Expected behavior:** No state transition. Game remains in `Playing` state.

### Case: Near shop but no interact does nothing
- **Setup:** Player is near a shop. `nearShop = true`. `input.interact = false`. Run 60 frames.
- **Why this matters:** Shop must require deliberate interaction, not auto-trigger on proximity.
- **Expected behavior:** No state transition after 60 frames. Game remains in `Playing` state.

### Case: Purchase with sufficient currency
- **Setup:** Player has `currency = 50`. Shop item: health pickup, price 30, healAmount 30, sold: false. Player health is 70/100. Player initiates purchase.
- **Why this matters:** The core purchase flow. If deduction or effect application is wrong, the shop economy breaks.
- **Expected behavior:** `player.currency` becomes 20. `player.health.current` becomes 100 (clamped to max). `item.sold` becomes `true`. AudioEvent emitted.

### Case: Purchase with exact currency (boundary)
- **Setup:** Player has `currency = 30`. Shop item: price 30. Player initiates purchase.
- **Why this matters:** Off-by-one boundary. A `>` check instead of `>=` would reject this valid purchase.
- **Expected behavior:** Purchase succeeds. `player.currency` becomes 0. Item effect applied. `item.sold = true`.

### Case: Purchase with insufficient currency
- **Setup:** Player has `currency = 29`. Shop item: price 30, sold: false. Player attempts purchase.
- **Why this matters:** Must prevent purchases the player cannot afford. If the check is wrong, currency goes negative.
- **Expected behavior:** Purchase denied. `player.currency` remains 29. `item.sold` remains `false`. No heal applied. No audio emitted.

### Case: Purchase already-sold item
- **Setup:** Player has `currency = 100`. Shop item: price 30, `sold = true`. Player attempts purchase.
- **Why this matters:** Classic double-purchase exploit. If `sold` flag is not checked, the player gets infinite heals for a one-time price.
- **Expected behavior:** Purchase denied. Currency unchanged. No heal applied.

### Case: Purchase sold item even with sufficient currency
- **Setup:** Player buys an item (currency 60, price 30, succeeds, currency now 30). Player attempts to buy the same item again.
- **Why this matters:** Sequential double-purchase in the same shop session. The `sold` flag must persist within the session.
- **Expected behavior:** Second purchase denied. `player.currency` remains 30.

### Case: Multiple items in shop inventory
- **Setup:** Shop has 3 health pickups in inventory: items at indices 0, 1, 2. All priced at 30, all `sold = false`. Player has currency 90. Player buys item 0, then item 1, then item 2.
- **Why this matters:** Ensures the system tracks `sold` per item, not globally. Also tests that purchasing one item does not affect the sold state of another.
- **Expected behavior:** After three purchases: currency = 0. All three items have `sold = true`. Player healed three times (clamped to max each time).

### Case: Shop interaction while already in ShopBrowse
- **Setup:** Player is in `ShopBrowse` state (already browsing a shop). Player presses interact again.
- **Why this matters:** If the system re-triggers the transition, it could reset the shop UI state or switch `activeShopEntityId` to a different shop, corrupting the session.
- **Expected behavior:** No additional state transition. The system should only transition FROM `Playing` TO `ShopBrowse`, not re-enter ShopBrowse while already in it.

### Case: Two shops in interact range
- **Setup:** Two shop entities are both within interaction range. `nearShop` flags set for both. Player presses interact.
- **Why this matters:** Ambiguity in which shop opens. `activeShopEntityId` must point to exactly one shop.
- **Expected behavior:** Exactly one shop is selected deterministically (nearest, lowest entity ID, or first in query). `activeShopEntityId` corresponds to that shop's entity ID. The other shop is not affected.

### Case: Shop heal clamps to max health
- **Setup:** Player health is 90/100. Shop item healAmount is 30. Player purchases.
- **Why this matters:** Same clamping requirement as PickupSystem health pickups. Heal must not exceed max.
- **Expected behavior:** `health.current` becomes 100, not 120. Currency deducted normally.

### Case: Purchase when player health is already full
- **Setup:** Player health 100/100. Shop sells health pickup, healAmount 30. Player has sufficient currency and purchases.
- **Why this matters:** Should the purchase be allowed when it provides zero benefit? The spec does not gate on partial health.
- **Expected behavior:** Per spec, purchase succeeds: currency deducted, item marked sold, heal applied (clamped to 100, net 0 healing). The system does not prevent "wasteful" purchases.

### Case: Shop with zero-price item
- **Setup:** Shop item with `price = 0`, `sold = false`. Player has `currency = 0`.
- **Why this matters:** Edge case: `0 >= 0` is true, so the item should be purchasable. If price validation incorrectly requires positive currency, free items break.
- **Expected behavior:** Purchase succeeds. Currency remains 0. Item effect applied. `item.sold = true`.

## Edge Cases
- Shop entity destroyed while player is in `ShopBrowse` state: UI references `activeShopEntityId` which no longer exists. Must handle gracefully (close shop UI, return to Playing state).
- Shop with empty inventory array: Opening the shop should show an empty browse screen, not crash.
- Negative currency from external modification (e.g., bug in another system): Purchase check `currency >= price` should still hold. Currency should never go negative, but if it does, purchases should be blocked.
- `activeShopEntityId` not cleared after leaving ShopBrowse: Stale ID could cause issues if the shop is later destroyed and the ID is reused.

## Interaction Concerns
- **CollisionResponseSystem (step 9) sets `nearShop` flag.** ShopSystem (step 16) reads it. Flag must be reset each frame before CollisionResponseSystem runs to avoid stale state.
- **PickupSystem (step 14) runs before ShopSystem (step 16).** If a health pickup and a shop are both in range and interact is pressed, PickupSystem processes first. The interact press may be "consumed" by collecting a pickup, meaning the shop never opens. Verify whether interact is a broadcast (all systems see it) or consumed-on-use.
- **State transition atomicity:** When transitioning to `ShopBrowse`, other gameplay systems (movement, combat) should be suspended. Verify that transitioning mid-frame does not cause downstream systems (GunXPSystem step 17, DeathSystem step 23) to run in an inconsistent state.
- **Zustand store update timing:** `activeShopEntityId` is stored in Zustand (React state). The ECS system writes to Zustand synchronously. Verify that the React UI reads the updated value on the next render cycle, not a stale value.
