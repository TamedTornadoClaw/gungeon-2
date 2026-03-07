# Test Spec: TEMP-026 — PickupSystem

## Properties (must ALWAYS hold)
- XP gems with `isFlying = true` move toward the player position every frame at `xpGemFlySpeed` (15.0 units/s).
- When an XP gem contacts the player, XP is added to the gun entity referenced by `sourceGunEntityId`. If that entity no longer exists, XP falls back to the gun currently occupying the same slot (matched by the original gun's `category`). XP is never silently discarded.
- After XP collection, the gem entity is destroyed and `AudioEvent(XPGemPickup)` is emitted.
- Health, Currency, and GunPickup require BOTH `nearPickup` flag (set by CollisionResponseSystem) AND `input.interact === true` to collect. Neither condition alone triggers collection.
- Healing is clamped: `health.current = min(health.current + healAmount, health.max)`. Health never exceeds max.
- Currency collection adds `amount` to `player.currency`. Currency has no cap.
- Gun pickup collection transitions game state to `GunComparison` with the pickup gun entity's data.
- Each pickup is destroyed exactly once upon collection. A pickup cannot be collected twice in the same frame.
- Appropriate AudioEvents are emitted for each pickup type: `XPGemPickup`, `HealthPickup`, `CurrencyPickup`.

## Adversarial Test Cases

### Case: XP gem flies toward player and is collected
- **Setup:** Create a player at position (0, 0, 0). Create an XP gem at position (10, 0, 0) with `isFlying = true`, `sourceGunEntityId` pointing to the player's sidearm gun entity, and `amount = 25`.
- **Why this matters:** The fundamental happy path. If this breaks, the entire XP economy is dead.
- **Expected behavior:** Each tick, the gem's position moves closer to (0,0,0) at a rate of 15.0 units/s. When the gem reaches the player, the sidearm gun's `xp` increases by 25, the gem entity is destroyed, and `AudioEvent(XPGemPickup)` is emitted.

### Case: XP gem source gun was destroyed (gun swapped out)
- **Setup:** Player has Pistol (Sidearm) with entity ID 42. Kill an enemy; XP gem spawns with `sourceGunEntityId = 42`. Before collection, player picks up a new Sidearm (SMG is wrong category -- use another Pistol or any Sidearm-category gun), replacing entity 42. The new sidearm entity is ID 99. Gem still references entity 42 which no longer exists.
- **Why this matters:** The fallback logic is the most dangerous edge case in the XP pipeline. If misimplemented, XP vanishes or crashes with a dangling entity reference.
- **Expected behavior:** On gem contact, system detects entity 42 does not exist. It looks up the original gun's category (`Sidearm`). It finds the gun currently in `player.sidearmSlot` (entity 99). XP is added to entity 99. Gem is destroyed. No crash, no lost XP.

### Case: XP gem source gun destroyed AND same-slot gun is also gone
- **Setup:** Player swaps sidearm, then somehow the sidearm slot is empty or references an invalid entity (edge case: could happen if both guns are swapped in rapid sequence during a floor transition). Gem with `sourceGunEntityId` pointing to a destroyed entity arrives.
- **Why this matters:** A double-fallback scenario. If the system only checks one level of fallback, it could crash or silently drop XP.
- **Expected behavior:** The system must handle this gracefully. At minimum, it should not crash. The spec says "fall back to the gun currently in the same slot" -- if that slot has a valid gun, XP goes there. If the slot entity itself is invalid, define behavior: either skip collection (gem persists) or add to any valid gun. No crash under any circumstance.

### Case: XP gem with isFlying = false does NOT move
- **Setup:** Create an XP gem at (5, 0, 0) with `isFlying = false`. Player stands at (0, 0, 0). Run several ticks.
- **Why this matters:** Gems should only fly after entering collection range (when CollisionResponseSystem sets `isFlying = true`). If the system moves all gems regardless, gems would home in from across the map.
- **Expected behavior:** The gem remains stationary at (5, 0, 0). No movement, no collection.

### Case: Health pickup requires interact and near flag
- **Setup:** Create a health pickup near the player (nearPickup flag set by CollisionResponse). Player health is 70/100, healAmount is 30. Do NOT press interact.
- **Why this matters:** Without the interact gate, players would vacuum up health pickups involuntarily, removing tactical choice.
- **Expected behavior:** No healing occurs. Pickup remains. Then press interact: health becomes 100/100, pickup destroyed, `AudioEvent(HealthPickup)` emitted.

### Case: Health pickup clamps to max health
- **Setup:** Player health is 95/100. Health pickup has `healAmount = 30`. Player is near and presses interact.
- **Why this matters:** Without clamping, health could exceed max, breaking the health bar UI and downstream systems that assume `current <= max`.
- **Expected behavior:** `health.current` becomes 100, not 125. Pickup is still consumed and destroyed. Audio emitted.

### Case: Health pickup at full health
- **Setup:** Player health is 100/100. Health pickup with `healAmount = 30`. Player is near and presses interact.
- **Why this matters:** Should the pickup be consumed when healing provides zero benefit? The spec says "heal player by healAmount (clamped to max), destroy pickup" -- it does not gate on partial health. Verify this is intentional or if we should prevent wasteful consumption.
- **Expected behavior:** Per spec: pickup is consumed, health stays 100, pickup destroyed, audio emitted. The heal amount is effectively 0 but the pickup is still used.

### Case: Currency pickup adds to player currency
- **Setup:** Player has `currency = 15`. Currency pickup has `amount = 10`. Player is near and presses interact.
- **Why this matters:** Basic currency flow. If currency addition is broken, the shop system becomes useless.
- **Expected behavior:** `player.currency` becomes 25. Pickup destroyed. `AudioEvent(CurrencyPickup)` emitted.

### Case: Gun pickup triggers GunComparison state transition
- **Setup:** Create a GunPickup entity with a Shotgun `Gun` component on the ground. Player approaches (nearPickup flag set). Player presses interact.
- **Why this matters:** This is the gateway to the weapon swap flow. If the transition doesn't fire, players can never upgrade guns from drops.
- **Expected behavior:** Game state transitions to `GunComparison`. The Shotgun gun data is passed to the comparison UI. Pickup is NOT destroyed yet (the comparison screen handles accept/reject).

### Case: Multiple pickups in range, only one interact per frame
- **Setup:** Place a health pickup and a currency pickup both within interact range of the player. Player presses interact once.
- **Why this matters:** If the system iterates all pickups and collects them all on a single interact press, the player loses agency. The system should collect at most one per interact, or define a deterministic priority.
- **Expected behavior:** Define and enforce a deterministic pickup priority (e.g., process in entity ID order, or pickup type priority). Only one pickup is collected per interact press, OR document that all near pickups are collected simultaneously and ensure this is intentional.

### Case: XP gem collected on exact same frame isFlying is set to true
- **Setup:** XP gem spawns at the player's exact position. CollisionResponseSystem sets `isFlying = true`. On the same frame, PickupSystem runs.
- **Why this matters:** If the gem spawns on top of the player (e.g., enemy dies at point-blank range), the gem might need zero frames of flying. The system should handle immediate collection without requiring a minimum flight duration.
- **Expected behavior:** Gem is collected immediately (distance to player is 0 or within contact threshold). XP added, gem destroyed, audio emitted. No off-by-one-frame delay.

### Case: Interact not pressed prevents currency and health collection even when near
- **Setup:** Player stands on top of both a health pickup and a currency pickup. `nearPickup` flags are set. `input.interact = false`. Run 100 frames.
- **Why this matters:** Ensures the interact gate is strictly enforced and not bypassed by proximity alone over time.
- **Expected behavior:** After 100 frames, both pickups still exist. Player currency and health unchanged.

## Edge Cases
- XP gem with `amount = 0`: Should it still be collected and destroyed, or ignored? Verify no division-by-zero or meaningless audio spam.
- Negative healAmount on a health pickup (malformed data): Should clamp or reject. Health must never decrease from a "heal."
- XP gem flying toward player who is dodge-rolling at high speed: Gem must still converge. Verify fly speed (15.0) is sufficient relative to roll speed (12.0) to prevent gems orbiting the player indefinitely.
- Player dies (health <= 0) while XP gems are flying toward them: Gems should either stop flying or be cleaned up. Collecting XP on a dead player is nonsensical.
- GunPickup interact while already in GunComparison state: Should not trigger a second transition or corrupt the comparison data.

## Interaction Concerns
- **CollisionResponseSystem dependency:** PickupSystem relies on `nearPickup` and `isFlying` flags set by CollisionResponseSystem (runs at step 9). PickupSystem runs at step 14. If execution order is violated, flags may be stale or unset.
- **DeathSystem interaction:** DeathSystem (step 23) spawns XP gems. These gems will not be processed by PickupSystem until the next frame (PickupSystem already ran at step 14). Verify no off-by-one issues.
- **GunXPSystem downstream:** PickupSystem adds XP to guns. GunXPSystem (step 17) checks XP thresholds for forced upgrades. Since GunXPSystem runs after PickupSystem (step 14), the forced upgrade check happens in the same frame as XP collection. Verify this ordering is correct and that collecting multiple gems in one frame triggers the threshold check with the accumulated total.
- **GunComparison state transition:** When a GunPickup triggers `GunComparison`, other systems (movement, firing) should be paused. Verify the state transition prevents further pickup collection in the same frame.
