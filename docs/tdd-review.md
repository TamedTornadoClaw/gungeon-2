# TDD Review Pass 2 -- Adversarial Findings

This review evaluates the TDD as of its current state, checking all 10 review criteria. Items from the prior pass 1 review that have been resolved are noted. New findings and persistent issues are documented.

---

## 1. GDD Coverage

### 1.1 -- RESOLVED: Shop Entity and System
The TDD now has a Shop entity composition, ShopSystem, ShopUI component, ShopTag, shop config, and shop-related factory functions. No remaining gap.

### 1.2 -- RESOLVED: Chest Entity and System
The TDD now has a Chest entity composition, ChestSystem, ChestTag, Chest component, and factory function. No remaining gap.

### 1.3 -- RESOLVED: Boss Entity and Floor Transition
Boss entity composition, BossTag, FloorTransitionSystem, Stairs entity, and boss floor logic are all present. Victory condition triggers on boss death via DeathSystem.

### 1.4 -- RESOLVED: Floor/Depth Transition System
FloorTransitionSystem is specified with stairs entity, depth tracking, and dungeon regeneration logic.

### 1.5 -- RESOLVED: Enemy Weapon Data
EnemyWeapon component is defined with damage, fireRate, projectileSpeed, projectileCount, spread, fireCooldown. EnemyWeaponSystem is specified. Per-enemy ranged stats are in config.md.

### 1.6 -- RESOLVED: Screen Shake Config
`screenEffects.shake` section is in config.md with damping, playerHitIntensity, explosionIntensity, bigHitIntensity.

### 1.7 -- RESOLVED: Damage Number Config
`damageNumbers` section is in config.md with lifetime, driftSpeed, critScale.

### 1.8 -- NEW: Missing "Continue" / Save System
- **TDD section:** states.md
- **What's wrong:** The GDD Main Menu lists "Continue (if save exists)" as a menu option (GDD line 202). The TDD MainMenu component tree has "New Game" and "Settings" buttons but no "Continue" button. No save/load mechanism exists. The GDD Open Questions section (item 13) acknowledges this is an open question. However, the TDD should at minimum stub this out or explicitly note it as out-of-scope for v1.
- **Recommended fix:** Add a note to the MainMenu state definition that "Continue" is deferred/out-of-scope for v1, or add a placeholder continue button that is disabled when no save exists.

### 1.9 -- NEW: Missing Enemy Depth Scaling for Shields
- **TDD section:** config.md
- **What's wrong:** The GDD says "All enemies scale with depth -- higher depth means higher stats (HP, damage, speed, shields)." The depth scaling config has multipliers for health, damage, and speed but not for shields. ShieldGun enemies have `shieldHealth: 40` as a flat value. Shield health should also scale with depth.
- **Recommended fix:** Add `shieldHealthMultiplierPerDepth` to the `depthScaling` config section, or document that shield health scales via the generic health multiplier.

### 1.10 -- NEW: Missing Armor/Shield Player Pickups
- **TDD section:** entities.md, config.md
- **What's wrong:** The GDD mentions "Armor: 0 (can be found/upgraded later)" and "Shields: 0 (can be found/upgraded later)". The player entity has optional Armor and Shield components. However, there is no pickup entity for armor or shields, no way to acquire them in-game, and no system to grant them. The GDD scope section says "Upgrades to dodge roll, armor, shields (stretch goals)" -- so this is explicitly out of v1 scope. The TDD correctly models the components but should note these components are unused in v1.
- **Recommended fix:** Add a note to the Player entity composition that Armor and Shield components exist for future extensibility but have no acquisition mechanism in v1.

### 1.11 -- NEW: Missing Health Pickup Drop from Enemies
- **TDD section:** systems.md (DeathSystem)
- **What's wrong:** The GDD says health pickups are "rare drops from enemies" (GDD line 141). The config has `healthPickupDropChance: 0.05` in the dungeon section. However, the DeathSystem properties only mention spawning XP gems and rolling currency drops. Health pickup drops are not mentioned in DeathSystem.
- **Recommended fix:** Add health pickup drop logic to DeathSystem: "Roll health drop: if `random() < healthPickupDropChance`, spawn health pickup at enemy position."

### 1.12 -- NEW: Missing Weapon Swap Speed Mechanic
- **TDD section:** systems.md (PlayerControlSystem)
- **What's wrong:** The GDD explicitly states: "Switching to your sidearm is faster than reloading your long arm" (GDD line 22, 463). The PlayerControlSystem properties describe seamless switching between sidearm and long arm via fire buttons, but there is no weapon swap delay or animation time. Without a swap cooldown, the "faster than reloading" distinction is meaningless since switching is instant.
- **Recommended fix:** Either add a `weaponSwapTime` design param (short for sidearm, longer for long arm) or document that switching is instant and the GDD's "faster than reloading" simply means the player can fire the sidearm immediately instead of waiting for a reload.

### 1.13 -- NEW: Missing Gun Rarity / Loot Generation System
- **TDD section:** entities.md, systems.md
- **What's wrong:** The GDD says "Find rare guns with better trait combos" (GDD line 105) and the Open Questions mention gun rarity tiers. The TDD has no mechanism for generating guns with random trait combinations. The `createGun` factory takes a `GunType` but traits come from config as fixed per-type arrays. There is no loot table or randomization of traits for found guns.
- **Recommended fix:** Either document that v1 guns always have their thematic trait set (no randomization), or add a loot generation mechanism that can produce guns with varied trait combinations. The GDD implies variety is important ("Find rare guns with better trait combos").

---

## 2. XP Stack Compliance

### 2.1 -- RESOLVED: Piercing/Bouncing Mutual Exclusivity
The `createGun` factory now explicitly validates this constraint. The Gun component documents the invariant. This is also tested per the TDD.

### 2.2 -- RESOLVED: Camera Config
Camera parameters are now in `config/design-params.json` under the `camera` section.

### 2.3 -- RESOLVED: Particle Manifest Schema
Particle manifest schema is defined in config.md with count, lifetime, speed, spread, sizeStart, sizeEnd, colorStart, colorEnd, emissive, gravity.

### 2.4 -- RESOLVED: Sound Manifest Schema
Sound manifest schema is defined in config.md with path, volume, pitchMin, pitchMax, maxInstances, loop.

### 2.5 -- RESOLVED: ParticleEffect Enum
`ParticleEffect` enum is defined in entities.md with 10 values.

### 2.6 -- RESOLVED: MeshId Enum
`MeshId` enum is defined in entities.md with all mesh identifiers.

### 2.7 -- RESOLVED: AnimationName Enum / SpriteAnimation Component
The SpriteAnimation component and AnimationName enum appear to have been removed (not present in current entities.md). This is correct -- v1 uses generated geometry.

### 2.8 -- NEW: Missing `GunCategory` assignment for Gun Types in Config
- **TDD section:** config.md
- **What's wrong:** The gun config uses string values for `category` (e.g., `"Sidearm"`, `"LongArm"`). Per XP Stack rules: "Strict TypeScript, no any, enums for all categorical identifiers." The config JSON uses string literals, and the typed loader must map these to `GunCategory` enum values. The typed loader `designParams.ts` is referenced but its validation logic is not specified. If the loader doesn't validate/map strings to enums, raw strings leak into the codebase.
- **Recommended fix:** Specify in config.md that the typed loader validates all enum-like string values in the JSON against their corresponding TypeScript enums at load time, throwing on mismatch.

