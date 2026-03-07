# Test Spec: TEMP-064 — Wire dungeon generator to entity creation

## Properties (must ALWAYS hold)
- Every wall segment in DungeonData produces exactly one entity with Position, Collider (isStatic=true, isTrigger=false), Renderable (meshId=Wall), and WallTag.
- Every hazard tile in DungeonData produces exactly one entity with Position, Hazard (correct HazardType), Collider (isStatic=true, isTrigger=true), Renderable (correct meshId), and HazardTag.
- Every room in DungeonData produces exactly one SpawnZone entity with Position, SpawnZone (activated=false, cleared=false, spawnedEnemies=[]), and Collider (isTrigger=true).
- All static colliders (walls, hazards) are inserted into the spatial hash at level load time, not deferred to per-frame insertion.
- Exactly one Stairs entity is created per floor.
- The player entity is placed at the dungeon's designated start position.
- No entity is created with missing required components for its archetype.

## Scenarios

### Scenario: Walls created from room boundaries
- **Given:** DungeonData contains a single 20x20 room.
- **When:** The dungeon-to-entity wiring runs.
- **Then:** Wall entities are created along the room perimeter. Each wall has Position matching the tile coordinate, Collider with isStatic=true and isTrigger=false, Renderable with meshId=Wall, and WallTag. The interior of the room has no wall entities.
- **Why:** Missing walls let the player walk out of bounds. Walls with isTrigger=true don't block movement. Walls inside the room block traversal.

### Scenario: Corridor walls connect rooms
- **Given:** DungeonData contains two rooms connected by a corridor of width 7.
- **When:** The dungeon-to-entity wiring runs.
- **Then:** Wall entities line both sides of the corridor. The corridor interior is passable (no wall entities). The corridor meets the rooms without gaps.
- **Why:** Gaps in corridor walls let the player escape into the void. Blocked corridors make rooms unreachable.

### Scenario: Fire hazard entity creation
- **Given:** DungeonData marks 3 tiles as Fire hazards within a room.
- **When:** The dungeon-to-entity wiring runs.
- **Then:** 3 entities are created, each with Position at the tile center, Hazard with hazardType=Fire, Collider (isStatic=true, isTrigger=true), Renderable with meshId=FireHazard, and HazardTag.
- **Why:** If the Collider is not a trigger, fire pushes the player away instead of applying DamageOverTime. If hazardType is wrong, CollisionResponseSystem applies the wrong effect.

### Scenario: Spike hazard entity creation
- **Given:** DungeonData marks tiles as Spike hazards.
- **When:** The dungeon-to-entity wiring runs.
- **Then:** Spike entities have Hazard with hazardType=Spikes, Collider (isStatic=true, isTrigger=true), Renderable with meshId=SpikeHazard.
- **Why:** Spikes deal instant damage on contact, not DamageOverTime. Wrong hazardType routes through the wrong damage path.

### Scenario: Water hazard entity creation
- **Given:** DungeonData marks tiles as Water hazards.
- **When:** The dungeon-to-entity wiring runs.
- **Then:** Water entities have Hazard with hazardType=Water, Collider (isStatic=true, isTrigger=true), Renderable with meshId=WaterHazard.
- **Why:** Water applies SpeedModifier, not damage. Wrong hazardType would damage the player instead of slowing them.

### Scenario: Destructible cover creation
- **Given:** DungeonData places a Crate destructible at position (15, 0, 20).
- **When:** The dungeon-to-entity wiring runs.
- **Then:** An entity is created with Position=(15, 0, 20), Destructible with health=30 (crateHealth from design params), Collider (isStatic=true, isTrigger=false), Renderable with meshId=Crate, and DestructibleTag.
- **Why:** If health does not come from design params, destructibles are either unkillable (health=Infinity) or instantly destroyed (health=0). If Collider is a trigger, enemies and bullets pass through cover.

### Scenario: Chest creation with gun type
- **Given:** DungeonData places a chest containing an AssaultRifle at position (30, 0, 10).
- **When:** The dungeon-to-entity wiring runs.
- **Then:** An entity is created with Position=(30, 0, 10), Chest (isOpen=false, gunType=AssaultRifle), Collider, Renderable with meshId=Chest, and ChestTag.
- **Why:** If isOpen defaults to true, the chest is already opened and the gun is inaccessible. If gunType is wrong, the player gets a different weapon than intended.

### Scenario: Shop creation with inventory
- **Given:** DungeonData places a shop.
- **When:** The dungeon-to-entity wiring runs.
- **Then:** An entity is created with Position, Shop (inventory contains health pickups priced at healthPickupPrice from design params, all with sold=false), Collider, Renderable with meshId=Shop, and ShopTag.
- **Why:** If items start as sold=true, the shop is empty. If prices don't match design params, the economy is broken.

### Scenario: Stairs placed at dungeon exit
- **Given:** DungeonData designates a room as the exit room with stairs position.
- **When:** The dungeon-to-entity wiring runs for depth 3.
- **Then:** Exactly one Stairs entity is created with Position at the designated location, Stairs (targetDepth=4), Collider (isTrigger=true), Renderable with meshId=Stairs, and StairsTag.
- **Why:** Zero stairs means the player is trapped. Multiple stairs is undefined behavior for FloorTransitionSystem. Non-trigger collider pushes the player away from the exit.

