# Rendering

## Renderer Architecture

Three.js handles all rendering. The renderer is a single `WebGLRenderer` attached to a canvas element. The canvas is managed by React — mounted when entering gameplay-related states, unmounted when returning to menu states.

React owns the DOM. Three.js owns the canvas. They do not fight over rendering. The HUD is a React component positioned absolutely over the canvas.

## Camera

Isometric-style perspective camera looking down at the dungeon.

All camera parameters come from `config/design-params.json` (`camera` section): `fov`, `angle`, `distance`, `followSmoothing`.

- Camera follows the player with smooth interpolation (lerp using `followSmoothing`).
- Camera position is offset from player: `x = player.x`, `y = player.y + distance * sin(angle)`, `z = player.z + distance * cos(angle)`.
- Camera looks at player position.
- No rotation or zoom in v1 (stretch goal).

## Scene Graph Structure

```
Scene
├── AmbientLight
├── DirectionalLight (sun-like, casting shadows)
├── DungeonGroup
│   ├── FloorMeshes (instanced)
│   ├── WallMeshes (instanced)
│   ├── HazardMeshes (instanced per type)
│   ├── DoorMeshes
│   ├── ChestMeshes
│   ├── ShopMeshes
│   ├── StairsMeshes
│   └── DestructibleMeshes
├── EntityGroup
│   ├── PlayerMesh
│   ├── EnemyMeshes (instanced per type)
│   ├── BossMesh
│   ├── ProjectileMeshes (instanced, separate for player/enemy)
│   └── PickupMeshes (instanced per type)
├── EffectsGroup
│   ├── ParticleInstances (muzzle flash, blood, sparks, explosions)
│   ├── DamageNumberSprites
│   └── XPGemTrails
└── (ScreenFX applied via camera offset for shake)
```

## Visual Style

**Cell-shaded 3D with bold black outlines:**
- Geometry is simple blocky shapes — boxes, cylinders, low-poly forms.
- Materials use `MeshToonMaterial` (Three.js built-in toon shader) for the cell-shaded look.
- Black outlines via inverted-hull method: duplicate mesh, scale slightly larger, set material to black with `side: BackSide`. This creates a thick outline effect.
- Color palette: bold, saturated colors. Enemies are distinct colors per type for readability.

## Instanced Rendering

For entities with many instances (bullets, enemies, pickups, particles):
- Use `InstancedMesh` — one draw call for all instances of a type.
- Per-instance: position (via instance matrix), color (via instance color attribute).
- Update instance matrices each frame from ECS Position components.

This keeps draw calls manageable. Target: < 50 draw calls total.

## Rendering System

The rendering system runs on the variable timestep (requestAnimationFrame), NOT the fixed game loop. It interpolates positions between PreviousPosition and Position for smooth display.

```typescript
function renderSystem(
  world: World,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  alpha: number // interpolation factor between last and current sim state
): void;
```

**Responsibilities:**
1. Update camera position (follow player with smoothing).
2. For each renderable entity: set mesh position to `lerp(previousPosition, currentPosition, alpha)`.
3. Update instance matrices for instanced meshes.
4. Apply screen effects (camera shake offset, flash overlay opacity).
5. Call `renderer.render(scene, camera)`.

**Properties:**
- Render system reads state, never modifies it.
- If game is paused (frozen timestep), alpha stays constant — scene appears frozen but still renders.
- Rendering creates/destroys Three.js objects when entities are created/destroyed. Uses an object pool to avoid GC pressure.

## Object Pool

Three.js objects (meshes, materials, geometries) are pooled, not created/destroyed per frame.

- On entity creation: acquire mesh from pool, set visible.
- On entity destruction: return mesh to pool, set invisible.
- Pool is pre-allocated per entity type at level load based on expected max count.

## Screen Effects

All screen effect parameters come from `config/design-params.json` (`screenEffects` section).

### Screen Shake
- Camera position offset with exponential decay.
- `shakeIntensity` decays by `shakeDamping` (design param) per frame.
- Random XY offset per frame = `random(-1, 1) * shakeIntensity`.
- Triggered by: player damage (`playerHitIntensity`), explosions (`explosionIntensity`), big hits (`bigHitIntensity`).

### Hit Flash
- Full-screen white overlay with fast fade. Canvas overlay div with opacity animation.
- Duration and max opacity from design params (`hitFlash.duration`, `hitFlash.opacity`).
- Triggered by: critical hits, explosions.

### Damage Vignette
- Red vignette overlay when player health is low (below `damageVignette.healthThreshold` as fraction of max).
- Pulses at `damageVignette.pulseSpeed`. React component with CSS animation.

## Damage Numbers

All damage number parameters come from `config/design-params.json` (`damageNumbers` section).

- Floating text sprites that spawn at damage position, drift upward at `driftSpeed`, fade out over `lifetime` seconds.
- White for normal damage, yellow and scaled by `critScale` for critical hits.
- Use `SpriteMaterial` with dynamically generated canvas textures for the numbers.

## Player Weapon Rendering

Gun meshes are not ECS entities with Position/Renderable — they are child objects of the player mesh in the scene graph. The scene manager reads `Player.activeSlot` and the `Gun.gunType` of the active gun to determine which gun mesh child to make visible. On weapon swap, the scene manager hides the old gun mesh and shows the new one. This is a rendering concern, not an ECS concern.

## Crosshair

- CSS cursor replacement. A React component rendered as an overlay, following the mouse position.
- Simple crosshair design: circle + cross lines.
- Not rendered by Three.js — pure HTML/CSS overlay.

## Future Asset Loading

v1 uses generated geometry (boxes, cylinders, spheres) as placeholders. The architecture supports future GLB model loading via Three.js `GLTFLoader`. The `MeshId` enum maps to both placeholder geometry generators (v1) and future GLB file paths (post-v1). Swapping from placeholders to real models is a per-MeshId change in the scene manager, not a system-level change.