### 2.9 -- NEW: `ColliderShape` Enum Only Has AABB
- **TDD section:** entities.md
- **What's wrong:** `ColliderShape` has a single value: `AABB`. This is fine for v1, but the suicide bomber is represented as a sphere (`Yellow sphere (r=0.6)` in assets.md) and explosions use radius queries. If the collision system only supports AABB, the explosion radius check is not a collision system query -- it is a manual distance check. This is inconsistent with the "generic collision system" XP Stack requirement.
- **Recommended fix:** Either add `ColliderShape.Circle` for 2D radius collision (since gameplay is top-down), or document that the explosion radius query is a separate utility function outside the collision system, which is acceptable since explosions are not ongoing collisions.

### 2.10 -- NEW: Zustand Store Has Mixed Concerns
- **TDD section:** states.md (Zustand Store Shape)
- **What's wrong:** The store shape mixes FSM state (`currentState`, `previousState`, `transition`) with per-state data (`selectedLongArm`, `comparisonGunEntityId`, `runStats`) and settings. The XP Stack says "App state machine in Zustand." The overview.md shows `appStore.ts` and `settingsStore.ts` as separate stores, but the Zustand Store Shape in states.md puts settings inside the AppStore. The overview module structure lists a separate `settingsStore.ts`.
- **Recommended fix:** Align states.md Zustand Store Shape with overview.md module structure: settings should live in `settingsStore.ts`, not inside the AppStore interface. Update the store shape to remove the `settings` field and note it lives in a separate store.

### 2.11 -- NEW: No Test Specifications in TDD
- **TDD section:** overview.md
- **What's wrong:** The XP Stack requires "Vitest + fast-check, systems tested as pure functions." The TDD lists `tests/` and `test-specs/` directories, and the CLAUDE.md spec mentions test conventions. However, no TDD file specifies which property-based tests should be written for each system. The property contracts in systems.md are testable, but no mapping from contract to test spec exists.
- **Recommended fix:** This is a minor gap. The property contracts in systems.md serve as implicit test specs. However, adding a note that each property contract maps 1:1 to a fast-check property test in `tests/` would make the developer workflow clearer.

---

## 3. Property Contract Quality

### 3.1 -- RESOLVED: Water Speed Modifier
The SpeedModifier component and refresh mechanism are now specified. CollisionResponseSystem applies SpeedModifier on Player+Water overlap, ExpireModifiersSystem removes it when not refreshed.

### 3.2 -- RESOLVED: DeathSystem Gun Slot Tracing
The Projectile component now has `sourceGunSlot: WeaponSlot` for XP gem attribution.

### 3.3 -- RESOLVED: Hazard Exit Detection
DamageOverTime and SpeedModifier both use a `refreshed` flag pattern. CollisionResponseSystem refreshes on overlap, ExpireModifiersSystem removes when not refreshed.

### 3.4 -- RESOLVED: Forced Upgrade Tracking
Gun component now has `forcedUpgradeTriggered: boolean`.

### 3.5 -- RESOLVED: SpawnSystem Trigger
SpawnZone entity with position, dimensions, and `activated` flag handles room-entry detection via collision trigger.

### 3.6 -- NEW: ProjectileSystem Position in Execution Order Is Wrong
- **TDD section:** systems.md (System Execution Order)
- **What's wrong:** ProjectileSystem (player firing) runs at position 12, AFTER CollisionDetectionSystem (7) and CollisionResponseSystem (8). This means bullets spawned by the player this frame will not be collision-checked until the NEXT frame. Meanwhile, EnemyWeaponSystem (5) spawns enemy bullets BEFORE collision detection in the same frame. This creates an asymmetry: enemy bullets are collision-checked on the frame they spawn, but player bullets are not. This could cause player bullets to visually pass through thin walls for one frame.
- **Recommended fix:** Move ProjectileSystem (player firing) to run before MovementSystem (position 5.5), or after EnemyWeaponSystem but before MovementSystem. Both player and enemy bullet spawning should happen before movement and collision in the same frame.

### 3.7 -- NEW: PlayerControlSystem Emits FireGun Event But No FireGun Event Type Defined
- **TDD section:** systems.md
- **What's wrong:** PlayerControlSystem properties say "emit FireGun event for sidearm/long arm." But the Event Types section at the bottom of systems.md does not define a `FireGunEvent` type. Only `DamageEvent`, `ParticleEvent`, `AudioEvent`, `DamageNumberEvent`, and `DoorInteractEvent` are defined.
- **Recommended fix:** Either define `FireGunEvent` in the event types section, or clarify that PlayerControlSystem directly calls into ProjectileSystem logic rather than emitting an event.

### 3.8 -- NEW: InteractEvent Referenced But Not Defined
- **TDD section:** systems.md (PlayerControlSystem)
- **What's wrong:** PlayerControlSystem says "If `input.interact`: emit InteractEvent at player position." But no `InteractEvent` type is defined. The PickupSystem, ChestSystem, ShopSystem, and FloorTransitionSystem all check `input.interact` directly from InputState rather than consuming events. There is a disconnect between the PlayerControlSystem emitting events and downstream systems reading input directly.
- **Recommended fix:** Remove the InteractEvent reference from PlayerControlSystem. The downstream systems already read `input.interact` directly, which is simpler and consistent.

### 3.9 -- NEW: AISystem Velocity vs Desired Velocity Ambiguity
- **TDD section:** systems.md (AISystem)
- **What's wrong:** The AISystem description says "Does NOT apply movement -- just sets velocity and rotation targets." But the signature shows it writes to `Velocity` directly. If AISystem sets `Velocity` on enemies and PlayerControlSystem sets `Velocity` on the player, then MovementSystem simply reads velocity and applies position changes. The "does NOT apply movement" comment is misleading -- it does set velocity, which IS movement intent. The distinction between "setting velocity" and "applying movement" should be clearer.
- **Recommended fix:** Rephrase to: "AISystem sets the Velocity component on enemy entities based on AI decisions. MovementSystem then integrates Velocity into Position. AISystem does not modify Position directly."

### 3.10 -- NEW: CollisionResponseSystem Handles Too Many Responsibilities
- **TDD section:** systems.md (CollisionResponseSystem)
- **What's wrong:** The response table has 15+ distinct interaction types. Some responses emit events (DamageEvent), some modify components directly (set `isFlying`, apply DamageOverTime), some set flags (nearPickup, nearChest), and some trigger state transitions (GunComparison). This is a god-system that will be difficult to test as a pure function. Property-based testing requires clear input-output contracts, but this system has dozens of conditional branches.
- **Recommended fix:** This is an architectural concern, not a blocking issue. Consider splitting into sub-handlers (e.g., `projectileCollisionHandler`, `playerEnvironmentHandler`, `pickupProximityHandler`), each testable independently. The main CollisionResponseSystem would dispatch to these handlers based on component tags.