### Scenario: SpawnZone created per room with correct enemy types
- **Given:** DungeonData defines a room with enemy types [KnifeRusher, Shotgunner] and enemyCount=5.
- **When:** The dungeon-to-entity wiring runs.
- **Then:** A SpawnZone entity is created with Position at the room center, SpawnZone (width/height matching room dimensions, enemyTypes=[KnifeRusher, Shotgunner], enemyCount=5, activated=false, spawnedEnemies=[], cleared=false), and Collider (isTrigger=true).
- **Why:** If activated defaults to true, enemies spawn before the player enters the room. If enemyTypes is empty, no enemies spawn and the room is trivially cleared.

### Scenario: Player placed at dungeon start position
- **Given:** DungeonData designates position (5, 0, 5) as the player start.
- **When:** The dungeon-to-entity wiring runs.
- **Then:** The player entity's Position is set to (5, 0, 5). PreviousPosition is also set to (5, 0, 5) to prevent interpolation artifacts on the first frame.
- **Why:** If PreviousPosition is (0,0,0) and Position is (5,0,5), the player visually slides from origin to start on the first render frame.

### Scenario: Static colliders inserted into spatial hash at load time
- **Given:** DungeonData produces 150 wall entities and 10 hazard entities.
- **When:** The dungeon-to-entity wiring runs.
- **Then:** All 160 static colliders are inserted into the spatial hash grid. CollisionDetectionSystem does NOT re-insert them per frame.
- **Why:** Re-inserting 200 static entities per frame wastes budget. Not inserting them at all means no collision detection against walls.

### Scenario: Floor transition destroys old entities and creates new floor
- **Given:** The player is on depth 3 with 40 entities in the world (walls, enemies, pickups, etc.).
- **When:** FloorTransitionSystem triggers a floor transition to depth 4.
- **Then:** All entities except the player are destroyed. The spatial hash is cleared and rebuilt. DungeonData is generated for depth 4. All new entities are created from the new dungeon data. Player position is set to the new start position.
- **Why:** Leftover entities from the previous floor cause phantom collisions, duplicate enemies, and spatial hash corruption.

### Scenario: Boss floor at depth 10
- **Given:** The current depth is 9. The player interacts with stairs.
- **When:** FloorTransitionSystem triggers transition to depth 10 (bossFloorDepth).
- **Then:** The dungeon generates a boss floor. A Boss entity is created with BossTag, stats scaled by bossStatMultiplier (4.0x). Normal SpawnZones may still exist but the boss is the primary threat.
- **Why:** If bossFloorDepth check fails, the player never encounters the boss and cannot win the game.

### Scenario: Enemy stats scaled by depth
- **Given:** DungeonData for depth 5 includes a KnifeRusher enemy (base health 30, base damage 15, base speed 6.0).
- **When:** SpawnSystem creates the enemy.
- **Then:** Health = 30 * (1 + 0.15 * 5) = 52.5. Damage = 15 * (1 + 0.10 * 5) = 22.5. Speed = 6.0 * (1 + 0.03 * 5) = 6.9.
- **Why:** If depth scaling is not applied, later floors are trivially easy. If the formula is additive instead of multiplicative, stats grow too fast or too slow.

### Scenario: Door entities created between rooms
- **Given:** DungeonData places a door between two connected rooms.
- **When:** The dungeon-to-entity wiring runs.
- **Then:** A Door entity is created with Position, Door (isOpen=false), Collider (isStatic=true, isTrigger=false — blocks passage until opened), Renderable with meshId=Door, and DoorTag.
- **Why:** If the door starts open or has a trigger collider, it provides no gatekeeping. Rooms that should require clearing before progression are bypassed.

## Edge Cases
- DungeonData with zero rooms (degenerate generation). The wiring must not crash — it should produce at minimum the player and stairs.
- A room entirely filled with hazards. Walls must still surround the room. SpawnZone must still be created.
- Dungeon with overlapping rooms. Wall entities at shared boundaries must not duplicate (no two walls at the same position) or must be deduplicated.
- Chest chance rolls produce zero chests on a floor. This is valid — no chest entity is created.
- Shop chance rolls produce zero shops on a floor. This is valid.
- DungeonData corridors that are exactly corridorWidth wide (7 tiles). The corridor must be passable with walls on both sides.
- Floor tiles must cover the entire walkable area. Missing floor tiles create visual holes.

## Integration Warnings
- The spatial hash must be fully populated before the first simulation step runs. If the game loop starts before static colliders are inserted, the first frame has no wall collisions — the player and enemies fall through walls.
- Entity factory functions (createWall, createHazard, etc.) must read base stats from design params. Hardcoded values will diverge when design params are tuned.
- The wiring must handle the case where the dungeon generator produces more entities than the rendering pool expects (e.g., a large floor with 300+ walls). The pool must grow or the wiring must respect pool limits.
- PreviousPosition must be initialized to the same value as Position for all newly created entities. Uninitialized PreviousPosition (defaulting to 0,0,0) causes all entities to visually slide from the origin on the first render frame after level load.
