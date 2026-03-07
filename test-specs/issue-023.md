# Test Spec: TEMP-013 — CollisionDetectionSystem

## Properties (must ALWAYS hold)
- Every pair of entities whose AABBs overlap MUST appear in the output. Zero false negatives.
- No pair of entities whose AABBs do NOT overlap may appear in the output. Zero false positives.
- Each unique pair appears exactly once (no duplicates).
- Within each CollisionPair, `entityA.id < entityB.id` (deterministic ordering by EntityId).
- The output array order is deterministic: given the same entity set and positions, the same output array is produced.
- Trigger colliders produce pairs just like solid colliders (the distinction is for CollisionResponseSystem, not here).
- Static colliders are inserted once via `rebuildStatics()`, not every frame.
- Dynamic colliders are re-inserted every frame.
- overlapX and overlapY report the penetration depth on each axis (positive values indicating overlap magnitude).
- The system never modifies Position, Collider, or any other component. It is read-only.

## Adversarial Test Cases

### Case: Two AABBs exactly touching at edges (zero overlap)
- **Setup:** Entity A at `{x:0, y:0, z:0}` with collider width=2, height=2. Entity B at `{x:2, y:0, z:0}` with collider width=2, height=2. (A's right edge at x=1, B's left edge at x=1.)
- **Why this matters:** Off-by-one on the overlap test. Using `<=` vs `<` determines whether touching-but-not-overlapping boxes count as collisions. The AABB overlap condition should be strictly overlapping (not just touching), or the spec must define this. Touching edges with zero penetration are typically NOT collisions.
- **Expected behavior:** No CollisionPair produced (zero overlap is not a collision), OR if the design considers touching as collision, overlapX=0 and overlapY must still be correct. The implementation must pick one and be consistent.

### Case: Two entities in different spatial hash cells that still overlap
- **Setup:** Cell size is `2 * largest_dynamic_collider`. Entity A with a collider exactly at a cell boundary. Entity B in the adjacent cell, overlapping A by 0.01 units.
- **Why this matters:** The classic spatial hash bug: entities near cell boundaries are only checked against entities in their own cell, missing cross-cell overlaps. The implementation must check neighboring cells.
- **Expected behavior:** The pair (A, B) appears in the output with correct overlap values.

### Case: Entity spanning multiple spatial hash cells
- **Setup:** One very large collider (width=20, height=20) at the origin. Several small colliders (width=1, height=1) scattered across the area it covers.
- **Why this matters:** If the spatial hash only inserts an entity into the cell containing its center, large entities miss collisions with small entities in other cells. The entity must be inserted into ALL cells it overlaps.
- **Expected behavior:** Every small entity whose AABB overlaps the large entity produces a collision pair.

### Case: Deterministic ordering — higher ID entity is always entityB
- **Setup:** Entity 42 and Entity 7 overlap. Run the system.
- **Why this matters:** If the ordering is based on iteration order (e.g., hash map enumeration), it could be non-deterministic across runs or platforms. The contract requires lower EntityId first.
- **Expected behavior:** Pair has `entityA=7, entityB=42`.

### Case: Three mutually overlapping entities produce three pairs
- **Setup:** Entities A(id=1), B(id=2), C(id=3) all at position `{x:0, y:0, z:0}` with identical colliders.
- **Why this matters:** N-body pair generation is easy to get wrong. Common bugs: only finding the first pair per entity, or generating N pairs instead of N*(N-1)/2.
- **Expected behavior:** Exactly three pairs: (1,2), (1,3), (2,3). No duplicates. No missing pairs.

### Case: Static collider vs dynamic collider collision
- **Setup:** A wall (static collider, isStatic=true) at `{x:5, y:0, z:0}`. A player (dynamic) moves to overlap the wall.
- **Why this matters:** Static colliders are inserted once at level load. If the system forgets to check dynamic-vs-static pairs (only checking dynamic-vs-dynamic), wall collisions silently fail and entities walk through walls.
- **Expected behavior:** A collision pair is produced between the wall and the player.

### Case: Static-vs-static pairs are NOT produced
- **Setup:** Two overlapping static colliders (walls placed by level generation with overlapping geometry).
- **Why this matters:** Static-vs-static collision checks are wasted work and could produce phantom pairs that confuse CollisionResponseSystem. Two walls overlapping should not generate a push-out response.
- **Expected behavior:** No collision pair is produced for two static entities.

