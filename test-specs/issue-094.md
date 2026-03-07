# Test Spec: TEMP-034 — FloorTransitionSystem

## Properties (must ALWAYS hold)
- When the player is near stairs (`nearStairs` flag from CollisionResponse) and `input.interact` is true: all entities except the player entity are destroyed, `depth.current` is incremented by 1, a new dungeon is generated for the new depth, entities from the new dungeon data are spawned into the world, and the player is placed at the new floor's start position.
- The player entity (and its associated gun entities) survives the transition with all state intact (health, currency, gun XP, trait levels, ammo counts).
- If `depth.current === bossFloorDepth` (10) after incrementing, a boss floor is generated containing a Boss entity instead of normal enemy spawn zones.
- Boss death triggers Victory state (handled by DeathSystem, not FloorTransitionSystem, but the boss must be correctly spawned with BossTag for this to work).
- The system does nothing if the player is not near stairs or interact is not pressed.
- The system does nothing if `nearStairs` flag is false, even if interact is pressed.

## Adversarial Test Cases

### Case: Basic floor transition
- **Setup:** Create a world with player, 10 enemies, 5 walls, 2 pickups, and stairs. Set `nearStairs = true` on the player. Set `input.interact = true`. `depth.current = 1`. Run FloorTransitionSystem.
- **Why this matters:** The fundamental contract. If this fails, the game has no progression.
- **Expected behavior:** All entities except the player destroyed. `depth.current === 2`. New dungeon entities exist in the world. Player position equals the new floor's start position.

### Case: Player state preservation across transition
- **Setup:** Set player health to 55/100, currency to 42. Sidearm gun has xp=300, traitLevels=[2,1,0], currentAmmo=5, isReloading=true, reloadTimer=0.7. Long arm gun has xp=150. Perform floor transition.
- **Why this matters:** If the implementation uses a naive "destroy all" approach that includes the player or its gun entities, player progress is wiped. This is a catastrophic bug.
- **Expected behavior:** After transition: player health still 55/100, currency still 42. Sidearm xp=300, traitLevels=[2,1,0], currentAmmo=5, isReloading=true, reloadTimer=0.7. Long arm xp=150. All values identical.

### Case: Gun entities survive transition
- **Setup:** Player has two gun entities (sidearm and long arm) referenced by `player.sidearmSlot` and `player.longArmSlot`. Perform transition.
- **Why this matters:** Gun entities are not "in the world" (no Position component) but are still entities in the ECS. A destroy-all sweep that iterates all entities could accidentally destroy guns. The player component holds EntityId references to them; if they are destroyed, those references become dangling pointers.
- **Expected behavior:** Both gun entity IDs still valid after transition. Gun components accessible and unchanged.

### Case: Not near stairs, interact pressed
- **Setup:** Player is NOT near stairs (`nearStairs = false`). `input.interact = true`. `depth.current = 3`.
- **Why this matters:** The interact input is shared across multiple systems (PickupSystem, ChestSystem, ShopSystem, FloorTransitionSystem). The system must only act when the `nearStairs` flag is set.
- **Expected behavior:** No entities destroyed. `depth.current` remains 3. No dungeon generated.

### Case: Near stairs, interact NOT pressed
- **Setup:** Player IS near stairs (`nearStairs = true`). `input.interact = false`.
- **Why this matters:** Walking near stairs should not auto-transition. The player must explicitly press interact.
- **Expected behavior:** No transition. World unchanged.

### Case: Transition to boss floor (depth 9 -> 10)
- **Setup:** `depth.current = 9`. Perform transition (so depth becomes 10, which equals `bossFloorDepth`).
- **Why this matters:** The boss floor is a special case. The dungeon generator must produce a boss room with a Boss entity bearing BossTag. If the depth check is off by one (e.g., checking before vs. after increment), the boss floor is skipped or appears on the wrong depth.
- **Expected behavior:** `depth.current === 10`. New dungeon contains at least one entity with BossTag. Boss entity has stats scaled by `bossStatMultiplier` (4.0). No normal SpawnZones on the boss floor (or spawn zones produce only the boss).

