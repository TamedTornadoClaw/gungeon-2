# Test Spec: TEMP-063 — Wire renderer to ECS and game loop

## Properties (must ALWAYS hold)
- Every entity with Position, PreviousPosition, and Renderable has its mesh transform set to `lerp(previousPosition, currentPosition, alpha)` each render frame.
- Alpha is computed as `accumulator / fixedTimestep` by the game loop and passed to the render system. Alpha is in the range [0, 1).
- InstancedMesh instance counts match the number of living entities of each type. Dead/destroyed entities do not occupy instance slots.
- Instance matrices are bulk-updated via typed arrays, not per-instance Three.js API calls.
- The render system never modifies ECS component data. It is read-only.
- Camera position tracks the player with smooth interpolation using `followSmoothing` from design params.
- Object pool is used for mesh acquisition/release. No Three.js object construction occurs in the per-frame render path.

## Scenarios

### Scenario: Position interpolation at alpha=0.5
- **Given:** An entity has PreviousPosition=(0, 0, 0) and Position=(10, 0, 0). Alpha=0.5.
- **When:** The render system runs.
- **Then:** The entity's mesh world position is (5, 0, 0).
- **Why:** Catches implementations that use Position directly without interpolation, causing visual stutter when render rate differs from sim rate.

### Scenario: Position interpolation at alpha=0 (just after sim step)
- **Given:** An entity has PreviousPosition=(0, 0, 0) and Position=(10, 0, 0). Alpha=0.
- **When:** The render system runs.
- **Then:** The entity's mesh world position is (0, 0, 0) — it shows PreviousPosition.
- **Why:** Alpha=0 means the sim just stepped. Rendering the current position would show the entity one frame ahead, causing jitter on the next render.

### Scenario: Position interpolation at alpha approaching 1
- **Given:** An entity has PreviousPosition=(0, 0, 0) and Position=(10, 0, 0). Alpha=0.99.
- **When:** The render system runs.
- **Then:** The entity's mesh world position is approximately (9.9, 0, 0).
- **Why:** Ensures interpolation covers the full range. An off-by-one in alpha computation (e.g., using alpha=1.0) would overshoot into the next uncomputed frame.

### Scenario: Frozen game produces static rendering
- **Given:** Game loop is frozen (paused state). PreviousPosition and Position are identical (no sim step ran). Alpha is constant (e.g., the last alpha before freeze).
- **When:** Multiple render frames fire.
- **Then:** All entity meshes remain at the same position. No visual movement occurs. The scene still renders (not a black screen).
- **Why:** If the renderer recomputes alpha from wall-clock time during freeze, entities will drift or teleport.

### Scenario: Instanced mesh count matches entity count
- **Given:** 5 KnifeRusher enemies exist. 3 are destroyed during a simulation step.
- **When:** The render system runs after the step.
- **Then:** The KnifeRusher InstancedMesh has instanceCount=2. The 3 destroyed instances are not rendered (no ghost meshes).
- **Why:** Stale instance counts render destroyed entities at their last position, creating ghost images.

### Scenario: New entity gets a mesh from the pool
- **Given:** A bullet entity is created by ProjectileSystem. The object pool has pre-allocated bullet meshes.
- **When:** The render system processes the new entity.
- **Then:** A mesh is acquired from the pool (not constructed via `new THREE.Mesh()`). The mesh is made visible and its transform is set from the entity's position.
- **Why:** Allocating Three.js objects per frame causes GC pressure and frame drops during combat.

### Scenario: Destroyed entity returns mesh to pool
- **Given:** A bullet entity is destroyed by LifetimeSystem or CollisionResponseSystem.
- **When:** The render system processes the destruction.
- **Then:** The mesh is returned to the pool (set invisible, transform zeroed). It is not disposed or removed from the scene graph.
- **Why:** Disposing meshes per frame causes GPU resource churn. Removing from scene graph forces re-addition later.

