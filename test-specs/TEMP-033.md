# Test Spec: TEMP-033 — SpawnSystem

## Properties (must ALWAYS hold)
- When a SpawnZone has `activated === true` and `spawnedEnemies` is empty: enemies are created at random positions within the zone's rectangular bounds (center position +/- width/2, height/2). The number created equals `spawnZone.enemyCount`. Types are drawn from `spawnZone.enemyTypes`.
- Created enemy entity IDs are stored in `spawnZone.spawnedEnemies`.
- Spawning occurs exactly once per zone activation (only when `spawnedEnemies` is empty).
- Enemy stats (health, damage, speed) are scaled by depth using: `baseStat * (1 + depthMultiplier * (depth - 1))`.
- Mini-boss roll: with probability `miniBossChancePerRoom` (0.1), exactly one enemy in the zone is created with `isMini = true` and stats multiplied by `miniBossStatMultiplier` (2.5).
- Each frame for activated zones: if all entity IDs in `spawnedEnemies` refer to dead (health <= 0) or destroyed entities, set `cleared = true`.
- Zones that are not activated (`activated === false`) are never processed.
- A zone with `cleared === true` does not re-spawn enemies.

## Adversarial Test Cases

### Case: Basic spawn on activation
- **Setup:** Create a SpawnZone at position (10, 0, 10) with width=20, height=20, enemyTypes=[KnifeRusher, Shotgunner], enemyCount=5, activated=true, spawnedEnemies=[]. Run SpawnSystem at depth=1.
- **Why this matters:** Verifies the fundamental contract: enemies spawn when a zone activates.
- **Expected behavior:** Exactly 5 enemy entities created. Each enemy's position is within bounds (0 to 20 on X, 0 to 20 on Z). Each enemy's type is either KnifeRusher or Shotgunner. `spawnZone.spawnedEnemies` contains exactly 5 entity IDs.

### Case: No double-spawn on subsequent frames
- **Setup:** Create a SpawnZone with activated=true, spawnedEnemies=[]. Run SpawnSystem (enemies spawn, spawnedEnemies populated). Run SpawnSystem again on the next frame.
- **Why this matters:** The guard is `spawnedEnemies` being empty. After the first spawn, it is non-empty. A broken implementation might check only `activated` and spawn every frame.
- **Expected behavior:** No new enemies created on the second run. `spawnedEnemies` array unchanged. Total enemy count equals the original `enemyCount`.

### Case: Depth scaling at depth 1 (no scaling)
- **Setup:** Create a SpawnZone with enemyTypes=[KnifeRusher], enemyCount=1, activated=true. Run SpawnSystem at depth=1.
- **Why this matters:** At depth 1, the multiplier should be `1 + 0.15 * (1-1) = 1.0`. No scaling. Verifies the formula does not apply a bonus at depth 1.
- **Expected behavior:** KnifeRusher spawned with baseHealth=30, baseDamage=15, baseSpeed=6.0 (unscaled base values).

### Case: Depth scaling at depth 5
- **Setup:** Create a SpawnZone with enemyTypes=[KnifeRusher], enemyCount=1, activated=true. Run SpawnSystem at depth=5.
- **Why this matters:** At depth 5: health = 30 * (1 + 0.15 * 4) = 30 * 1.6 = 48. Damage = 15 * (1 + 0.10 * 4) = 15 * 1.4 = 21. Speed = 6.0 * (1 + 0.03 * 4) = 6.0 * 1.12 = 6.72. Verifies the depth formula is applied correctly per stat type.
- **Expected behavior:** Enemy health is 48, damage is 21, speed is 6.72 (or equivalents after rounding policy).

### Case: Mini-boss roll succeeds
- **Setup:** Create a SpawnZone with enemyTypes=[Rifleman], enemyCount=4, activated=true. Seed/mock the RNG so that the mini-boss roll returns a value < 0.1 (e.g., 0.05). Run SpawnSystem at depth=3.
- **Why this matters:** When the roll succeeds, exactly one enemy must have `isMini = true` with stats multiplied by `miniBossStatMultiplier` (2.5). Not zero, not two.
- **Expected behavior:** Exactly 1 of the 4 enemies has `isMini = true`. That enemy's stats are 2.5x the depth-scaled base stats. The other 3 have `isMini = false`.

### Case: Mini-boss roll fails
- **Setup:** Same as above but mock RNG to return 0.95 (above 0.1 threshold).
- **Why this matters:** When the roll fails, no mini-boss should be created.
- **Expected behavior:** All 4 enemies have `isMini = false`. No stats are inflated by the mini-boss multiplier.

