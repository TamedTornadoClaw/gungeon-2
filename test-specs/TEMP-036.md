# Test Spec: TEMP-036 — Room Templates

## Properties (must ALWAYS hold)
- At least 5 distinct room templates are defined.
- Every template's dimensions fall within `roomMinSize` (20) and `roomMaxSize` (50) inclusive, for both width and height.
- Every template includes at least one spawn zone definition (enemies must be spawnable in every room).
- Spawn zone bounds are fully contained within the room bounds (no spawn positions outside the room walls).
- Templates are pure data structures with no runtime logic, side effects, or imports of game systems.
- Optional placements (hazards, destructibles, chests, shops) reference valid types from the enum definitions (HazardType, MeshId for destructibles, etc.).
- All position coordinates in a template are relative to the room's origin (0,0) so templates are relocatable by the dungeon generator.

## Adversarial Test Cases

### Case: Minimum of 5 templates exist
- **Setup:** Import the room templates module. Count the number of templates.
- **Why this matters:** The acceptance criteria explicitly require at least 5. Fewer templates means repetitive dungeon layouts and poor player experience.
- **Expected behavior:** Template count >= 5.

### Case: All dimensions within config bounds
- **Setup:** Iterate all templates. Check each template's width and height against roomMinSize (20) and roomMaxSize (50).
- **Why this matters:** Rooms smaller than 20 units are too cramped for twin-stick combat (player needs dodge roll space). Rooms larger than 50 units create empty dead zones. An off-by-one or typo in a template dimension breaks the dungeon layout when the generator stitches rooms together.
- **Expected behavior:** For every template: `20 <= width <= 50` and `20 <= height <= 50`.

### Case: Dimension at exact minimum (20x20)
- **Setup:** Verify at least one template with dimensions exactly 20x20 exists (or the smallest template is >= 20).
- **Why this matters:** Boundary test. A template at 19x20 violates the constraint. The test must catch templates that are one unit too small.
- **Expected behavior:** No template has width < 20 or height < 20.

### Case: Dimension at exact maximum (50x50)
- **Setup:** Verify no template exceeds 50 in either dimension.
- **Why this matters:** A 51-unit room could cause corridors to not connect properly or exceed the dungeon generator's grid allocation.
- **Expected behavior:** No template has width > 50 or height > 50.

### Case: Every template has at least one spawn zone
- **Setup:** Iterate all templates. Check that each has a non-empty spawn zone definition.
- **Why this matters:** A room with no spawn zone means no enemies can appear, breaking the core gameplay loop. The player walks through empty rooms.
- **Expected behavior:** Every template contains at least one spawn zone with a valid position, dimensions, enemyTypes, and enemyCount.

### Case: Spawn zone bounds within room bounds
- **Setup:** For each template, for each spawn zone, verify that the zone's rectangular area (position +/- width/2, height/2) is fully inside the room's rectangular area.
- **Why this matters:** If a spawn zone extends beyond the room walls, enemies spawn inside walls or in corridors, getting stuck or ambushing the player unfairly before they enter the room.
- **Expected behavior:** For every spawn zone in every template: `zone.x - zone.width/2 >= 0`, `zone.x + zone.width/2 <= room.width`, `zone.z - zone.height/2 >= 0`, `zone.z + zone.height/2 <= room.height` (assuming room origin at 0,0).

### Case: Spawn zone not overlapping wall positions
- **Setup:** For templates that define wall placements (internal walls or pillars), verify that no spawn zone overlaps with wall positions.
- **Why this matters:** Enemies spawned inside solid geometry are stuck and unreachable. The player cannot clear the room.
- **Expected behavior:** No spawn zone area intersects any wall or solid destructible placement area.

### Case: Hazard placements use valid HazardType values
- **Setup:** For each template that includes hazard placements, verify each hazard references a valid HazardType (Fire, Spikes, or Water).
- **Why this matters:** An invalid hazard type string or enum value causes a runtime crash when the entity factory tries to create the hazard.
- **Expected behavior:** Every hazard placement in every template uses one of: HazardType.Fire, HazardType.Spikes, HazardType.Water.

### Case: Destructible placements use valid types
- **Setup:** For each template with destructible placements, verify each references a valid destructible type (Crate, Pillar, or Barrel per the MeshId enum and config health values).
- **Why this matters:** An invalid destructible type leads to entities with undefined health or no mesh, causing rendering or gameplay errors.
- **Expected behavior:** Every destructible placement references a type with known health from design params (crateHealth=30, pillarHealth=60, barrelHealth=20).