### 3.11 -- NEW: DamageSystem Damage Ordering (Shield -> Armor -> Health) Not Fully Specified
- **TDD section:** systems.md (DamageSystem)
- **What's wrong:** The property says "damage reduces shield first, remainder goes to armor, then health." But what if an entity has a Shield component with 0 current shields? Does it still reset `timeSinceLastHit` to 0? Should it? If shields are at 0 and the entity takes damage, the regen delay should not be reset by damage that bypasses shields entirely.
- **Recommended fix:** Clarify: "If entity has Shield and `shield.current > 0`: damage reduces shield first, reset `timeSinceLastHit` to 0. If shield absorbs all damage, no armor/health damage. Remainder passes to armor, then health. If `shield.current === 0`, shield component is ignored for damage application (no regen delay reset)."

### 3.12 -- NEW: EnemyShield Frontal Blocking Logic Not Connected to DamageSystem
- **TDD section:** systems.md, entities.md
- **What's wrong:** The EnemyShield component has `facingAngle` and `coverageArc` for directional blocking. The CollisionResponseSystem says "if shield blocks: no damage, destroy projectile." But how is "shield blocks" determined? The DamageSystem doesn't reference EnemyShield at all. The collision response system needs to compute whether the projectile's incoming angle falls within the shield's coverage arc. This calculation is not specified.
- **Recommended fix:** Add to CollisionResponseSystem's PlayerProjectile+Enemy response: "If enemy has EnemyShield: compute angle from projectile velocity to enemy's `facingAngle`. If angle is within `coverageArc`: reduce `enemyShield.health` instead of emitting DamageEvent. If shield health <= 0, remove EnemyShield component. Emit Sparks particle and EnemyHitArmor sound."

---

## 4. State Map Completeness

### 4.1 -- RESOLVED: Loading State
Loading state is defined with component tree, entry effects (load manifests, pre-allocate), and auto-transition to MainMenu.

### 4.2 -- ACKNOWLEDGED: Level Generation Loading
The Gameplay entry effects say "generate dungeon for depth 1" but no separate loading state exists. This is acceptable if generation is fast, but should be noted.
- **Recommended fix:** Add a property contract: "Dungeon generation for any depth completes in under 16ms."

### 4.3 -- RESOLVED: GunComparison Slot Determination
GunComparison entry effects now specify: "Determine `comparisonSlot` from the found gun's `GunCategory`."

### 4.4 -- RESOLVED: Settings State Return Transition
The transition validation now explicitly says: "Settings -> X is only valid when X === previousState."

### 4.5 -- NEW: ShopUI State/Overlay Missing from State Map
- **TDD section:** states.md
- **What's wrong:** The overview module structure lists `ShopUI.tsx` as a UI component. The ShopSystem says "show shop UI overlay." But there is no `Shop` state in the AppState enum and no shop overlay defined in any state's component tree. The shop interaction is handled by ShopSystem with `input.interact`, but the GDD implies a shop screen where the player browses items.
- **Recommended fix:** Either add a `ShopBrowse` state (game pauses, shop overlay shown) to the AppState enum and transition map, or document that the shop interaction is purely in-world with no overlay/pause (just pressing interact to cycle and buy). The current ShopUI.tsx component has no state to render it.

### 4.6 -- NEW: Gameplay State Active Systems List Is Missing Some Systems
- **TDD section:** states.md (Gameplay)
- **What's wrong:** The Gameplay active systems list includes "EnemyWeapon" but the system execution order in systems.md lists it as "EnemyWeaponSystem." More importantly, the Gameplay active systems list omits `ExpireModifiersSystem` by name -- it says "ExpireModifiers" which is fine. However, `GunStatSystem` is listed in the system execution order but NOT listed in the Gameplay active systems list. GunStatSystem recalculates gun stats after upgrades and should technically run.
- **Recommended fix:** The GunStatSystem documentation says "Called whenever trait levels change (after upgrade), not every frame." If it is not in the game loop, clarify where it is called (e.g., by the upgrade UI action). If it should be in the loop, add it to the active systems list.

---

## 5. CLAUDE.md Completeness

### 5.1 -- RESOLVED: CLAUDE.md Spec Content
The CLAUDE.md specification in overview.md is thorough with commands, code rules, project structure, integration rules (verbatim wiring text), and ownership rules (verbatim fixing text).

### 5.2 -- RESOLVED: Test File Naming Convention
CLAUDE.md spec now includes: "Test files: `tests/<systemName>.test.ts`."

### 5.3 -- RESOLVED: Asset Spec Directory
CLAUDE.md spec now includes `asset-specs/` in the project structure section.

### 5.4 -- NEW: CLAUDE.md Missing Enum Import Convention
- **TDD section:** overview.md (CLAUDE.md spec)
- **What's wrong:** The codebase defines many enums (AppState, GunType, GunTrait, EnemyType, SoundId, ParticleEffect, MeshId, etc.) across multiple files. The CLAUDE.md does not specify where enums live or how they should be imported. Are they all in `components.ts`? Are some in `types/index.ts`? The `sounds.ts` re-exports SoundId from components. Without clear guidance, developers will create circular imports or duplicate enum definitions.
- **Recommended fix:** Add to CLAUDE.md: "All game enums are defined in `src/ecs/components.ts` and re-exported as needed. Import enums from `src/ecs/components.ts`, not from system files."

---

## 6. Circular Dependencies

### 6.1 -- RESOLVED: CollisionResponseSystem / PickupSystem Overlap
Responsibilities are now cleanly split: CollisionResponseSystem sets flags and emits events, PickupSystem acts on them.

### 6.2 -- NEW: DeathSystem and CollisionResponseSystem Both Handle Suicide Bomber Explosions
- **TDD section:** systems.md
- **What's wrong:** The CollisionResponseSystem response table says: "SuicideBomber contact/death -> Trigger explosion: query all entities with Health within explosionRadius." The DeathSystem also says: "For suicide bombers with health <= 0: trigger explosion BEFORE destroying." Both systems claim responsibility for the bomber explosion on death. This creates a potential double-explosion: CollisionResponseSystem triggers it on contact, and DeathSystem triggers it again when health reaches 0 from the contact damage.
- **Recommended fix:** Clarify ownership. CollisionResponseSystem should handle bomber-player contact explosions (bomber touches player -> explode). DeathSystem should handle bomber death from gunfire (shot to death -> explode). Add a flag `hasExploded: boolean` to prevent double-explosion, or assign explosion responsibility to only one system.

---

## 7. Config Completeness

### 7.1 -- RESOLVED: Camera Config
Present under `camera` section.

### 7.2 -- RESOLVED: Screen Shake Parameters
Present under `screenEffects.shake` section.

### 7.3 -- RESOLVED: Damage Number Parameters
Present under `damageNumbers` section.

### 7.4 -- RESOLVED: Hit Flash and Damage Vignette Parameters
Present under `screenEffects.hitFlash` and `screenEffects.damageVignette` sections.