### Case: Cleared flag when all enemies die
- **Setup:** Create a SpawnZone, activate it, let it spawn 3 enemies. Manually set all 3 enemies' health to 0 (or destroy them). Run SpawnSystem.
- **Why this matters:** This is the room-clear detection mechanism. If `cleared` is never set, downstream systems (like door unlocking) break.
- **Expected behavior:** `spawnZone.cleared === true`.

### Case: Cleared flag NOT set when some enemies alive
- **Setup:** Create a SpawnZone, spawn 3 enemies. Kill 2, leave 1 alive with health > 0. Run SpawnSystem.
- **Why this matters:** Partial kills must not trigger the cleared state. Even one surviving enemy means the room is not cleared.
- **Expected behavior:** `spawnZone.cleared === false`.

### Case: Cleared flag when enemies are destroyed (removed from world)
- **Setup:** Spawn 3 enemies. Destroy all 3 entities from the world (entity IDs no longer valid). Run SpawnSystem.
- **Why this matters:** DeathSystem destroys enemy entities after processing death. The spawnedEnemies array holds stale entity IDs. The system must recognize that a missing entity counts as dead, not alive.
- **Expected behavior:** `spawnZone.cleared === true`. No crash on querying destroyed entities.

### Case: Spawn positions within bounds
- **Setup:** Create a SpawnZone at position (50, 0, 50) with width=20, height=20. Activate and spawn 100 enemies (or repeat spawning with different seeds) to sample the position distribution.
- **Why this matters:** If the position calculation is wrong (e.g., using width instead of width/2 for offset), enemies spawn outside the room, possibly inside walls.
- **Expected behavior:** All enemy positions satisfy: `40 <= x <= 60` and `40 <= z <= 60`.

### Case: Zone with enemyCount = 0
- **Setup:** Create a SpawnZone with enemyCount=0, activated=true, spawnedEnemies=[].
- **Why this matters:** A template or generator bug could produce a zone with zero enemies. The system must handle this without crashing and should immediately set cleared=true since there are no enemies to kill.
- **Expected behavior:** No enemies spawned. `spawnedEnemies` remains empty. `cleared` is set to true (vacuously, all zero enemies are dead).

### Case: Single enemy type in enemyTypes
- **Setup:** Create a SpawnZone with enemyTypes=[SuicideBomber], enemyCount=5.
- **Why this matters:** Verifies that the type selection works when there is only one option and does not index out of bounds.
- **Expected behavior:** All 5 enemies are SuicideBombers.

### Case: Non-activated zone is ignored
- **Setup:** Create a SpawnZone with activated=false. Run SpawnSystem.
- **Why this matters:** Zones that the player has not entered must never spawn enemies prematurely.
- **Expected behavior:** No enemies created. No state changes on the zone.

## Edge Cases
- SpawnZone with very small bounds (width=1, height=1): all enemies cluster at nearly the same position. Should not crash or produce NaN positions.
- SpawnZone at the world origin (0, 0, 0): negative-offset positions should still be valid.
- Depth = 0: if depth is zero-indexed, the formula `(1 + multiplier * (0 - 1))` yields values less than 1.0 (nerfs stats). Verify whether depth starts at 1 or 0, and the formula handles it correctly.
- Very high depth (depth=100): stats should scale up smoothly without overflow. Health = 30 * (1 + 0.15 * 99) = 30 * 15.85 = 475.5. No integer truncation issues.
- SpawnZone that has already been cleared (`cleared = true`) and then somehow gets `activated` toggled again: must not re-spawn.

## Interaction Concerns
- **CollisionResponseSystem (step 9):** Sets `activated = true` on SpawnZone when player overlaps. SpawnSystem (step 21) reads this flag. The activation and spawning happen in the same frame. Verify there is no one-frame delay.
- **DeathSystem (step 23) vs SpawnSystem (step 21):** SpawnSystem runs before DeathSystem. If an enemy dies this frame (health set to 0 by DamageSystem at step 10), SpawnSystem checks `health <= 0` which is already set, so cleared detection should work even before DeathSystem destroys the entity. However, if SpawnSystem checks entity existence rather than health, it will see the entity as alive until DeathSystem destroys it next frame. Clarify which check is used.
- **FloorTransitionSystem (step 22):** Runs after SpawnSystem. If the player transitions floors in the same frame a zone activates, all spawned enemies will be immediately destroyed by the floor transition. This is acceptable but should not crash.
- **Mini-boss MeshId:** Mini-bosses use MeshId.MiniBossX variants. The createEnemy factory must select the correct mesh. SpawnSystem passes `isMini = true` to the factory; verify the factory handles this.