### Case: Trigger collider produces pairs
- **Setup:** A trigger collider (isTrigger=true, e.g., a hazard zone) overlapping a player entity.
- **Why this matters:** A developer might filter out trigger colliders thinking "triggers don't collide," but the contract says triggers produce pairs — it is CollisionResponseSystem that decides not to push them apart.
- **Expected behavior:** A collision pair with correct overlap values is produced.

### Case: Self-collision is never reported
- **Setup:** A single entity with Position and Collider.
- **Why this matters:** If the spatial hash checks an entity against all entities in its cell (including itself), it produces a self-collision pair. This is always a bug.
- **Expected behavior:** Zero collision pairs.

### Case: Entity removed between frames — stale reference in spatial hash
- **Setup:** Frame 1: entities A, B, C exist and are inserted into the hash. Before frame 2: entity B is destroyed. Frame 2: system runs.
- **Why this matters:** If the dynamic hash is not cleared and rebuilt each frame, destroyed entities remain as ghost entries, producing pairs with invalid entity IDs. This causes crashes or undefined behavior in CollisionResponseSystem.
- **Expected behavior:** No pairs reference entity B. Dynamic hash is rebuilt from scratch each frame.

### Case: Entity with zero-size collider
- **Setup:** Entity with collider width=0, height=0 at `{x:5, y:5, z:0}`. Another entity with a normal collider at the same position.
- **Why this matters:** A zero-size AABB is a degenerate case. Depending on the overlap formula, it might always or never collide. The system must handle this without NaN or division-by-zero.
- **Expected behavior:** Define the contract: either zero-size colliders never produce pairs (they have no area), or they collide only when exactly coincident. Document and test.

### Case: Hundreds of entities in a single cell
- **Setup:** 200 small dynamic entities all at position `{x:0, y:0, z:0}`.
- **Why this matters:** O(n^2) within a cell. With 200 entities, that is 19,900 pair checks in one cell. This tests that the system does not have a hard limit on entities per cell and does not degrade catastrophically. Also tests that the output array can hold 19,900 pairs.
- **Expected behavior:** Exactly 200*199/2 = 19,900 pairs produced. No crash, no truncation.

### Case: overlapX and overlapY are correctly computed
- **Setup:** Entity A at `{x:0, y:0, z:0}` with collider width=4, height=2. Entity B at `{x:3, y:1, z:0}` with collider width=4, height=2. (AABB A: [-2,2] x [-1,1], AABB B: [1,5] x [0,2]. Overlap on X: min(2,5)-max(-2,1) = 2-1 = 1. Overlap on Y: min(1,2)-max(-1,0) = 1-0 = 1.)
- **Why this matters:** CollisionResponseSystem uses overlapX/overlapY to determine push-out direction (axis of minimum overlap). Wrong values cause entities to be pushed out on the wrong axis — e.g., pushed vertically when they should be pushed horizontally.
- **Expected behavior:** overlapX=1, overlapY=1.

### Case: rebuildStatics is idempotent
- **Setup:** Call `rebuildStatics()` twice with the same static entities.
- **Why this matters:** If rebuildStatics appends rather than replaces, static entities appear twice in the hash, potentially causing duplicate collision pairs or double push-out.
- **Expected behavior:** Identical results whether called once or multiple times. No duplicate static entries.

## Edge Cases
- Zero entities: system returns empty array, does not throw.
- One entity: system returns empty array (nothing to collide with).
- All entities are static: no dynamic entities to check, return empty array (static-vs-static skipped).
- Entity at extreme coordinates (x=1e10): spatial hash cell index must not overflow integer bounds.
- Negative position values: spatial hash must handle negative cell indices correctly.
- Collider with depth dimension (3D): the system is described as AABB but the Collider has width/height/depth. Clarify whether collision is 2D (XZ plane for top-down) or 3D. The game is top-down, so likely X/Z with Y ignored for collision. This must be tested.

## Interaction Concerns
- MovementSystem runs immediately before this system. If MovementSystem has a bug and does not update positions, this system reports stale collisions.
- CollisionResponseSystem consumes the output. If pairs are missing, entities pass through walls. If pairs are duplicated, push-out is applied twice (double displacement).
- Static colliders are inserted at level load by the dungeon generation system. If `rebuildStatics()` is not called after level generation, no wall collisions are detected for the entire floor.
- The cell size (`2 * largest dynamic collider`) must be recomputed if a new entity type with a larger collider is introduced. A hardcoded cell size is a latent bug.
- Performance: the system is on the hot path (every frame). Allocating new arrays, objects, or closures inside the pair-check loop will cause GC pressure. Test that the system does not allocate in the hot loop (or at least keep allocations below a threshold).