### 7.5 -- RESOLVED: Per-Gun Projectile Lifetime
Each gun config now has a `projectileLifetime` value.

### 7.6 -- RESOLVED: Per-Enemy Projectile Speed
Each ranged enemy type now has `projectileSpeed` in its config.

### 7.7 -- NEW: Missing Reload Sound Per Gun Type
- **TDD section:** config.md, entities.md (SoundId enum)
- **What's wrong:** The GDD says "Reload sound (per gun type)" (GDD line 623). However, the SoundId enum has only a single `Reload` value, not per-gun-type reload sounds (PistolReload, SMGReload, etc.). The GDD parenthetical "(per gun type, or generic)" allows a generic, but the GDD audio section says "Reload sound (per gun type)" as the primary intent.
- **Recommended fix:** Either add per-gun-type reload sounds to the SoundId enum (PistolReload, SMGReload, AssaultRifleReload, ShotgunReload, LMGReload), or document the design decision that v1 uses a single generic reload sound.

### 7.8 -- NEW: Missing Enemy Death Sound Per Type
- **TDD section:** entities.md (SoundId enum)
- **What's wrong:** The GDD says "Enemy death sounds (per type)" (GDD line 277). The SoundId enum has only `EnemyDeath` (generic). The GDD asks for per-type death sounds.
- **Recommended fix:** Same as 7.7: either add per-type sounds or document the v1 simplification.

### 7.9 -- NEW: Missing Dungeon Corridor/Connection Config
- **TDD section:** config.md
- **What's wrong:** The dungeon config has `roomMinSize`, `roomMaxSize`, `corridorWidth`, and `roomsPerFloor`. But there are no parameters for how rooms connect (max corridor length, branching factor, dead-end probability, etc.). The GDD describes "continuous interconnected spaces" which implies corridors are important.
- **Recommended fix:** This is minor for v1 since the generation algorithm is not fully specified. Add at minimum a comment noting that corridor/connectivity parameters may need to be added during implementation.

### 7.10 -- NEW: Missing `minReloadTime` Clamp in Config
- **TDD section:** config.md, systems.md (GunStatSystem)
- **What's wrong:** GunStatSystem says "reloadTime is clamped to minimum 0.2 seconds." But this 0.2 value is not in design-params.json. It is a magic number.
- **Recommended fix:** Add `minReloadTime: 0.2` to the gun config or a global game config section.

---

## 8. Entity Completeness

### 8.1 -- RESOLVED: Shop, Chest, Boss, Stairs entities all present.

### 8.2 -- RESOLVED: XPGem tracks `sourceGunEntityId` instead of slot.
The XPGem component now uses `sourceGunEntityId: EntityId` which correctly tracks the gun identity, not the slot.

### 8.3 -- RESOLVED: Gun Pickup entity uses Gun component directly.
The gun pickup entity IS the gun entity with both Gun and Pickup components. Clean design.

### 8.4 -- NEW: Missing SpawnZone `cleared` Flag Usage
- **TDD section:** entities.md
- **What's wrong:** The SpawnZone component has `cleared: boolean` defined as "true once all spawned enemies are dead." But no system references this flag. The SpawnSystem only cares about `activated`. The DeathSystem doesn't update SpawnZone. The DoorSystem doesn't check `cleared` for room-clearing door behavior (GDD line 164: "Open automatically when approached (or when room is cleared?)"). The flag exists but is dead data.
- **Recommended fix:** Either specify a system that tracks spawned enemy deaths and sets `cleared = true`, or remove the field. If doors should only open after clearing a room, connect `SpawnZone.cleared` to `Door.isOpen` via DoorSystem.

### 8.5 -- NEW: Boss `isMini` Field Is Misleading
- **TDD section:** entities.md
- **What's wrong:** The Boss entity composition says "Boss is a sized-up enemy with `isMini = false` and `BossTag`." The `isMini` field on the Enemy component is meant to distinguish mini-bosses from regular enemies. Using `isMini = false` for the boss is technically correct (the boss is not a mini-boss) but semantically confusing -- a regular enemy also has `isMini = false`. The boss is identified by BossTag, not by Enemy.isMini. The `isMini` field is irrelevant for the boss.
- **Recommended fix:** Minor. Add a clarifying comment that the boss is identified by `BossTag`, not by the `isMini` field.

---

## 9. Interaction Completeness

### 9.1 -- RESOLVED: Enemy Projectile vs Wall
Present in response table: "EnemyProjectile + Wall -> Destroy projectile."

### 9.2 -- RESOLVED: Enemy Projectile vs Destructible
Present in response table with design decision: "Destructibles block enemy bullets but take no damage from them."

### 9.3 -- RESOLVED: Enemy vs Hazard
AISystem properties now state: "Enemies ignore hazards (they walk through fire and water unaffected -- design decision for v1 simplicity)."

### 9.4 -- RESOLVED: Suicide Bomber Explosion Mechanism
Explosion mechanism is now specified: radius query against all entities with Health component within explosionRadius.

### 9.5 -- RESOLVED: Player vs Enemy Push-Out
Response table now includes: "Player + Enemy -> Push apart (position correction)."

### 9.6 -- NEW: Bouncing Bullet vs Enemy Interaction Underspecified
- **TDD section:** systems.md (CollisionResponseSystem)
- **What's wrong:** The GDD Open Question 10 asks: "Does bouncing off an enemy deal damage again, or just redirect the bullet?" The TDD's response table handles `PlayerProjectile + Enemy` with piercing but does not specify bouncing behavior on enemy contact. The Bouncing trait description says "bounces off enemies and walls" but the collision response only handles bouncing for `PlayerProjectile + Wall` ("reflect velocity, decrement bounces"). What happens when a bouncing bullet hits an enemy?
- **Recommended fix:** Add to the response table: "PlayerProjectile (bouncing) + Enemy: deal damage, then if `bouncesRemaining > 0`, reflect velocity away from enemy, decrement bounces, add enemy to `alreadyHit` to prevent immediate re-hit." This resolves the GDD open question.

### 9.7 -- NEW: Player Bullet vs Player Interaction Not Addressed
- **TDD section:** systems.md (CollisionResponseSystem)
- **What's wrong:** The response table does not specify what happens if a bouncing player bullet comes back and hits the player. Should the player be immune to their own projectiles? The `PlayerProjectileTag` would match against `PlayerTag` -- this pair is not in the response table.
- **Recommended fix:** Add to the response table: "PlayerProjectile + Player -> No effect (player immune to own projectiles)." Ensure the collision system skips this pair or the response system explicitly ignores it.

### 9.8 -- NEW: Pit Hazard Missing from Collision System
- **TDD section:** entities.md, systems.md
- **What's wrong:** The GDD lists Pits as "Impassable (block movement, act as walls)" (GDD line 156, 338). The HazardType enum has Fire, Spikes, and Water -- but no Pit. Pits are not modeled as hazards; they should be modeled as walls (static colliders). But the assets.md has a `Pit` MeshId that is a "Black plane (or no mesh -- void)." There is no Pit entity in the entity compositions. Pits are visually defined but have no collision behavior.
- **Recommended fix:** Either model pits as Wall entities (same collision behavior, different MeshId), or add a Pit entity composition: `Position, Collider(isStatic=true, isTrigger=false), Renderable(Pit), WallTag`. Pits should block movement like walls.

