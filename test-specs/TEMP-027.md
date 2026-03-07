# Test Spec: TEMP-027 — ChestSystem

## Properties (must ALWAYS hold)
- A chest opens only when ALL three conditions are met simultaneously: player is near the chest (`nearChest` flag from CollisionResponseSystem), `input.interact === true`, and `chest.isOpen === false`.
- On open: `chest.isOpen` is set to `true`, a GunPickup entity is spawned at the chest's position with `gunType` matching `chest.gunType`, `AudioEvent(ChestOpen)` is emitted, and the chest mesh is updated to the open state.
- A chest that has `isOpen === true` can never be opened again, regardless of interact presses.
- Exactly one GunPickup is spawned per chest open event. Never zero, never more than one.
- The spawned GunPickup entity has a fully initialized `Gun` component with base stats from design params for the given `GunType`.

## Adversarial Test Cases

### Case: Normal chest open
- **Setup:** Create a chest at (5, 0, 5) with `gunType = GunType.Shotgun` and `isOpen = false`. Player is near (flag set). `input.interact = true`.
- **Why this matters:** The baseline happy path. If this fails, chests are entirely broken.
- **Expected behavior:** `chest.isOpen` becomes `true`. A GunPickup entity exists at (5, 0, 5) with a Shotgun gun component. `AudioEvent(ChestOpen)` emitted. Mesh updated.

### Case: Double-interact on same chest
- **Setup:** Open a chest (interact pressed, chest opens). On the next frame, interact is still held down (or pressed again). `nearChest` flag is still set.
- **Why this matters:** If `isOpen` is not checked, a second GunPickup would spawn, duplicating loot. This is a classic duplication exploit.
- **Expected behavior:** Second interact is ignored because `chest.isOpen === true`. No second GunPickup spawned. No second audio event. World has exactly one GunPickup from this chest.

### Case: Rapid interact spam over multiple frames
- **Setup:** Player stands near a closed chest and presses interact for 10 consecutive frames.
- **Why this matters:** Race condition variant. If the `isOpen` flag is checked before being set (read-then-write ordering bug), multiple frames could see `isOpen === false` and each spawn a pickup.
- **Expected behavior:** Exactly one GunPickup spawned. `isOpen` set to `true` on the first frame. Frames 2-10 see `isOpen === true` and do nothing.

### Case: Near chest but no interact
- **Setup:** Player stands near a closed chest. `nearChest = true`. `input.interact = false`. Run 60 frames.
- **Why this matters:** Chests must not auto-open. The interact press is a deliberate player action.
- **Expected behavior:** Chest remains closed. No GunPickup spawned. No audio emitted.

### Case: Interact pressed but player not near chest
- **Setup:** Player is far from any chest. `nearChest = false`. `input.interact = true`.
- **Why this matters:** Ensures proximity is enforced. Without this check, players could open chests from across the room.
- **Expected behavior:** No chest opens. No GunPickup spawned.

### Case: Multiple chests in range simultaneously
- **Setup:** Two closed chests are both within interact range of the player. `nearChest` flags set for both. Player presses interact once.
- **Why this matters:** Ambiguity in which chest opens. If the system iterates all chests, both might open on a single interact. The player should open at most one chest per interact, or the system must define deterministic behavior.
- **Expected behavior:** Either exactly one chest opens (nearest, or lowest entity ID -- define deterministic tie-breaking), OR both open if that is the intended design. Document and enforce whichever is chosen. Verify the correct number of GunPickups spawn.

### Case: Chest gunType covers all GunType enum values
- **Setup:** Create five chests, one for each `GunType`: Pistol, SMG, AssaultRifle, Shotgun, LMG. Open each.
- **Why this matters:** If the factory function `createGunPickup` does not handle a specific `GunType`, the spawn will fail or produce a malformed gun entity.
- **Expected behavior:** Each chest spawns a GunPickup with correct base stats for its type. All five GunType values produce valid Gun components with traits matching the design params config.

### Case: Chest at boundary position (0, 0, 0)
- **Setup:** Create a chest at the world origin. Open it.
- **Why this matters:** Zero-position edge case. The GunPickup spawn position must match the chest position exactly. If spawn uses uninitialized position data, it may default to (0,0,0) and appear correct by accident only at the origin.
- **Expected behavior:** GunPickup spawns at (0, 0, 0). Repeat test with a chest at (100, 0, -50) to verify the position is actually read from the chest entity, not defaulting.

### Case: Chest system runs but no chests exist in world
- **Setup:** World has a player entity but zero chest entities. Run ChestSystem.
- **Why this matters:** If the system does not guard against an empty query result, it could crash or produce undefined behavior on an empty iteration.
- **Expected behavior:** System completes with no side effects. No errors.

### Case: Chest opened while player is moving away
- **Setup:** Player is near chest and presses interact. On the SAME frame, player velocity is moving them away from the chest. The `nearChest` flag was set by CollisionResponseSystem earlier in the frame.
- **Why this matters:** Since CollisionResponseSystem (step 9) runs before ChestSystem (step 15), the flag reflects the state at collision detection time. By the time ChestSystem runs, the player may have moved. The flag should still be valid for this frame.
- **Expected behavior:** Chest opens normally. The `nearChest` flag from earlier in the frame is authoritative. Player position at ChestSystem execution time is irrelevant.

## Edge Cases
- Chest entity destroyed between CollisionResponseSystem setting `nearChest` and ChestSystem running: System must handle missing entities gracefully without crashing.
- `chest.gunType` set to an invalid or out-of-range enum value: Factory should reject or the system should validate before spawning.
- Chest with `isOpen` initialized to `true` at creation time: System should never spawn a pickup from it, even on first interact. Verify `isOpen` defaults to `false` in `createChest`.
- Two players near the same chest (not applicable in v1 single-player, but future-proofing): Only one GunPickup should spawn.

## Interaction Concerns
- **CollisionResponseSystem (step 9) sets `nearChest` flag.** ChestSystem (step 15) reads it. If the flag is not cleared each frame before CollisionResponseSystem runs, stale flags from the previous frame could cause phantom chest opens when the player is no longer near.
- **PickupSystem (step 14) runs BEFORE ChestSystem (step 15).** A GunPickup spawned by ChestSystem will not be processable by PickupSystem until the next frame. This is correct -- the player needs to interact with the chest first, then interact with the spawned GunPickup separately. Verify no design expectation of same-frame chest-open-and-gun-pickup.
- **AudioEventSystem (step 26) processes ChestOpen events emitted by ChestSystem.** No ordering concerns since AudioEventSystem runs last.
- **GunPickup entity composition:** The spawned entity must have `Position, Gun, Pickup, Collider, Renderable, PickupTag` per entity definitions. Missing any component will break downstream systems (CollisionResponseSystem won't detect it, PickupSystem won't process it).
