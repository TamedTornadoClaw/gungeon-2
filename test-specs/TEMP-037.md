# Test Spec: TEMP-037 — Dungeon Generator

## Properties (must ALWAYS hold)
- Exactly `roomsPerFloor` (8) rooms are generated per non-boss floor.
- No two rooms overlap (their bounding rectangles have zero intersection area).
- Every room is reachable from every other room via corridors (the room graph is fully connected).
- All corridors are exactly `corridorWidth` (7) units wide.
- Every room's width and height are within [`roomMinSize`, `roomMaxSize`] (20-50 units).
- Exactly one staircase entity is placed, and it is located inside the last room.
- Every room (except the stairs room on non-boss floors) has an enemy SpawnZone with `enemyCount` in [`enemiesPerRoom.min`, `enemiesPerRoom.max`] (3-8).
- Chest placement probability per room matches `chestChancePerRoom` (0.25) within statistical tolerance.
- Shop placement probability per floor matches `shopChancePerFloor` (0.5) within statistical tolerance.
- Boss floor (depth === `bossFloorDepth`, i.e. 10) generates a single boss room with a Boss entity and no normal enemy spawn zones.
- Chests contain a GunType selected uniformly from all 5 gun types.
- All placed entities (walls, doors, hazards, destructibles, chests, shops, stairs, spawn zones) have positions that fall within valid room or corridor bounds.
- Walls fully enclose every room and corridor — no gaps in the perimeter except at doorways.

## Adversarial Test Cases / Scenarios

### Scenario: Room overlap under tight packing
- **Given:** The generator must place 8 rooms of sizes 20-50 units in a finite area.
- **Why this matters:** Naive placement algorithms can silently allow overlapping rooms when the available area is constrained or the RNG produces large rooms in close proximity. Overlap causes z-fighting walls, doubled collision geometry, and broken pathfinding.
- **Expected behavior:** For 1000 generated floors, no floor contains any pair of rooms whose axis-aligned bounding rectangles intersect. Overlap check: `!(r1.right <= r2.left || r1.left >= r2.right || r1.bottom <= r2.top || r1.top >= r2.bottom)` must be false for all pairs.

### Scenario: Connectivity — isolated room cluster
- **Given:** 8 rooms generated with a fixed seed that produces a spatially separated cluster (e.g., 6 rooms on the left, 2 rooms far to the right).
- **Why this matters:** If the corridor algorithm connects nearest neighbors greedily, distant rooms can become unreachable islands. The player would be permanently stuck.
- **Expected behavior:** A flood-fill or union-find over the room adjacency graph (rooms connected by corridors) produces exactly one connected component containing all 8 rooms.

### Scenario: Corridor width compliance
- **Given:** Any generated corridor segment.
- **Why this matters:** Corridors narrower than 7 units block large enemy colliders and create impassable chokepoints. Corridors wider than 7 units waste space and violate the design contract.
- **Expected behavior:** Every corridor's cross-section (perpendicular to its direction of travel) measures exactly `corridorWidth` (7) units. Sample 100 corridors across 20 generated floors. Measure the walkable width between opposing wall entities.

### Scenario: Room dimensions at boundary values
- **Given:** Generator runs with seeds that exercise the minimum and maximum room sizes.
- **Why this matters:** Off-by-one errors in random range generation (e.g., using `<` instead of `<=` for maxSize) silently exclude boundary values or produce rooms of size 19 or 51.
- **Expected behavior:** Over 500 generated floors, at least one room has a dimension of exactly 20, and at least one room has a dimension of exactly 50 (or within 1 unit if integer snapping applies). No room has any dimension less than 20 or greater than 50.

### Scenario: Stairs placement in final room only
- **Given:** A generated floor.
- **Why this matters:** If stairs appear in a non-final room, the player can skip content. If stairs are missing, the player is permanently stuck. If multiple stairs exist, behavior is undefined.
- **Expected behavior:** Exactly one Stairs entity exists in the DungeonData output. Its position is within the bounding rectangle of the last room in the room list. No other room contains a Stairs entity.

