## Issue Review — Run 1

**Date:** 2026-03-07
**Issues reviewed:** 236 (TEMP-001 through TEMP-236)

### Findings

---

**Finding 1 — Check 6 (TDD Coverage): Missing InputSystem ticket**

The TDD `systems.md` defines `InputSystem` as system #1 in the execution order with signature `function inputSystem(inputManager: InputManager): InputState`. The module structure in `overview.md` lists `src/systems/inputSystem.ts` as a distinct file. TEMP-009 creates `src/input/inputManager.ts` and `src/input/inputMapping.ts` but does NOT produce `src/systems/inputSystem.ts`. No other ticket creates this file. The game loop ticket (TEMP-062) lists "Input" as the first system in execution order and depends on TEMP-009, but TEMP-009 produces the InputManager, not the InputSystem wrapper function.

**Severity:** Blocking

**Recommended fix:** Either (a) add a new ticket `[system] InputSystem` that depends on TEMP-009 and produces `src/systems/inputSystem.ts`, or (b) amend TEMP-009 to also produce `src/systems/inputSystem.ts` with the `inputSystem()` function. If (a), add the new ticket to TEMP-062's depends_on list.

---

**Finding 2 — Check 8 (Ticket Completeness): TEMP-010 says "All 11 states" but there are 12**

TEMP-010's acceptance criteria state "All 11 states defined." The TDD `states.md` defines 12 AppState values: Loading, MainMenu, WeaponSelect, Gameplay, Paused, GunComparison, GunUpgrade, ForcedUpgrade, ShopBrowse, Death, Victory, Settings.

**Severity:** Advisory (an implementer reading the TDD will see 12 states and define all 12, but the acceptance criterion is technically wrong and could cause confusion during review)

**Recommended fix:** Change "All 11 states defined" to "All 12 states defined" in TEMP-010 body.

---

**Finding 3 — Check 6 (TDD Coverage): Missing `src/audio/sounds.ts` ticket**

The TDD `overview.md` module structure lists `src/audio/sounds.ts` as "SoundId enum (re-exported from components)". No ticket produces this file. TEMP-005 defines SoundId in `src/ecs/components.ts`, and TEMP-047 (audio manager) depends on TEMP-005. The file is a simple re-export but it exists in the module structure.

**Severity:** Advisory (a re-export file is trivial and could be created by TEMP-047 or TEMP-005 incidentally)

**Recommended fix:** Add a note to TEMP-047's acceptance criteria: "Create `src/audio/sounds.ts` that re-exports SoundId from `src/ecs/components.ts`."

---

**Finding 4 — Check 2 (System Integration): GunStatSystem not in game loop dependencies but called on-demand**

TEMP-062 (game loop) does NOT list TEMP-030 (GunStatSystem) in its depends_on array. The TDD explicitly says GunStatSystem is "called on-demand after upgrades, not every frame." TEMP-055 (GunUpgradeMenu) and TEMP-056 (ForcedUpgradeScreen) both depend on TEMP-030, which is correct — they call GunStatSystem after upgrading. However, TEMP-062's body text says "GunStatSystem called on-demand, not in loop" and lists it in the execution order. This creates ambiguity: the game loop file should import GunStatSystem (or at least know about it) even if it doesn't call it every frame.

**Severity:** Advisory (the on-demand call path through UI tickets is covered, but the game loop file may need to export or re-export it)

**Recommended fix:** No action needed — the UI tickets correctly depend on TEMP-030 and call it directly. The game loop correctly excludes it from per-frame execution.

---

**Finding 5 — Check 5 (Dependency Correctness): TEMP-030 (GunStatSystem) missing dependency on TEMP-006 (ECS World)**

TEMP-030 depends on TEMP-005 (components) and TEMP-004 (design params). But GunStatSystem queries entities with Gun components from the ECS World. It should also depend on TEMP-006 (ECS World) since it needs `World.query()` functionality.

**Severity:** Blocking

**Recommended fix:** Add TEMP-006 to TEMP-030's depends_on array.

---

**Finding 6 — Check 5 (Dependency Correctness): TEMP-062 (game loop) missing dependency on TEMP-009 (input manager)**

TEMP-062's depends_on lists TEMP-012 through TEMP-034, TEMP-046, TEMP-048, TEMP-006, TEMP-007, TEMP-004 — but does NOT include TEMP-009 (input manager). The game loop's first step is `InputSystem` which calls the InputManager. The game loop orchestrator must import and call the input system.

**Severity:** Blocking

**Recommended fix:** Add TEMP-009 to TEMP-062's depends_on array.

---

**Finding 7 — Check 5 (Dependency Correctness): TEMP-062 (game loop) missing dependency on TEMP-010 (app state machine)**