### Case: Transition past boss floor (depth 10 -> 11)
- **Setup:** `depth.current = 10`. The boss has already been killed (Victory not triggered because this tests transition only). Perform transition.
- **Why this matters:** The spec says boss killed triggers Victory (via DeathSystem). But what if the player somehow reaches the stairs on the boss floor without killing the boss (stairs should not exist on boss floor, but defensively test the case). Or if the game continues past depth 10.
- **Expected behavior:** Either the floor transition is prevented (no stairs on boss floor), or `depth.current === 11` and a non-boss floor is generated. The system must not crash or generate a second boss.

### Case: Transition at depth 1 (first transition)
- **Setup:** `depth.current = 1`. Perform transition.
- **Why this matters:** The first transition is the player's first experience of floor progression. Depth 2 should apply mild depth scaling to enemies.
- **Expected behavior:** `depth.current === 2`. Dungeon generated with depth-2 parameters. Enemy stats scaled by `(1 + multiplier * 1)`.

### Case: All entity types cleaned up
- **Setup:** Create a world with every entity type: walls, hazards, destructibles, doors, chests, shops, stairs, spawn zones, enemies, enemy projectiles, player projectiles, pickups (XP gems, health, currency, gun pickups), particles. Perform transition.
- **Why this matters:** If the destroy-all logic filters by tag or component, it could miss entity types. Leftover entities from the previous floor corrupt the new floor.
- **Expected behavior:** Only the player entity and its gun entities remain after cleanup. All other entity types are destroyed. The spatial hash is cleared of old colliders.

### Case: Rapid double-interact (two transitions in consecutive frames)
- **Setup:** Frame 1: nearStairs=true, interact=true. Transition occurs, new dungeon generated. Frame 2: The player happens to be placed near the new floor's stairs. nearStairs=true, interact=true again.
- **Why this matters:** If interact is held down and the player spawns near stairs on the new floor, they could immediately transition again, skipping an entire floor.
- **Expected behavior:** The system either (a) clears the `nearStairs` flag after transition so it must be re-set by CollisionResponseSystem on the next frame, or (b) the new floor's stairs are placed far from the player start, or (c) a second transition occurs (acceptable if by design). Document the expected behavior.

### Case: Transition with active DamageOverTime/SpeedModifier on player
- **Setup:** Player has DamageOverTime (from fire hazard) and SpeedModifier (from water hazard) components. Perform transition.
- **Why this matters:** These modifiers reference hazards that no longer exist after the transition. The `refreshed` flag will not be set (no hazards to refresh), so ExpireModifiersSystem should clean them up. But verify they do not cause errors between the transition and the cleanup.
- **Expected behavior:** Player survives transition with modifiers intact. On the next frame, ExpireModifiersSystem removes the un-refreshed modifiers. No crash or damage from non-existent hazards.

## Edge Cases
- Floor transition while player is mid-dodge-roll: dodge roll state (isRolling, rollTimer) should survive the transition. Player finishes the roll on the new floor.
- Floor transition while a gun is mid-reload: reload state should survive. The reload continues on the new floor.
- Player at exactly 1 health performing a transition: should not die during transition.
- Depth overflow: if depth reaches extremely high values (e.g., 1000), enemy stat scaling should not produce Infinity or NaN.
- Empty dungeon generation: if the generator produces zero rooms (bug), the system should not crash. Player should still be placed somewhere valid.

## Interaction Concerns
- **DeathSystem (step 23) and BossTag:** FloorTransitionSystem (step 22) spawns the boss. DeathSystem runs after it and checks for BossTag deaths. If the boss is spawned and immediately killed in the same frame (impossible under normal gameplay but theoretically possible if health is set to 0 at spawn), Victory must still trigger.
- **SpawnSystem (step 21) ordering:** SpawnSystem runs before FloorTransitionSystem. On the frame of transition, SpawnSystem may process spawn zones from the OLD floor. These spawned enemies will be immediately destroyed by the transition. This is wasteful but not incorrect.
- **Spatial hash reset:** After destroying all non-player entities, the spatial hash must be rebuilt with the new floor's static geometry (walls, hazards). If the hash is not cleared, old wall colliders persist as ghost walls on the new floor.
- **Event queue clearing:** Any pending events (DamageEvents, ParticleEvents, AudioEvents) from the old floor should be discarded or harmlessly processed. Events referencing destroyed entities must not crash downstream systems (ParticleSystem, AudioEventSystem at steps 25-26).
- **Dungeon generator dependency (TEMP-037):** FloorTransitionSystem calls the dungeon generator. The generator must accept a depth parameter and return valid DungeonData. If the generator is not yet implemented, this system cannot be fully integration-tested.