---

## 10. Asset Completeness

### 10.1 -- RESOLVED: Metal Destructible Break Sound
Present as `DestructibleBreakMetal` in SoundId and `DestructibleDebrisMetal` in ParticleEffect.

### 10.2 -- RESOLVED: Looping Sound Configuration
Assets.md notes: "Looping sounds: FireAmbient and WaterAmbient must have loop: true in the sound manifest."

### 10.3 -- RESOLVED: Crosshair in Rendering
Crosshair is documented in rendering.md as CSS overlay.

### 10.4 -- RESOLVED: Victory Screen and Pause Overlay in UI Assets
Both are listed in the UI assets table.

### 10.5 -- NEW: Missing Chest Open Sound
- **TDD section:** entities.md (SoundId enum), assets.md
- **What's wrong:** The ChestSystem says "Emit AudioEvent (reuse DoorOpen or add ChestOpen)." But there is no `ChestOpen` SoundId in the enum. The system suggests reusing `DoorOpen`, but the GDD's sound list does not list a chest open sound either. A chest opening is a distinct game event that should have its own sound for player satisfaction.
- **Recommended fix:** Add `ChestOpen` to the SoundId enum and sound manifest, or document that `DoorOpen` is intentionally reused for chests.

### 10.6 -- NEW: Missing Gun Comparison Screen UI Sounds
- **TDD section:** entities.md (SoundId enum)
- **What's wrong:** The GDD audio section lists "Gun comparison screen open" and "Gun swap confirmation" as distinct UI sounds. These ARE in the SoundId enum (`ComparisonScreenOpen`, `GunSwapConfirm`). However, `GunSwapConfirm` is listed but the GunComparison state exit effects don't mention emitting an audio event on swap. The state definition says "If swapped, update player's weapon slot component. Remove old gun entity..." but no AudioEvent emission.
- **Recommended fix:** Add to GunComparison exit effects: "Emit AudioEvent(GunSwapConfirm) if player chose to swap."

---

## Summary

### Issues Resolved from Pass 1: 28 of 38

The TDD has been significantly improved since pass 1. All critical architectural gaps (shop, chest, boss, floor transitions, enemy weapons, explosion mechanics) have been addressed.

### Remaining/New Issues by Severity

**Blocking Issues (would cause incorrect behavior or implementation confusion):**
1. ProjectileSystem runs after CollisionDetection -- player bullets skip collision for one frame (3.6)
2. Suicide bomber explosion dual-ownership between CollisionResponseSystem and DeathSystem -- risk of double-explosion (6.2)
3. Health pickup drops not specified in DeathSystem (1.11)
4. Bouncing bullet vs enemy behavior unspecified (9.6)
5. Pit hazard has no entity composition or collision behavior (9.8)
6. EnemyShield frontal blocking calculation not specified (3.12)

**Significant Issues (would cause developer confusion):**
7. FireGunEvent type referenced but not defined (3.7)
8. InteractEvent referenced but downstream systems read input directly (3.8)
9. ShopUI.tsx has no state to render it (4.5)
10. SpawnZone.cleared flag is dead data (8.4)
11. GunStatSystem not in game loop but not clearly called elsewhere (4.6)
12. Zustand store shape inconsistent with module structure re: settings (2.10)
13. No gun loot randomization mechanism for found guns (1.13)
14. minReloadTime 0.2s is a magic number not in config (7.10)

**Minor Issues (quality/completeness):**
15. No "Continue" button or save system acknowledgment (1.8)
16. Shield health does not scale with depth (1.9)
17. Armor/Shield acquisition not possible in v1 -- should be noted (1.10)
18. Weapon swap timing not specified (1.12)
19. Enum import convention not in CLAUDE.md (5.4)
20. Per-gun-type reload and per-enemy-type death sounds missing (7.7, 7.8)
21. ChestOpen sound missing from enum (10.5)
22. GunSwapConfirm audio not emitted in state exit (10.6)
23. ColliderShape only supports AABB, explosion uses radius (2.9)
24. DamageSystem shield-at-zero regen delay behavior ambiguous (3.11)
25. Boss isMini=false is semantically confusing (8.5)
26. Dungeon corridor config sparse (7.9)
27. Config JSON string-to-enum validation not specified (2.8)

**Total new/remaining findings: 27**

The TDD is in good shape for implementation. The 6 blocking issues should be resolved before ticketing begins. The significant issues should be resolved or explicitly deferred. Minor issues can be addressed during implementation.

---

## Review — Pass 3

**Date:** 2026-03-07

### Status of Pass 2 Findings

**Blocking Issues (from pass 2):**

1. **(3.6) ProjectileSystem runs after CollisionDetection — player bullets skip collision for one frame:** RESOLVED. ProjectileSystem is now at position 5 in the execution order, before MovementSystem (7) and CollisionDetectionSystem (8). Enemy firing (EnemyWeaponSystem) is at position 6. Both player and enemy bullet spawning happen before movement and collision.

2. **(6.2) Suicide bomber explosion dual-ownership between CollisionResponseSystem and DeathSystem:** RESOLVED. Ownership is now clearly split: CollisionResponseSystem handles contact-triggered explosions (alive bomber touches player and is destroyed immediately after the explosion query), DeathSystem handles death-from-gunfire explosions. The text explicitly states "DeathSystem is the sole owner of death-triggered explosions" and describes the immediate-destroy mechanism to prevent double-explosion.

3. **(1.11) Health pickup drops not specified in DeathSystem:** RESOLVED. DeathSystem properties now include: "Roll health pickup drop: if `random() < healthPickupDropChance` (design param), spawn health pickup at enemy position."

4. **(9.6) Bouncing bullet vs enemy behavior unspecified:** RESOLVED. CollisionResponseSystem response table for PlayerProjectile + Enemy now specifies: "Handle bouncing on enemy hit: if `bouncesRemaining > 0`, deal damage, reflect velocity away from enemy center, decrement bounces, add to `alreadyHit`."

5. **(9.8) Pit hazard has no entity composition or collision behavior:** RESOLVED. Pit entity composition is defined as: `Position, Collider(isStatic=true, isTrigger=false), Renderable(Pit), WallTag`. Pits are modeled as impassable walls.

6. **(3.12) EnemyShield frontal blocking calculation not specified:** RESOLVED. CollisionResponseSystem now specifies: "If enemy has EnemyShield: compute angle between projectile's incoming direction and shield's `facingAngle`; if angle is within `coverageArc`, damage goes to `enemyShield.health` instead... If shield health <= 0, remove EnemyShield component."

**Significant Issues (from pass 2):**

7. **(3.7) FireGunEvent type referenced but not defined:** RESOLVED. PlayerControlSystem now uses a `fireRequested` flag on the Gun component instead of emitting an event. ProjectileSystem reads this flag. No event type needed.

8. **(3.8) InteractEvent referenced but downstream systems read input directly:** RESOLVED. PlayerControlSystem explicitly states: "`input.interact` is read directly by downstream systems. No event emitted."