The game loop needs to interact with app state transitions (e.g., DeathSystem transitions to Death state, FloorTransitionSystem transitions to Victory). TEMP-034 (FloorTransitionSystem) and TEMP-023 (DeathSystem) both depend on TEMP-010, but TEMP-062 itself should also depend on TEMP-010 since the game loop orchestrator manages freeze/resume/stop based on state transitions.

**Severity:** Blocking

**Recommended fix:** Add TEMP-010 to TEMP-062's depends_on array.

---

**Finding 8 — Check 3 (Verification Coverage): No verification ticket after the foundation wave**

The dependency graph has a natural "foundation wave" boundary after the setup/component/config tickets (TEMP-001 through TEMP-011) complete. The first verification ticket (TEMP-067) depends on TEMP-063 and TEMP-064, which are deep in the integration wave. There is no earlier verification that the foundation compiles — that ECS world works, components compile, config loads, state machine transitions work. A compile-and-run verification after the foundation wave would catch issues earlier.

**Severity:** Advisory (TEMP-002 establishes the test framework and TEMP-001 verifies build, but there's no explicit verification checkpoint)

**Recommended fix:** Add a verification ticket after the foundation wave (depends on TEMP-001 through TEMP-011) that confirms: `npm run build` succeeds, `npm test` passes, all foundation modules import cleanly.

---

**Finding 9 — Check 7 (Test Spec Coverage): UI tickets lack test_spec fields**

The review instruction says "every `system`, `state`, and `integration` ticket" should have a test_spec. All system and integration tickets have test_spec fields. The state tickets (TEMP-010, TEMP-011) have test_spec fields. However, UI tickets (TEMP-049 through TEMP-061, labeled `ui`) do not have test_spec fields. This is acceptable if `ui` is not considered a `system`, `state`, or `integration` label — and indeed, these tickets are labeled `ui`, not `system`. No finding.

**Status:** Pass — UI tickets are not required to have test_spec per the check definition.

---

**Finding 10 — Check 4 (Asset Completeness): All MeshId values have scaffold + acquire tickets**

Cross-referencing all 37 MeshId enum values from `entities.md`:
- Player (TEMP-071/108), KnifeRusher (072/109), ShieldGun (073/110), Shotgunner (074/111), Rifleman (075/112), SuicideBomber (076/113), MiniBossKnifeRusher (077/114), MiniBossShieldGun (078/115), MiniBossShotgunner (079/116), MiniBossRifleman (080/117), MiniBossSuicideBomber (081/118), Boss (082/119), Pistol (083/120), SMG (084/121), AssaultRifle (085/122), Shotgun (086/123), LMG (087/124), Bullet (088/125), EnemyBullet (089/126), XPGem (090/127), HealthPickup (091/128), Currency (092/129), GunPickupGlow (093/130), Wall (094/131), Floor (095/132), Pit (096/133), FireHazard (097/134), SpikeHazard (098/135), WaterHazard (099/136), Crate (100/137), Pillar (101/138), Barrel (102/139), Door (103/140), Chest (104/141), Shop (105/142), Stairs (106/143), EnemyShieldMesh (107/144).

All 37 MeshId values have both scaffold and acquire tickets.

**Status:** Pass

---

**Finding 11 — Check 4 (Asset Completeness): All SoundId values have scaffold + acquire tickets**

Cross-referencing all 35 SoundId enum values from `entities.md`:
- PistolFire (TEMP-145/181), SMGFire (146/182), AssaultRifleFire (147/183), ShotgunFire (148/184), LMGFire (149/185), Reload (150/186), EmptyClipClick (151/187), Footstep (152/188), DodgeRollWhoosh (153/189), PlayerHitGrunt (154/190), PlayerDeath (155/191), EnemyHitFlesh (156/192), EnemyHitArmor (157/193), EnemyDeath (158/194), KnifeSwing (159/195), EnemyGunshot (160/196), Explosion (161/197), XPGemPickup (162/198), HealthPickup (163/199), CurrencyPickup (164/200), GunPickup (165/201), MenuClick (166/202), MenuHover (167/203), ComparisonScreenOpen (168/204), GunSwapConfirm (169/205), LevelUpNotification (170/206), UpgradeSpent (171/207), Pause (172/208), Unpause (173/209), ChestOpen (174/210), DoorOpen (175/211), DestructibleBreakWood (176/212), DestructibleBreakStone (177/213), DestructibleBreakMetal (178/214), FireAmbient (179/215), WaterAmbient (180/216).

All 35 SoundId values have both scaffold and acquire tickets.

**Status:** Pass

---

**Finding 12 — Check 4 (Asset Completeness): All ParticleEffect values have scaffold + acquire tickets**

Cross-referencing all 10 ParticleEffect enum values from `entities.md`:
- MuzzleFlash (TEMP-217/227), BloodSplat (218/228), Sparks (219/229), Explosion (220/230), XPGemTrail (221/231), BulletImpactWall (222/232), BulletImpactEnemy (223/233), DestructibleDebrisWood (224/234), DestructibleDebrisStone (225/235), DestructibleDebrisMetal (226/236).

All 10 ParticleEffect values have both scaffold and acquire tickets.

**Status:** Pass

---

**Finding 13 — Check 5 (Dependency Correctness): No circular dependencies detected**

I traced the full dependency graph. All dependencies flow forward (higher-numbered tickets depend on lower-numbered tickets, with no backward references). No circular dependencies exist.

**Status:** Pass

---

**Finding 14 — Check 5 (Dependency Correctness): All depends_on references point to existing tickets**

Every depends_on reference across all 236 tickets points to a valid ticket ID within the TEMP-001 to TEMP-236 range. No dangling references.

**Status:** Pass

---

**Finding 15 — Check 6 (TDD Coverage): All systems in systems.md are covered**

Systems in TDD: InputSystem (partially via TEMP-009, see Finding 1), PlayerControlSystem (TEMP-016), DodgeRollSystem (TEMP-017), AISystem (TEMP-024), EnemyWeaponSystem (TEMP-025), MovementSystem (TEMP-012), CollisionDetectionSystem (TEMP-013), CollisionResponseSystem (TEMP-019), DamageSystem (TEMP-020), ShieldRegenSystem (TEMP-021), HazardSystem (TEMP-022), ProjectileSystem (TEMP-018), LifetimeSystem (TEMP-014), PickupSystem (TEMP-026), ChestSystem (TEMP-027), ShopSystem (TEMP-028), GunXPSystem (TEMP-029), GunStatSystem (TEMP-030), DestructibleSystem (TEMP-031), DoorSystem (TEMP-032), SpawnSystem (TEMP-033), FloorTransitionSystem (TEMP-034), DeathSystem (TEMP-023), ExpireModifiersSystem (TEMP-015), ParticleSystem (TEMP-046), AudioEventSystem (TEMP-048).

All 26 systems covered (InputSystem partially — see Finding 1).

**Status:** Pass (with Finding 1 caveat)

---

**Finding 16 — Check 6 (TDD Coverage): All components and enums in entities.md are covered**

TEMP-005 explicitly lists all enums (AppState in TEMP-010, WeaponSlot, GunType, GunCategory, GunTrait, EnemyType, AIBehaviorState, PickupType, HazardType, ColliderShape, ParticleEffect, SoundId, MeshId) and all component interfaces and tag interfaces. TEMP-003 covers Vec3, Vec2, EntityId.

**Status:** Pass

---

**Finding 17 — Check 6 (TDD Coverage): All states in states.md are covered**

All 12 AppState values are covered by UI tickets: Loading (TEMP-049), MainMenu (TEMP-050), WeaponSelect (TEMP-051), Gameplay HUD (TEMP-052), Paused (TEMP-053), GunComparison (TEMP-054), GunUpgrade (TEMP-055), ForcedUpgrade (TEMP-056), Death (TEMP-057), Victory (TEMP-058), Settings (TEMP-059), ShopBrowse (TEMP-060). The state machine itself is TEMP-010.

**Status:** Pass

---

**Finding 18 — Check 6 (TDD Coverage): All config files are covered**

- `config/design-params.json` — TEMP-004
- `config/sound-manifest.json` — TEMP-069
- `config/particle-manifest.json` — TEMP-070

**Status:** Pass

---

**Finding 19 — Check 6 (TDD Coverage): All rendering elements are covered**

- Three.js renderer setup — TEMP-038
- Scene manager and mesh factory — TEMP-039
- Camera controller — TEMP-040
- Instanced renderer — TEMP-041
- Outline mesh helper — TEMP-042
- Screen effects — TEMP-043
- Particle renderer — TEMP-044
- Damage numbers — TEMP-045
- Crosshair — TEMP-061

**Status:** Pass

---

**Finding 20 — Check 6 (TDD Coverage): Dungeon generation fully covered**

- Dungeon data types — TEMP-035
- Room templates — TEMP-036
- Dungeon generator — TEMP-037

**Status:** Pass

---

**Finding 21 — Check 5 (Dependency Correctness): TEMP-025 (EnemyWeaponSystem) missing dependency on TEMP-004 (design params)**

TEMP-025 depends on TEMP-005, TEMP-006, TEMP-008 but not TEMP-004 (design params). EnemyWeaponSystem needs enemy weapon stats (fire rate, projectile speed, etc.) which come from design params indirectly through enemy factories. However, the system itself may need to reference design param values for projectile lifetime (`enemyBulletLifetime` from config). TEMP-008 (factories) depends on TEMP-004, so the params are transitively available, but the system itself reads `projectiles.enemyBulletLifetime` from config when creating bullets.

**Severity:** Advisory (transitive dependency exists via TEMP-008, but direct reference to config values suggests a direct dependency)

**Recommended fix:** Add TEMP-004 to TEMP-025's depends_on array.

---

**Finding 22 — Check 5 (Dependency Correctness): TEMP-024 (AISystem) missing dependency on TEMP-003 (shared types)**

TEMP-024 depends on TEMP-005, TEMP-006, TEMP-004 but not TEMP-003 (shared types: Vec3, Vec2). AISystem computes distances and directions using Vec3/Vec2 types. TEMP-005 depends on TEMP-003, so this is transitively available.

**Severity:** Advisory (transitive dependency covers it)

**Recommended fix:** No action required — transitive dependency is sufficient.

---

**Finding 23 — Check 8 (Ticket Completeness): TEMP-039 (scene manager) acceptance criteria don't mention Crosshair component**

The Crosshair is a React CSS overlay (TEMP-061), not part of the scene manager. This is correct — no finding.

**Status:** Pass

---

**Finding 24 — Check 2 (System Integration): Rendering system sync with entity creation/destruction not explicitly ticketed**

TEMP-063 (wire renderer to ECS) handles syncing mesh positions from ECS each frame. Its acceptance criteria include "Mesh positions synced from ECS each frame" and "Instanced meshes updated." However, the mechanism for creating/destroying Three.js objects when entities are created/destroyed (the object pool lifecycle) is covered by TEMP-039 (scene manager, which manages the object pool). The wiring between ECS entity lifecycle events and scene manager acquire/release calls should be in TEMP-063.

**Severity:** Advisory (TEMP-063 body mentions "Game renders visually when started" which implies entity-to-mesh lifecycle is working)

**Recommended fix:** No action — TEMP-063's scope implicitly covers this.

---

**Finding 25 — Check 8 (Ticket Completeness): TEMP-035 (dungeon data types) has no test_spec**

TEMP-035 is labeled `component` not `system`, so it is not required to have a test_spec per the check definition. However, it is a data-only ticket (type definitions) so no tests are needed beyond TypeScript compilation.

**Status:** Pass

---

**Finding 26 — Check 5 (Dependency Correctness): TEMP-066 (effects/audio wiring) missing dependency on TEMP-007 (event queue)**

TEMP-066 wires event producers to consumers. It depends on TEMP-043-048, TEMP-062, TEMP-063 but not TEMP-007 (event types and event queue). The event queue is the central communication mechanism this ticket wires. TEMP-062 depends on TEMP-007, so it's transitively available.

**Severity:** Advisory (transitive dependency covers it)

**Recommended fix:** No action required.

---

**Finding 27 — Check 6 (TDD Coverage): No ticket for `src/ui/Crosshair.tsx` hiding default cursor during gameplay**

TEMP-061 has acceptance criteria including "Hides default cursor during gameplay." This is covered.

**Status:** Pass

---

**Finding 28 — Check 8 (Ticket Completeness): TEMP-037 (dungeon generator) does not specify how gun types for chest loot are selected**

The dungeon generator places chests per `chestChancePerRoom`, and ChestSystem (TEMP-027) spawns a gun pickup with `chest.gunType`. But how is `gunType` assigned to chests during generation? TEMP-037 says "Chests/shops placed per config probabilities" but doesn't specify the gun type selection logic for chests. The `createChest` factory requires a `gunType` parameter.

**Severity:** Advisory (an implementer would need to decide: random gun type? weighted by depth? The TDD config says v1 guns always have thematic traits and no randomization, so random selection from the 5 gun types is likely intended, but it's not stated.)

**Recommended fix:** Add to TEMP-037's acceptance criteria or body: "Chests contain a random GunType selected uniformly from all 5 types."

---

### Summary

- Total findings: 7 actionable (excluding passes and status-checks)
- Blocking: 3
  - **Finding 1:** Missing InputSystem ticket (or amend TEMP-009 to produce `src/systems/inputSystem.ts`)
  - **Finding 5:** TEMP-030 (GunStatSystem) missing dependency on TEMP-006 (ECS World)
  - **Finding 6:** TEMP-062 (game loop) missing dependency on TEMP-009 (input manager)
  - **Finding 7:** TEMP-062 (game loop) missing dependency on TEMP-010 (app state machine)
- Advisory: 4
  - **Finding 2:** TEMP-010 says "11 states" but there are 12
  - **Finding 3:** Missing `src/audio/sounds.ts` re-export file
  - **Finding 8:** No verification ticket after the foundation wave
  - **Finding 28:** Chest gun type selection logic unspecified in TEMP-037