### Case: Templates are varying sizes (not all identical)
- **Setup:** Collect all template dimensions. Check that at least 3 distinct (width, height) pairs exist.
- **Why this matters:** If all 5 templates are the same size (e.g., all 30x30), the dungeon feels monotonous despite having different internal layouts.
- **Expected behavior:** At least 3 distinct dimension combinations across all templates.

### Case: Positions are relative to room origin
- **Setup:** For each template, verify all spawn zone positions, hazard positions, destructible positions, chest positions, and shop positions have coordinates >= 0 and within the room's width/height.
- **Why this matters:** If positions are absolute world coordinates, templates cannot be relocated by the dungeon generator. A template designed at world position (100, 100) would place all its contents there regardless of where the room is actually placed.
- **Expected behavior:** All position coordinates satisfy: `0 <= x <= template.width` and `0 <= z <= template.height`.

### Case: No runtime logic in template definitions
- **Setup:** Inspect the template module's exports. Verify it exports only data (arrays/objects of template definitions) with no function calls, no RNG usage, no system imports.
- **Why this matters:** Templates must be deterministic data. If a template contains `Math.random()` calls or imports game systems, it violates the separation between data and logic, making templates untestable and non-reproducible.
- **Expected behavior:** Module exports are plain objects/arrays. No function definitions, no imports from `src/systems/`, no calls to `Math.random()`.

### Case: Chest and shop placements are optional
- **Setup:** Verify that some templates have chest placements and some do not. Verify that some templates have shop placements and some do not. Verify that templates without these placements are still valid.
- **Why this matters:** Per config, chests have a 25% chance per room and shops have a 50% chance per floor. Templates must support rooms with and without these features.
- **Expected behavior:** At least one template has no chest placement. At least one template has no shop placement. All templates validate successfully regardless of optional placement presence.

### Case: Template with maximum entity density
- **Setup:** Find the template with the most placements (spawn zones + hazards + destructibles + chests + shops). Verify all placements fit within the room without excessive overlap.
- **Why this matters:** A template with too many placements in a small room creates unplayable clutter. While some overlap is acceptable for hazards and cover, extreme density prevents player movement.
- **Expected behavior:** No specific numeric threshold, but total placement area should not exceed ~80% of room floor area as a sanity check.

## Edge Cases
- Template with exactly one spawn zone containing exactly `enemiesPerRoom.min` (3) enemies: the minimum viable room.
- Template with spawn zone covering nearly the entire room area: valid but enemies spread across the whole room.
- Non-square templates (e.g., 20x50 or 50x20): long corridors vs. wide arenas. Verify spawn zones still fit.
- Template with hazards adjacent to spawn zones: enemies spawn near fire/spikes. By design, enemies ignore hazards, but this is worth documenting.
- Template with a shop placement at room center: player must be able to reach the shop without being blocked by destructibles or hazards.

## Interaction Concerns
- **Dungeon generator (TEMP-037):** The generator consumes these templates to build floors. Templates must conform to whatever interface the generator expects. If the generator expects a specific TypeScript type (from TEMP-035 DungeonData types), templates must match that type.
- **Entity factories:** Template data is passed to `createWall`, `createHazard`, `createDestructible`, `createSpawnZone`, `createChest`, `createShop` factories. The template's data format must align with factory parameter expectations (position as Vec3, size as Vec2/Vec3, etc.).
- **Corridor connections:** The dungeon generator connects rooms via corridors of width 7 (from config). Templates must leave wall-free zones at connection points (typically room edges). If a template places walls or destructibles at every edge, corridors cannot connect. This constraint should be enforced or documented.
- **SpawnSystem (TEMP-033):** Spawn zones defined in templates become SpawnZone entities. The `enemyTypes` and `enemyCount` from the template feed directly into SpawnSystem. Templates must specify these fields or the dungeon generator must fill them in based on config (`enemiesPerRoom.min` to `enemiesPerRoom.max`).
- **Design params consistency:** If `roomMinSize` or `roomMaxSize` changes in config, all templates must be re-validated. Tests should read these values from config rather than hardcoding 20 and 50, to stay in sync.