9. **(4.5) ShopUI.tsx has no state to render it:** RESOLVED. `ShopBrowse` state is in the AppState enum, transition map, and has a full state definition with component tree `<ShopUI />`.

10. **(8.4) SpawnZone.cleared flag is dead data:** RESOLVED. SpawnSystem now checks each frame whether all `spawnedEnemies` are dead and sets `cleared = true`. The flag is connected to DoorSystem for room-clearing behavior.

11. **(4.6) GunStatSystem not in game loop but not clearly called elsewhere:** RESOLVED. Both systems.md and the Gameplay state definition clarify: "GunStat runs on-demand after upgrades, not every frame."

12. **(2.10) Zustand store shape inconsistent with module structure re: settings:** RESOLVED. `AppStore` and `SettingsStore` are now clearly defined as separate interfaces in separate stores, consistent with the `appStore.ts` / `settingsStore.ts` module structure.

13. **(1.13) No gun loot randomization mechanism for found guns:** RESOLVED. config.md explicitly documents: "v1 guns always have their thematic trait set from config (no randomization). Gun rarity and trait randomization are deferred to post-v1."

14. **(7.10) minReloadTime 0.2s is a magic number not in config:** RESOLVED. `minReloadTime: 0.2` is now present in the `gunMechanics` section of design-params.json.

**Minor Issues (from pass 2):**

15. **(1.8) No "Continue" button or save system acknowledgment:** RESOLVED. MainMenu state definition notes: "Continue button — deferred/out of scope for v1."

16. **(1.9) Shield health does not scale with depth:** RESOLVED. `shieldHealthMultiplierPerDepth: 0.15` added to depth scaling config.

17. **(1.10) Armor/Shield acquisition not possible in v1:** RESOLVED. Player entity composition notes: "Armor and Shield components exist for future extensibility but have no acquisition mechanism in v1."

18. **(1.12) Weapon swap timing not specified:** RESOLVED. `weaponSwapTime: 0.0` in config with design decision explanation.

19. **(5.4) Enum import convention not in CLAUDE.md:** RESOLVED. CLAUDE.md spec includes: "All game enums are defined in `src/ecs/components.ts` and re-exported as needed."

20. **(7.7, 7.8) Per-gun-type reload and per-enemy-type death sounds missing:** RESOLVED. assets.md documents the v1 simplification: single generic `Reload` and `EnemyDeath` sounds.

21. **(10.5) ChestOpen sound missing from enum:** RESOLVED. `ChestOpen` is now in the SoundId enum.

22. **(10.6) GunSwapConfirm audio not emitted in state exit:** RESOLVED. GunComparison exit effects include: "emit AudioEvent(GunSwapConfirm)."

23. **(2.9) ColliderShape only supports AABB, explosion uses radius:** RESOLVED. Explosion radius query is documented as a separate utility (distance check against all Health entities), not routed through the AABB collision system.

24. **(3.11) DamageSystem shield-at-zero regen delay behavior ambiguous:** RESOLVED. DamageSystem now specifies: "If `shield.current === 0`, shield component is ignored for damage routing (no regen delay reset)."

25. **(8.5) Boss isMini=false is semantically confusing:** RESOLVED. Clarifying text added: "Boss is identified by BossTag. Stats are scaled by `bossStatMultiplier` from design params."

26. **(7.9) Dungeon corridor config sparse:** STILL OPEN. The dungeon config still only has `corridorWidth`. No parameters for corridor length, branching, dead-end probability, or connectivity. This remains minor — the generation algorithm itself is underspecified and these parameters will emerge during implementation. Severity: minor.

27. **(2.8) Config JSON string-to-enum validation not specified:** RESOLVED. CLAUDE.md spec now states: "The typed config loader validates all enum-like string values in JSON against their TypeScript enums at load time, throwing on mismatch."

### Pass 2 Resolution Summary

- **Resolved:** 26 of 27 findings
- **Still open:** 1 (minor — dungeon corridor config, #26)

---

### New Findings — Pass 3

#### Blocking

**P3-1. DeathSystem's kill-attribution mechanism is fragile and underspecified.**
- **TDD section:** systems.md (DeathSystem)
- **What's wrong:** DeathSystem determines which gun killed an enemy by finding "the last DamageEvent's projectile" and reading `projectile.sourceGunSlot`. However, the DamageEvent type has a `source: EntityId` field, not a direct reference to a projectile or its `sourceGunSlot`. The DamageSystem consumes DamageEvents — by the time DeathSystem runs (position 23), those events have been processed and potentially discarded. There is no specification for how DeathSystem accesses the last DamageEvent's projectile data after DamageSystem has already consumed the events. If the projectile entity has been destroyed (e.g., a non-piercing bullet that was destroyed on hit by CollisionResponseSystem), the entity no longer exists, so looking up its `Projectile.sourceGunSlot` via `event.source` would fail. This is the core XP attribution path — if it breaks, gun leveling is non-functional.
- **Recommended fix:** Add a `lastDamageSourceGunSlot: WeaponSlot | null` field to the `Health` component (or a dedicated `KillAttribution` component). When DamageSystem processes a DamageEvent from a player projectile, it writes the projectile's `sourceGunSlot` to the target entity. DeathSystem then reads this field directly from the dying entity. This survives projectile destruction.

**P3-2. CollisionResponseSystem's SuicideBomber contact explosion destroys the entity, bypassing DeathSystem loot drops.**
- **TDD section:** systems.md (CollisionResponseSystem, DeathSystem)
- **What's wrong:** When a SuicideBomber touches the player, CollisionResponseSystem triggers the explosion and "Destroy bomber entity immediately (prevents DeathSystem double-explosion)." However, DeathSystem is responsible for spawning XP gems, rolling currency drops, rolling health drops, and emitting death sounds/particles for killed enemies. If CollisionResponseSystem destroys the bomber before DeathSystem runs, the bomber never goes through the standard death loot pipeline. The player gets no XP, no currency, and no health drop chance from contact-kill bombers. This silently breaks the economy for one of the five enemy types.
- **Recommended fix:** CollisionResponseSystem should set the bomber's health to 0 and set a `hasExploded` flag rather than destroying it. DeathSystem then handles loot drops for the bomber like any other enemy and checks `hasExploded` to skip the death-triggered explosion (since it already happened). Alternatively, CollisionResponseSystem must duplicate the full loot-drop logic, but that violates single-responsibility.

#### Significant

**P3-3. XP gem `sourceGunEntityId` becomes a dangling reference when the player swaps guns.**
- **TDD section:** entities.md (XPGem component), systems.md (PickupSystem)
- **What's wrong:** The XPGem component tracks `sourceGunEntityId: EntityId` with a comment "Tracks the gun entity that earned this XP, not the slot — survives weapon swaps." However, when the player swaps a gun via the GunComparison screen, the old gun entity is removed (GunComparison exit effects: "remove old gun entity"). If XP gems are still flying toward the player from kills made with the old gun, their `sourceGunEntityId` references a destroyed entity. PickupSystem tries to "find the gun entity matching `sourceGunEntityId`" — this lookup fails because the entity no longer exists. Those XP gems become worthless.
- **Recommended fix:** On gun swap, transfer pending XP gems to the new gun entity (update their `sourceGunEntityId`), or have PickupSystem fall back to adding XP to the active gun in the same slot when the original gun entity is missing. Document the chosen strategy.

**P3-4. No mechanism for the Gun component `fireRequested` flag to be cleared if the ProjectileSystem cannot fire.**
- **TDD section:** systems.md (PlayerControlSystem, ProjectileSystem)
- **What's wrong:** PlayerControlSystem sets `fireRequested = true` on the gun. ProjectileSystem clears it when it fires. But what if the gun cannot fire (e.g., `fireCooldown > 0`, or `currentAmmo <= 0` and reload hasn't started)? The `fireRequested` flag is never cleared in these cases. Next frame, PlayerControlSystem may set it again, and the flag stays permanently true. This is benign if ProjectileSystem always checks preconditions before acting on it, but the property contract for ProjectileSystem says "If gun has `fireRequested` flag and `fireCooldown <= 0` and `currentAmmo > 0` and not reloading: fire. Clear `fireRequested`." The clear only happens on successful fire. If preconditions fail, the flag persists.
- **Recommended fix:** ProjectileSystem should unconditionally clear `fireRequested` at the start of processing each gun, then check if firing conditions are met. This makes the flag a one-frame signal, not a latched state.