### Scenario: Rotation component applied to mesh
- **Given:** An entity has Rotation.y = PI/2 (facing right in top-down view).
- **When:** The render system runs.
- **Then:** The mesh's rotation.y matches the entity's Rotation.y.
- **Why:** If rotation is not synced, enemies and the player face the wrong direction, breaking visual feedback for aiming and shield facing.

### Scenario: Camera follows player with smoothing
- **Given:** Player is at position (50, 0, 50). Camera was previously at (0, distance*sin(angle), distance*cos(angle)). followSmoothing=0.1.
- **When:** One render frame executes.
- **Then:** Camera position moves 10% toward the target position (player.x, player.y + distance*sin(angle), player.z + distance*cos(angle)). Camera lookAt target is the player position.
- **Why:** Without smoothing, camera teleports to player — jarring during fast movement. Without lookAt, camera points at the wrong place after position update.

### Scenario: Multiple instanced mesh types updated independently
- **Given:** 10 player bullets (Bullet meshId), 5 enemy bullets (EnemyBullet meshId), 20 XP gems (XPGem meshId) exist.
- **When:** The render system runs.
- **Then:** Three separate InstancedMesh objects are updated with instance counts 10, 5, and 20 respectively. Each instance matrix reflects the interpolated position of its corresponding entity.
- **Why:** Mixing entity types into the wrong InstancedMesh renders bullets with gem geometry or vice versa.

### Scenario: Entity without Renderable component is not rendered
- **Given:** A SpawnZone entity exists with Position and Collider but no Renderable component.
- **When:** The render system runs.
- **Then:** No mesh is created or updated for this entity.
- **Why:** SpawnZones are invisible triggers. Rendering them reveals hidden game mechanics to the player.

### Scenario: Instance matrix includes scale from Renderable
- **Given:** A mini-boss entity has Renderable.scale = 2.5 (miniBossStatMultiplier). A normal enemy of the same type has Renderable.scale = 1.0.
- **When:** The render system updates instance matrices.
- **Then:** The mini-boss instance matrix encodes scale (2.5, 2.5, 2.5). The normal enemy instance matrix encodes scale (1.0, 1.0, 1.0).
- **Why:** If scale is ignored, mini-bosses look identical to regular enemies, removing the visual threat signal.

### Scenario: Player weapon mesh visibility tracks active slot
- **Given:** Player has activeSlot = Sidearm with gunType = Pistol.
- **When:** The render system runs.
- **Then:** The Pistol child mesh on the player is visible. The long arm child mesh is invisible.
- **Why:** Showing both weapons simultaneously looks broken. Showing the wrong weapon misleads the player about which gun is firing.

## Edge Cases
- An entity is created and destroyed within the same simulation step (e.g., a bullet that immediately hits a wall). The render system must not crash on the missing entity — it either never sees it or handles the missing gracefully.
- Pool exhaustion: if more entities of a type exist than the pool pre-allocated, the system must either grow the pool or log a warning — not crash or silently skip rendering.
- An entity's Renderable.visible is set to false (e.g., a door that has been opened). The mesh must be hidden but not returned to the pool — the entity still exists.
- PreviousPosition is uninitialized on the first frame of an entity's life (both PreviousPosition and Position are the same). Interpolation must not produce NaN or a wrong position.
- When the game transitions from Gameplay to Death/Victory (canvas unmounted), all pool meshes must be returned. Failure to do so leaks GPU memory across runs.

## Integration Warnings
- The render system must receive alpha from the game loop. If the game loop and render loop are decoupled (as specified), alpha must be computed and stored where the renderer can read it. A common bug is to hardcode alpha=1.0, which eliminates interpolation entirely.
- InstancedMesh.instanceMatrix.needsUpdate must be set to true after bulk writes. Forgetting this causes Three.js to render stale transforms.
- The render system must handle the case where the ECS world is destroyed (stop/transition to menu) while a render frame is in flight. Reading from a destroyed world causes null reference errors.
- Screen effects (shake, flash, vignette) are tested in TEMP-066. This spec focuses on mesh transform sync and instancing only.