### Scenario: Boss floor overrides normal generation
- **Given:** `depth.current === bossFloorDepth` (10).
- **Why this matters:** If the boss floor still generates 8 rooms with normal spawn zones, the boss encounter is diluted. If it generates zero rooms, the floor is empty.
- **Expected behavior:** Exactly 1 room is generated. The room contains a Boss entity (created via `createBoss`). No SpawnZone components with normal enemy types exist. Stairs are placed in the boss room (for post-victory exit or are absent if victory transitions immediately).

### Scenario: SpawnZone enemy count respects config bounds
- **Given:** 100 generated floors.
- **Why this matters:** If `enemyCount` is generated outside [3, 8], rooms are either trivially easy or impossibly hard, breaking the difficulty curve.
- **Expected behavior:** Every SpawnZone has `enemyCount >= 3` and `enemyCount <= 8`. No SpawnZone violates these bounds across all sampled floors.

### Scenario: Chest GunType uniform distribution
- **Given:** 10,000 chests generated across many floors.
- **Why this matters:** If the random selection is biased (e.g., always picks index 0 due to `Math.floor` vs `Math.round` confusion), some gun types never appear in chests.
- **Expected behavior:** Each of the 5 GunType values appears in roughly 20% of chests. A chi-squared test with p > 0.01 passes, confirming no statistically significant bias.

### Scenario: Hazard and destructible placement within bounds
- **Given:** A generated floor with hazards and destructibles.
- **Why this matters:** Entities placed outside room/corridor bounds float in the void, are unreachable, or overlap walls.
- **Expected behavior:** Every hazard and destructible entity has a position that falls within the walkable area of a room or corridor (not inside a wall, not outside the dungeon boundary).

### Scenario: Deterministic output for same seed
- **Given:** The generator is called twice with the same seed and depth.
- **Why this matters:** Non-deterministic generation makes bugs unreproducible and prevents replay systems.
- **Expected behavior:** Both calls produce identical DungeonData (same room positions, same entity placements, same enemy types and counts).

### Scenario: Shop placement does not exceed one per floor
- **Given:** 200 generated floors.
- **Why this matters:** If the per-room chance is applied independently, multiple shops could appear on a single floor, flooding the player with healing and trivializing resource management.
- **Expected behavior:** At most 1 shop appears per floor. The `shopChancePerFloor` (0.5) governs whether a shop exists at all on the floor, not a per-room roll. Across 200 floors, roughly 100 have a shop and roughly 100 do not (within statistical tolerance).

## Edge Cases
- Floor generation with `roomsPerFloor = 1`: should still produce a valid floor with walls, spawn zone, and stairs in the single room.
- Maximum room size (50x50) for all 8 rooms: requires a large placement area; generator must not fail or infinite-loop.
- Depth 1 (first floor): no scaling applied, baseline enemy stats, no mini-boss guarantee.
- Depth 10 (boss floor) must not place chests, shops, or normal spawn zones.
- Corridor connecting two rooms that share an edge: corridor should not create a zero-length passage or duplicate walls.

## Interaction Concerns / Integration Warnings
- **SpawnSystem dependency:** SpawnZone `enemyTypes` array must contain valid EnemyType enum values. If the generator places an invalid type, SpawnSystem's `createEnemy` call will fail silently or throw.
- **Collision spatial hash:** Static walls generated here are inserted into the spatial hash once at load. If wall positions are not grid-aligned or overlap, the spatial hash may produce false collision results.
- **FloorTransitionSystem:** Relies on exactly one Stairs entity. Multiple stairs or zero stairs breaks floor progression entirely.
- **ChestSystem:** Expects `chest.gunType` to be a valid GunType. If the generator assigns an out-of-range value, `createGunPickup` will produce a broken entity.
- **DoorSystem:** If doors are placed at corridor-room junctions, their positions must align with wall gaps. Misaligned doors block or fail to block movement unpredictably.