**P3-5. DamageOverTime from fire hazard applies damage in HazardSystem, but spike damage uses a DamageEvent from CollisionResponseSystem — inconsistent damage routing.**
- **TDD section:** systems.md (HazardSystem, CollisionResponseSystem, DamageSystem)
- **What's wrong:** Fire damage is applied by HazardSystem directly (`damagePerSecond * dt` each frame), bypassing DamageSystem entirely. This means fire damage does not interact with the armor/shield damage pipeline in DamageSystem, does not emit DamageNumberEvents, and does not emit hit sounds or particles. Spike damage, by contrast, is emitted as a DamageEvent and goes through DamageSystem properly. Water uses SpeedModifier (no damage, so no issue). Fire is the inconsistent one — it deals damage but skips the damage pipeline.
- **Recommended fix:** HazardSystem should emit DamageEvents for fire damage each frame (with `amount = damagePerSecond * dt`) rather than reducing health directly. This routes fire damage through the standard DamageSystem pipeline, ensuring armor/shields absorb correctly and damage numbers display.

**P3-6. No `Renderable` component on the Gun entity when it is attached to the player.**
- **TDD section:** entities.md (Gun Entity)
- **What's wrong:** The Gun Entity (attached to player) has only the `Gun` component — no `Position`, no `Renderable`. The player's weapon model needs to be visually attached to the player mesh. The assets.md lists gun models (Pistol, SMG, etc.) with MeshIds, but there is no specification for how the active gun's mesh is rendered. It is not an entity in the world, so the rendering system's entity-based approach (query Renderable + Position, update mesh) does not apply. The rendering system or scene manager needs special-case logic to attach gun meshes as children of the player mesh.
- **Recommended fix:** Add a note in rendering.md specifying that gun meshes are managed as child objects of the player mesh in the scene graph, swapped based on `Player.activeSlot` and the `Gun.gunType` of the active gun. This is not an ECS entity concern — it is a rendering concern. The scene manager reads the player's active gun type and sets the appropriate child mesh visible.

#### Minor

**P3-7. `Projectile.sourceGunSlot` is set on enemy bullets but meaningless.**
- **TDD section:** entities.md (Projectile component)
- **What's wrong:** The `Projectile` component has `sourceGunSlot: WeaponSlot` for XP attribution. Enemy projectiles have `isEnemyProjectile: boolean = true` and do not need a `sourceGunSlot` (enemies don't have weapon slots). The `createEnemyBullet` factory would need to supply a dummy value. This is a minor type-safety concern.
- **Recommended fix:** Make `sourceGunSlot` optional (`sourceGunSlot?: WeaponSlot`) or use a discriminated union for player vs enemy projectile data.

**P3-8. No specification for how the crosshair converts screen position to world position for aiming.**
- **TDD section:** systems.md (InputSystem), rendering.md
- **What's wrong:** InputSystem produces `aimWorldX` and `aimWorldY` described as "world-space cursor position." The property says "Mouse position is converted from screen space to world space using the camera projection." However, no system or module is assigned responsibility for this conversion. The InputSystem signature takes only `InputManager` — it does not have access to the camera. Either InputManager must hold a camera reference, or screen-to-world conversion happens elsewhere and is injected into InputState.
- **Recommended fix:** Specify that `inputManager` holds a reference to the camera (or a screen-to-world conversion function), or that the game loop passes the camera to InputSystem for the raycasting/unprojection needed to convert screen mouse coordinates to the ground plane in world space.

**P3-9. `maxFrameTime: 0.1` in game loop config limits catchup to ~6 simulation steps, but no spiral-of-death protection is documented.**
- **TDD section:** config.md (Game Loop), systems.md
- **What's wrong:** The fixed timestep loop accumulates real time and steps the simulation at 60Hz. `maxFrameTime: 0.1` caps the accumulated time per real frame to 100ms. At 16.67ms per step, this allows up to 6 steps per frame. If the simulation consistently takes longer than 16.67ms to compute, the game enters a spiral of death — more steps per frame means each frame takes longer, which means more steps accumulate. The cap at 6 steps helps but does not fully prevent it. No documentation exists for what happens if the simulation exceeds budget.
- **Recommended fix:** Add a note: "If accumulated time exceeds `maxFrameTime`, excess time is discarded (not carried to the next frame). This prevents spiral-of-death at the cost of simulation slowdown during sustained heavy load." Confirm this is the intended behavior.

**P3-10. No run stats tracking mechanism specified.**
- **TDD section:** states.md (Gameplay exit effects, Death/Victory states)
- **What's wrong:** Gameplay exit effects to Death/Victory say "Record run stats (kills, depth, time, guns used)." The Zustand store has `runStats: RunStats | null` but `RunStats` is not defined anywhere. No system tracks kills, no system tracks elapsed time, no system tracks depth reached. These stats need to be accumulated during gameplay — either by dedicated tracking in a component or by a lightweight bookkeeping system.
- **Recommended fix:** Define the `RunStats` interface (kills, depth, time, gunsUsed, traitsLeveled) in the Zustand store type definitions. Specify that kills are incremented by DeathSystem (on enemy death), time is tracked by the game loop, and depth is tracked by FloorTransitionSystem. On transition to Death/Victory, these values are snapshotted into `runStats`.

### Performance Budget Review

The performance budget section in systems.md is well-structured and viable. Specific assessment:

- **Entity counts (~500 peak):** Reasonable for the scope. The breakdown is internally consistent with dungeon config (8 rooms x 5 avg enemies = 40 enemies, plus ~200 walls, ~30 hazards, etc.).
- **Collision strategy:** Spatial hash with ~3200 pair checks per frame is well within budget. The note that brute-force would also work at this scale is accurate — 72,900 AABB checks is trivially fast.
- **Draw call budget (~21):** Viable and well below the 50-call target. The instanced rendering strategy is sound — one draw call per entity type is correct for Three.js InstancedMesh.
- **AI throttling:** Correctly identified as unnecessary for v1 given simple state machines.
- **GC pressure warning:** Appropriately flagged. The "no `new` in per-frame system code" rule is critical and actionable.
- **Known hot paths:** Correctly identified. The instanced rendering matrix update advice (typed arrays, bulk updates) is practical.

**One concern:** The particle count estimate of ~100 is potentially low during intense combat. A shotgun (6 pellets) hitting enemies produces 6 BulletImpactEnemy effects + 6 BloodSplat effects per shot at 1.5 shots/sec = 18 particle bursts/sec. Each burst spawns multiple particles per the manifest. If `count` is 5-10 per effect, that is 90-180 particles from one shotgun alone, plus muzzle flashes, XP gem trails, and any explosions. The ~100 estimate should be raised to ~200-300 for worst case, which is still within instanced mesh budget but should be acknowledged. This is not blocking — the instanced approach handles it — but the estimate should be accurate to avoid false confidence.

---

### Pass 3 Summary

**Pass 2 findings resolved:** 26 of 27
**Pass 2 findings still open:** 1 (minor — dungeon corridor config)

**New blocking findings:** 2 (P3-1, P3-2)
**New significant findings:** 4 (P3-3, P3-4, P3-5, P3-6)
**New minor findings:** 4 (P3-7, P3-8, P3-9, P3-10)

**Total open issues:** 11 (2 blocking, 4 significant, 5 minor)

The 2 blocking issues must be resolved before ticketing:

1. **P3-1:** DeathSystem's kill-attribution path reads from a potentially destroyed projectile entity. The XP attribution pipeline — the core progression mechanic — breaks silently.
2. **P3-2:** Contact-kill SuicideBombers skip the entire loot pipeline (no XP, no currency, no health drops). One of five enemy types silently gives no rewards when killed by its signature mechanic.

Once P3-1 and P3-2 are resolved, no blocking issues remain. The significant issues (P3-3 through P3-6) should be addressed or explicitly deferred before ticketing but are not hard blockers.

---

## Review — Pass 4

**Date:** 2026-03-07

### Status of Pass 3 Findings

**P3-1. DeathSystem's kill-attribution mechanism is fragile and underspecified:** RESOLVED. The `Health` component now includes `lastDamageSourceGunSlot: WeaponSlot | null`, written by DamageSystem when damage comes from a player projectile and read by DeathSystem from the dying entity. This survives projectile destruction. The full attribution chain (ProjectileSystem sets `sourceGunSlot` on Projectile, DamageSystem copies it to `Health.lastDamageSourceGunSlot`, DeathSystem reads it from the dying enemy) is clearly specified.

**P3-2. CollisionResponseSystem's SuicideBomber contact explosion destroys the entity, bypassing DeathSystem loot drops:** RESOLVED. CollisionResponseSystem now sets `health.current = 0` and `hasExploded = true` on the Enemy component instead of destroying the entity. DeathSystem handles loot drops (XP gems, currency, health pickup rolls) for the bomber like any other enemy, and checks `hasExploded` to skip redundant explosion logic. The loot pipeline is intact for contact-kill bombers.

**P3-3. XP gem `sourceGunEntityId` becomes a dangling reference when the player swaps guns:** RESOLVED. PickupSystem specifies a fallback: "If that entity no longer exists (gun was swapped out), fall back to the gun currently in the same slot (determined by comparing the original gun's category)." This handles the dangling reference gracefully.

**P3-4. No mechanism for the Gun component `fireRequested` flag to be cleared if the ProjectileSystem cannot fire:** RESOLVED. ProjectileSystem now unconditionally clears `fireRequested` at the start of processing each gun, making it a one-frame signal. The property contract explicitly states: "For each gun: unconditionally clear `fireRequested` (it is a one-frame signal). Then check: if `fireRequested` was true..."

**P3-5. DamageOverTime from fire hazard applies damage in HazardSystem, bypassing DamageSystem:** RESOLVED. HazardSystem now emits DamageEvents with `amount = damagePerSecond * dt` each frame, routing fire damage through the standard DamageSystem pipeline. Armor/shields absorb correctly and damage numbers display.

**P3-6. No `Renderable` component on the Gun entity when attached to the player:** RESOLVED. rendering.md now specifies that gun meshes are child objects of the player mesh in the scene graph, managed by the scene manager based on `Player.activeSlot` and `Gun.gunType`. This is explicitly a rendering concern, not an ECS entity concern.

**P3-7. `Projectile.sourceGunSlot` is set on enemy bullets but meaningless:** RESOLVED. The field is now optional (`sourceGunSlot?: WeaponSlot`) with the note "Undefined for enemy projectiles."

**P3-8. No specification for how the crosshair converts screen position to world position for aiming:** RESOLVED. InputSystem properties specify that "InputManager holds a reference to the camera for this conversion," and the conversion is described as raycasting onto the ground plane at y=0.

**P3-9. `maxFrameTime: 0.1` spiral-of-death protection not documented:** RESOLVED. config.md now documents: "If accumulated time exceeds `maxFrameTime`, excess time is discarded (not carried to the next frame). This caps simulation steps at ~6 per real frame... gameplay slows down rather than spiraling. This is the intended behavior."

**P3-10. No run stats tracking mechanism specified:** RESOLVED. The `RunStats` interface is defined in the Zustand store type definitions with `kills`, `depthReached`, `timeSurvived`, `gunsUsed`, and `traitsLeveled`. Tracking responsibilities are assigned: kills by DeathSystem, time by game loop, depth by FloorTransitionSystem.

### Pass 3 Resolution Summary

- **Resolved:** 10 of 10 findings

### Still Open from Prior Passes

- **(Pass 2, #26) Dungeon corridor config sparse:** STILL OPEN. Minor. The dungeon config has `corridorWidth` but no parameters for corridor length, branching, or connectivity. These will emerge during implementation of the generation algorithm. Not blocking.

### New Findings — Pass 4

No new blocking issues found.

No new significant issues found.

The TDD has been thoroughly reviewed across four passes. All blocking and significant issues have been resolved. The one remaining open item (dungeon corridor config parameters) is minor and appropriate to resolve during implementation when the generation algorithm is built.

### Performance Budget Verification

After all changes from pass 3:
- Peak entity count estimate raised to ~700 (particle count corrected to ~300). Still well within ECS budget for a hand-rolled system at this scale.
- Draw call budget unchanged at ~21, well below the 50-call target.
- Collision strategy unchanged. Spatial hash with ~3200 pair checks per frame remains viable.
- No new systems or expensive operations introduced. The fire damage routing change (HazardSystem emitting DamageEvents instead of reducing health directly) adds a small number of events per frame but is negligible.
- All hot path warnings and GC pressure guidance remain valid and actionable.

Performance budget is viable.

---

All blocking and significant issues resolved. TDD approved for ticketing.
