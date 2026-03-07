# Systems

All systems are pure functions: take entities with specific components and a delta time, modify component data. No side effects beyond component mutation and event emission.

Systems run in the fixed-timestep game loop at 60Hz.

## System Execution Order

```
1. InputSystem
2. PlayerControlSystem
3. DodgeRollSystem
4. AISystem
5. ProjectileSystem (player firing — before movement so bullets get collision-checked this frame)
6. EnemyWeaponSystem (enemy firing — also before movement)
7. MovementSystem
8. CollisionDetectionSystem
9. CollisionResponseSystem
10. DamageSystem
11. ShieldRegenSystem
12. HazardSystem
13. LifetimeSystem
14. PickupSystem
15. ChestSystem
16. ShopSystem
17. GunXPSystem
18. GunStatSystem (called on-demand after upgrades, not every frame — see below)
19. DestructibleSystem
20. DoorSystem
21. SpawnSystem
22. FloorTransitionSystem
23. DeathSystem
24. ExpireModifiersSystem
25. ParticleSystem
26. AudioEventSystem
```

Note: `GunStatSystem` recalculates gun stats only when trait levels change (after the player spends XP in the upgrade UI). It is called by the upgrade UI action, not by the game loop every frame.

## System Signatures and Property Contracts

### InputSystem

```typescript
function inputSystem(inputManager: InputManager): InputState;
```

Reads raw input from the InputManager (keyboard, mouse, gamepad). Produces a normalized `InputState` consumed by PlayerControlSystem.

```typescript
interface InputState {
  moveX: number;        // -1 to 1
  moveY: number;        // -1 to 1
  aimWorldX: number;    // world-space cursor position
  aimWorldY: number;
  fireSidearm: boolean;
  fireLongArm: boolean;
  reload: boolean;
  dodgeRoll: boolean;
  interact: boolean;
  openUpgrade: boolean;
  pause: boolean;
}
```

**Properties:**
- `moveX` and `moveY` are clamped to [-1, 1] and normalized so diagonal movement doesn't exceed speed 1.
- Mouse position is converted from screen space to world space by the InputManager using the camera's projection matrix (raycasting onto the ground plane at y=0). InputManager holds a reference to the camera for this conversion.
- Gamepad and keyboard inputs produce identical `InputState` — downstream systems cannot distinguish input source.

### PlayerControlSystem

```typescript
function playerControlSystem(
  player: QueryResult<Player, Position, Velocity, Rotation, DodgeRoll>,
  input: InputState,
  dt: number
): void;
```

Translates InputState into player entity changes.

**Properties:**
- If `input.fireSidearm` and sidearm has ammo and is not reloading and fire cooldown <= 0: set `activeSlot = Sidearm`, set a `fireRequested` flag on the sidearm gun. ProjectileSystem reads this flag.
- If `input.fireLongArm` and long arm has ammo and is not reloading and fire cooldown <= 0: set `activeSlot = LongArm`, set a `fireRequested` flag on the long arm gun. ProjectileSystem reads this flag.
- If `input.reload`: start reload on active gun (set `isReloading = true`, `reloadTimer = gun.reloadTime`).
- If `input.dodgeRoll` and `dodgeRoll.cooldownRemaining <= 0` and not already rolling: initiate dodge roll.
- Player base velocity = normalized(moveX, moveY) * movementSpeed (from design params).
- If entity has `SpeedModifier`: velocity is multiplied by `speedModifier.multiplier`.
- Player rotation.y = atan2(aimWorldY - position.y, aimWorldX - position.x).
- If player is rolling, velocity is overridden by roll direction * roll speed.
- `input.interact` is read directly by downstream systems (PickupSystem, ChestSystem, ShopSystem, FloorTransitionSystem). No event emitted.
- If `input.openUpgrade`: check if active gun has enough XP for any trait upgrade → if yes, transition to `GunUpgrade` state.
- If `input.pause`: transition to `Paused` state.

### DodgeRollSystem

```typescript
function dodgeRollSystem(
  entities: QueryResult<DodgeRoll, Velocity, Position>,
  dt: number
): void;
```

**Properties:**
- While `isRolling`: velocity = rollDirection * rollSpeed, entity has Invincible component added.
- `rollTimer` decrements by dt each frame. When rollTimer <= 0: `isRolling = false`, remove Invincible component.
- `cooldownRemaining` decrements by dt each frame (even when not rolling). Cannot initiate roll while cooldownRemaining > 0.
- On roll start: `cooldownRemaining` = dodgeRollCooldown (design param), `rollTimer` = dodgeRollDuration (design param).
- Roll direction is the movement direction at time of initiation. If no movement input, roll in facing direction.

### AISystem

```typescript
function aiSystem(
  enemies: QueryResult<Enemy, AIState, Position, Velocity, Rotation>,
  playerPos: Position,
  dt: number
): void;
```

Sets the Velocity component on enemy entities based on AI decisions. MovementSystem then integrates Velocity into Position. AISystem does not modify Position directly.

**Per-type behavior:**

**KnifeRusher:** `Idle → Chase (player in detection range) → Attack (in melee range) → Chase (player moves away)`
- Chase: velocity toward player at enemy speed.
- Attack: deal contact damage, brief cooldown.

**ShieldGun:** `Idle → Chase (player in detection range) → Attack (in firing range)`
- Chase: move toward player, shield faces player.
- Attack: stop moving, fire at player from behind shield. Shield blocks frontal damage.

**Shotgunner:** `Idle → Chase (player detected) → Attack (in medium range)`
- Chase: approach player.
- Attack: fire spread shot, brief cooldown, may retreat if player too close.

**Rifleman:** `Idle → Chase (player detected) → Attack (in long range)`
- Attack: fire accurate single shot. Stays at distance.

**SuicideBomber:** `Idle → Chase (always, once player detected)`
- Chase: sprint at player at high speed.
- On contact with player OR on death: explode (area damage centered on self).

**Boss:** Same state machine as the base enemy type it derives from, with higher stats and potentially faster transitions.

**Properties:**
- Every enemy with AIState gets exactly one state update per frame.
- No AI decision targets a dead entity (health <= 0).
- Detection range, attack range, and speeds are per-type design params scaled by depth.
- AI state transitions are deterministic given the same inputs.
- `attackCooldown` decrements by dt. Cannot attack while > 0.
- Enemies ignore hazards (they walk through fire and water unaffected — design decision for v1 simplicity).

### EnemyWeaponSystem

```typescript
function enemyWeaponSystem(
  enemies: QueryResult<Enemy, EnemyWeapon, AIState, Position, Rotation>,
  world: World,
  dt: number
): void;
```

Handles enemy ranged attacks — firing projectiles based on EnemyWeapon component data.

**Properties:**
- `fireCooldown -= dt` per enemy weapon. Cannot fire while > 0.
- When AI state is `Attack` and `fireCooldown <= 0`: spawn enemy bullet(s) from the enemy's position toward their facing direction.
- Shotgunner: spawns `projectileCount` bullets with random spread within `spread` angle.
- Rifleman/ShieldGun: spawns 1 bullet with minimal spread.
- `fireCooldown` reset to `1 / fireRate` after firing.
- Spawned projectiles use `createEnemyBullet` factory. They get `EnemyProjectileTag`.

### MovementSystem

```typescript
function movementSystem(
  entities: QueryResult<Position, PreviousPosition, Velocity>,
  dt: number
): void;
```

**Properties:**
- Before updating position, copy current position to `PreviousPosition` (for render interpolation).
- After running: for every entity with Position and Velocity, `position.x += velocity.x * dt`, `position.y += velocity.y * dt`, `position.z += velocity.z * dt`.
- Entities without Velocity are not moved.

### CollisionDetectionSystem

```typescript
function collisionDetectionSystem(
  entities: QueryResult<Position, Collider>
): CollisionPair[];

interface CollisionPair {
  entityA: EntityId;
  entityB: EntityId;
  overlapX: number;
  overlapY: number;
}
```

**Properties:**
- Uses spatial hash grid. Static colliders (walls, hazards) are inserted once at level load, not per frame.
- Every pair of entities whose AABBs overlap appears in the output. No false negatives.
- Trigger colliders produce pairs but are not pushed apart by response.
- Order within pairs is deterministic (lower EntityId first).

### CollisionResponseSystem

```typescript
function collisionResponseSystem(
  pairs: CollisionPair[],
  world: World
): void;
```

Interprets collision pairs based on component composition and emits game events or sets flags. Does NOT handle pickup collection logic — only sets flags and emits events for other systems.

**Response table:**

| Entity A | Entity B | Response |
|----------|----------|----------|
| Player | Wall | Push player out of wall (position correction along axis of minimum overlap) |
| Player | Enemy | Push apart (position correction). If enemy is KnifeRusher/SuicideBomber in Attack state and player not Invincible: emit DamageEvent. |
| Player | EnemyProjectile | If not Invincible: emit DamageEvent(player, projectile.damage); destroy projectile |
| Player | Pickup (XPGem, in collection range) | Set `xpGem.isFlying = true` |
| Player | Pickup (Health/Currency/GunPickup) | Set flag: `nearPickup = true` (interact handled by PickupSystem) |
| Player | Hazard (Fire) | Apply or refresh `DamageOverTime` component on player. Set `refreshed = true`. |
| Player | Hazard (Spikes) | Emit DamageEvent(player, spikeDamage) — respects spike cooldown |
| Player | Hazard (Water) | Apply or refresh `SpeedModifier` component on player with water multiplier. Set `refreshed = true`. |
| Player | Door | Emit DoorInteract event |
| Player | Chest | Set flag: `nearChest = true` (interact handled by ChestSystem) |
| Player | Shop | Set flag: `nearShop = true` (interact handled by ShopSystem) |
| Player | Stairs | Set flag: `nearStairs = true` (interact handled by FloorTransitionSystem) |
| Player | SpawnZone | If `!spawnZone.activated`: activate spawn zone |
| PlayerProjectile | Enemy | Emit DamageEvent(enemy, projectile.damage); apply knockback. If enemy has EnemyShield: compute angle between projectile's incoming direction and shield's `facingAngle`; if angle is within `coverageArc`, damage goes to `enemyShield.health` instead (emit Sparks particle, EnemyHitArmor sound); if shield health <= 0, remove EnemyShield component. Handle piercing: decrement `piercingRemaining`, add to `alreadyHit`. Handle bouncing on enemy hit: if `bouncesRemaining > 0`, deal damage, reflect velocity away from enemy center, decrement bounces, add to `alreadyHit`. |
| PlayerProjectile | Wall | Destroy projectile. If `bouncesRemaining > 0`: reflect velocity, decrement bounces instead of destroying. |
| PlayerProjectile | Destructible | Emit DamageEvent(destructible, projectile.damage); destroy projectile (or pierce if piercing > 0). |
| EnemyProjectile | Player | (Same as Player + EnemyProjectile, handled above) |
| EnemyProjectile | Wall | Destroy projectile. |
| EnemyProjectile | Destructible | Destroy projectile. Destructibles block enemy bullets but take no damage from them (design decision — only player can destroy cover). |
| Enemy | Wall | Push enemy out of wall. |
| Enemy | Enemy | Push apart (no damage — no friendly fire). |
| SuicideBomber contact (alive) | Player | Trigger explosion: query all entities with Health within `explosionRadius` of bomber position, emit DamageEvent for each. Emit ParticleEvent(Explosion) and AudioEvent(Explosion). Set bomber `health.current = 0` and set `hasExploded = true` flag on the Enemy component. Do NOT destroy — let DeathSystem handle loot drops. DeathSystem checks `hasExploded` to skip redundant explosion. |
| PlayerProjectile | Player | No effect. Player is immune to own projectiles (bouncing bullets cannot self-damage). |

**Properties:**
- Every collision pair is handled exactly once per frame.
- Push-out for solid colliders resolves along the axis of minimum overlap.
- Trigger colliders never produce push-out corrections.
- Projectiles with piercing > 0 are not destroyed on hit; piercingRemaining decrements. Projectile tracks alreadyHit to prevent double-damage.
- Projectiles with bouncing > 0 reflect velocity on wall hit; bouncesRemaining decrements.
- Invincible entities take no damage from any source.

**Explosion mechanism:** When a SuicideBomber triggers an explosion (contact with player OR health <= 0 detected by DeathSystem), the system performs a radius query: iterate all entities with Health component, check if distance to explosion center <= `explosionRadius` (from design params). For each entity in range, emit a DamageEvent with the bomber's damage value.

### DamageSystem

```typescript
function damageSystem(
  events: DamageEvent[],
  entities: QueryResult<Health>,
  world: World
): void;
```

**Properties:**
- For each DamageEvent: reduce target's `health.current` by `event.amount`. Clamp at 0.
- If entity has Armor: damage reduces armor first, remainder goes to health.
- If entity has Shield and `shield.current > 0`: damage reduces shield first, reset `timeSinceLastHit` to 0. Remainder passes to armor, then health. If `shield.current === 0`, shield component is ignored for damage routing (no regen delay reset).
- Critical hits are pre-calculated by the ProjectileSystem — DamageSystem just applies the amount.
- If the DamageEvent's `source` entity has a Projectile component with `isEnemyProjectile === false`: write `projectile.sourceGunSlot` to `target.health.lastDamageSourceGunSlot`. This survives projectile destruction — DeathSystem reads it from the dying entity, not from the projectile.
- Emit ParticleEvent (BloodSplat for enemies, Sparks for destructibles) at impact position.
- Emit AudioEvent for hit sound (EnemyHitFlesh or EnemyHitArmor depending on whether shield/armor absorbed).
- Emit DamageNumberEvent (amount, position, isCritical).

### ShieldRegenSystem

```typescript
function shieldRegenSystem(
  entities: QueryResult<Shield>,
  dt: number
): void;
```

**Properties:**
- `timeSinceLastHit += dt`.
- If `timeSinceLastHit >= regenDelay` and `current < max`: `current += regenRate * dt`, clamped to max.

### HazardSystem

```typescript
function hazardSystem(
  entities: QueryResult<DamageOverTime, Health>,
  dt: number
): void;
```

**Properties:**
- For entities with DamageOverTime: emit a DamageEvent with `amount = damagePerSecond * dt` each frame. This routes fire damage through the standard DamageSystem pipeline, ensuring armor/shields absorb correctly and damage numbers display.
- DamageOverTime has a `refreshed` flag. Each frame, after emitting the event, set `refreshed = false`. The CollisionResponseSystem sets `refreshed = true` while the entity overlaps the hazard. ExpireModifiersSystem removes DamageOverTime components where `refreshed === false`.

### ProjectileSystem

```typescript
function projectileSystem(
  guns: QueryResult<Gun>,
  players: QueryResult<Player, Position, Rotation>,
  world: World,
  dt: number
): void;
```

Handles player gun firing, reload timers, and player projectile spawning. Enemy firing is handled by EnemyWeaponSystem. Runs BEFORE MovementSystem so spawned bullets get collision-checked in the same frame.

**Properties:**
- `fireCooldown -= dt` each frame per gun. Cannot fire while > 0.
- For each gun: unconditionally clear `fireRequested` (it is a one-frame signal). Then check: if `fireRequested` was true and `fireCooldown <= 0` and `currentAmmo > 0` and not reloading: fire.
- On fire: `fireCooldown = 1 / fireRate`. `currentAmmo -= 1`.
- If `currentAmmo <= 0` and fire attempted: play empty click sound, start reload.
- Reload: `reloadTimer -= dt`. When <= 0: `currentAmmo = magazineSize`, `isReloading = false`.
- On fire: spawn `projectileCount` bullet entities via `createPlayerBullet`. Each bullet gets:
  - Position: player position + gun offset
  - Velocity: aim direction * projectileSpeed, with random spread within `spread` angle
  - Damage: gun.damage. Roll crit: if random() < critChance, damage *= critMultiplier, mark isCritical.
  - `sourceGunSlot`: the WeaponSlot that fired (for XP gem attribution on kill).
  - Piercing/Bouncing from gun trait levels.
- Both guns' reload timers tick simultaneously. Reloading continues even when gun is not active.

### LifetimeSystem

```typescript
function lifetimeSystem(
  entities: QueryResult<Lifetime>,
  world: World,
  dt: number
): void;
```

**Properties:**
- `remaining -= dt`. When <= 0: destroy entity.
- Used for projectiles (despawn after max range/time), particles, temporary effects.

### PickupSystem

```typescript
function pickupSystem(
  pickups: QueryResult<Pickup, Position>,
  player: QueryResult<Player, Position>,
  input: InputState,
  world: World,
  dt: number
): void;
```

Handles the actual collection logic for pickups. CollisionResponseSystem sets proximity flags; PickupSystem acts on them.

**Properties:**
- XP gems with `isFlying = true`: move toward player at gem fly speed (design param). On contact with player: find the gun entity matching `sourceGunEntityId`. If that entity no longer exists (gun was swapped out), fall back to the gun currently in the same slot (determined by comparing the original gun's category). Add `amount` to that gun's XP, destroy gem, emit AudioEvent(XPGemPickup).
- Health pickups: if player is near (flag set by CollisionResponse) and interact pressed: heal player by `healAmount` (clamped to max), destroy pickup, emit AudioEvent(HealthPickup).
- Currency: if near and interact pressed: add `amount` to player.currency, destroy pickup, emit AudioEvent(CurrencyPickup).
- Gun pickups: if near and interact pressed: transition to `GunComparison` state with this gun entity's data.

### ChestSystem

```typescript
function chestSystem(
  chests: QueryResult<Chest, Position>,
  player: QueryResult<Player, Position>,
  input: InputState,
  world: World
): void;
```

**Properties:**
- If player is near a chest (flag from CollisionResponse) and interact pressed and `!chest.isOpen`: set `chest.isOpen = true`, spawn a GunPickup entity at the chest position with the chest's `gunType`. Emit AudioEvent(ChestOpen). Update mesh to open state.

### ShopSystem

```typescript
function shopSystem(
  shops: QueryResult<Shop, Position>,
  player: QueryResult<Player, Position>,
  input: InputState,
  world: World
): void;
```

**Properties:**
- If player is near a shop (flag from CollisionResponse) and interact pressed: transition to `ShopBrowse` state. Store `activeShopEntityId` in Zustand.
- Purchase logic runs in the ShopBrowse UI (React component). On purchase: if player.currency >= item.price and `!item.sold`: deduct currency, apply item effect (heal player directly), mark `item.sold = true`, emit AudioEvent.
- v1 shops only sell health pickups.

### GunXPSystem

```typescript
function gunXPSystem(
  player: QueryResult<Player>,
  world: World
): void;
```

Checks if any gun has enough XP for forced upgrade.

**Properties:**
- For each gun in player's slots: calculate max trait upgrade cost across all 3 traits (using current trait levels). If `gun.xp >= maxCost` and `gun.forcedUpgradeTriggered === false`: set `gun.forcedUpgradeTriggered = true`, transition to `ForcedUpgrade` state.
- After the player spends XP in the ForcedUpgrade screen (reducing gun.xp below the threshold), `forcedUpgradeTriggered` is reset to `false` (done by the upgrade UI action).

### GunStatSystem

```typescript
function gunStatSystem(
  guns: QueryResult<Gun>
): void;
```

Recalculates computed gun stats from base stats + trait levels.

**Properties:**
- For each trait at level L: look up the bonus per level from design params. Apply to the corresponding computed stat.
- `damage = baseDamage + traitBonus(Damage, level)` (if Damage is one of the gun's traits).
- Stats not covered by a trait use the base value.
- `magazineSize` is rounded to nearest integer after bonus.
- `reloadTime` is clamped to minimum 0.2 seconds.
- Called whenever trait levels change (after upgrade), not every frame.

### DestructibleSystem

```typescript
function destructibleSystem(
  entities: QueryResult<Destructible, Position>,
  world: World
): void;
```

**Properties:**
- When `health <= 0`: destroy entity, emit ParticleEvent (DestructibleDebrisWood/Stone/Metal based on MeshId), emit AudioEvent (DestructibleBreakWood/Stone/Metal), remove collider from spatial hash.

### DoorSystem

```typescript
function doorSystem(
  doors: QueryResult<Door, Position, Collider>,
  events: DoorInteractEvent[],
  dt: number
): void;
```

**Properties:**
- On DoorInteract event for a closed door: set `isOpen = true`, change collider to trigger (no longer blocks movement), emit AudioEvent(DoorOpen).
- Doors stay open permanently once opened.

### SpawnSystem

```typescript
function spawnSystem(
  spawnZones: QueryResult<SpawnZone, Position>,
  world: World,
  depth: number
): void;
```

Spawns enemies when a SpawnZone is activated by player overlap.

**Properties:**
- When a SpawnZone has `activated === true` and `spawnedEnemies` is empty (first frame after activation): create enemy entities at random positions within the zone bounds. Enemy types and count come from the SpawnZone component. Store created entity IDs in `spawnedEnemies`.
- Enemy stats are scaled by depth using the depth scaling formula from design params.
- Mini-bosses: if `random() < miniBossChancePerRoom` (design param), one enemy in the zone is created with `isMini = true` and scaled-up stats.
- Each frame for activated zones: check if all entities in `spawnedEnemies` are dead (health <= 0 or destroyed). If yes, set `cleared = true`. This flag can be used by DoorSystem to keep doors locked until a room is cleared.

### FloorTransitionSystem

```typescript
function floorTransitionSystem(
  stairs: QueryResult<Stairs, Position>,
  player: QueryResult<Player, Position>,
  input: InputState,
  world: World,
  depth: { current: number }
): void;
```

**Properties:**
- If player is near stairs (flag from CollisionResponse) and interact pressed: destroy all entities except player, increment `depth.current`, generate new dungeon for new depth, spawn entities from new dungeon data, place player at start position of new floor.
- If `depth.current === bossFloorDepth` (design param): generate boss floor with a Boss entity instead of normal enemies.
- If boss is killed (detected by DeathSystem checking BossTag): transition to `Victory` state.

### DeathSystem

```typescript
function deathSystem(
  entities: QueryResult<Health, Position>,
  world: World
): void;
```

Handles entity death when health reaches 0.

**Properties:**
- For enemies with health <= 0:
  - Determine which gun killed them: read `health.lastDamageSourceGunSlot` (written by DamageSystem). Use this to find the gun entity in the player's corresponding slot.
  - Spawn XP gem via `createXPGem(position, gunEntityId, xpDropAmount)`.
  - Roll currency drop: if `random() < currencyDropChance` (per enemy type from design params), spawn currency pickup.
  - Roll health pickup drop: if `random() < healthPickupDropChance` (design param), spawn health pickup at enemy position.
  - Emit ParticleEvent (BloodSplat or Explosion for bombers).
  - Emit AudioEvent (EnemyDeath or Explosion for bombers).
  - Destroy entity.
- For suicide bombers with health <= 0: check `enemy.hasExploded`. If false (killed by gunfire, not contact): trigger explosion — radius query for area damage, emit ParticleEvent(Explosion) and AudioEvent(Explosion). If true (already exploded via CollisionResponseSystem contact): skip explosion. In both cases, proceed with standard loot drops (XP gems, currency, health pickup roll) and then destroy entity.
- For enemies with BossTag and health <= 0: transition to `Victory` state.
- For player with health <= 0: transition to `Death` state.

### ExpireModifiersSystem

```typescript
function expireModifiersSystem(
  entities: QueryResult<DamageOverTime | SpeedModifier>
): void;
```

**Properties:**
- For each entity with `DamageOverTime` where `refreshed === false`: remove the DamageOverTime component.
- For each entity with `SpeedModifier` where `refreshed === false`: remove the SpeedModifier component.
- This runs AFTER CollisionResponseSystem (which refreshes active overlaps) and AFTER HazardSystem (which applies damage). It cleans up modifiers from hazards the entity has left.

### ParticleSystem

```typescript
function particleSystem(
  events: ParticleEvent[],
  world: World,
  dt: number
): void;
```

Manages particle effects. Data-driven — reads particle definitions from `config/particle-manifest.json`.

**Properties:**
- Each ParticleEvent specifies a `ParticleEffect` enum value and position. System spawns particles per the manifest definition.
- Active particles update position, size, opacity per frame. Remove when lifetime expires.
- Particle effects are visual only — no gameplay impact.

### AudioEventSystem

```typescript
function audioEventSystem(
  events: AudioEvent[],
  audioManager: AudioManager
): void;
```

**Properties:**
- Each AudioEvent specifies a `SoundId` enum value and optional position. System calls `audioManager.play(soundId)`.
- AudioManager handles pooling, volume, pitch variation per the sound manifest.
- Looping sounds (FireAmbient, WaterAmbient) are started/stopped based on proximity, not re-triggered per frame.

## Event Types

```typescript
interface DamageEvent {
  target: EntityId;
  amount: number;
  source: EntityId;
  isCritical: boolean;
  impactPosition: Vec3;
}

interface ParticleEvent {
  effect: ParticleEffect;
  position: Vec3;
}

interface AudioEvent {
  sound: SoundId;
  position?: Vec3;
}

interface DamageNumberEvent {
  amount: number;
  position: Vec3;
  isCritical: boolean;
}

interface DoorInteractEvent {
  doorEntity: EntityId;
}
```

## System Dependencies

```
InputSystem → PlayerControlSystem → DodgeRollSystem
AISystem (reads player position)
EnemyWeaponSystem (reads AIState, creates enemy bullets)
MovementSystem (reads Velocity set by PlayerControl, AI, PickupSystem)
CollisionDetectionSystem (reads Position set by Movement)
CollisionResponseSystem (reads collision pairs, sets flags/emits events)
DamageSystem (reads DamageEvents from CollisionResponse)
HazardSystem (reads DamageOverTime applied by CollisionResponse)
ProjectileSystem (reads Gun state, creates player bullets)
LifetimeSystem (reads Lifetime)
PickupSystem (reads flags from CollisionResponse, input)
ChestSystem (reads flags from CollisionResponse, input)
ShopSystem (reads flags from CollisionResponse, input)
GunXPSystem (reads gun XP after pickup collection)
GunStatSystem (reads trait levels after upgrades)
DestructibleSystem (reads Health after damage)
DoorSystem (reads DoorInteractEvents)
SpawnSystem (reads SpawnZone activation from CollisionResponse)
FloorTransitionSystem (reads flags from CollisionResponse, input)
DeathSystem (reads Health after damage, triggers Victory/Death states)
ExpireModifiersSystem (cleans up un-refreshed DamageOverTime/SpeedModifier)
ParticleSystem (reads ParticleEvents from Damage, Death, Destructible)
AudioEventSystem (reads AudioEvents from all systems)
```

No circular dependencies. All data flows forward through the execution order.

## Performance Budget

This section is included in every system and integration agent's prompt so they build to the right scale.

### Peak Entity Counts

| Entity Type | Expected Peak Count | Notes |
|-------------|-------------------|-------|
| Player | 1 | Always exactly 1 |
| Enemies | ~40 | 8 rooms × 5 avg enemies; not all active simultaneously |
| Player bullets | ~30 | LMG at max fire rate, short lifetime |
| Enemy bullets | ~20 | 3-4 ranged enemies firing simultaneously |
| XP gems | ~50 | Burst after clearing a room, then collected |
| Pickups (health/currency/guns) | ~10 | Sparse |
| Walls | ~200 | Per floor, static |
| Hazards | ~30 | Per floor, static |
| Destructibles | ~20 | Per floor |
| Particles | ~300 | Muzzle flash, impacts, explosions — worst case with shotgun + multiple enemies |
| **Total peak** | **~700** | |

### Collision Strategy

With ~500 entities peak and ~230 static (walls, hazards), spatial hash grid is the right approach:
- Static geometry inserted once at level load.
- Dynamic entities (~270) re-inserted each frame.
- Cell size: 2× the largest dynamic collider dimension.
- Expected collision checks per frame: ~270 dynamic entities × ~4 neighboring cells × ~3 entities per cell ≈ ~3200 pair checks. Well within budget at 60Hz.
- Brute-force fallback: even 270² = 72,900 checks would be fast enough on modern hardware, but spatial hash avoids scaling problems if enemy counts increase.

### Systems Per Frame

**Every frame (26 systems):** All systems in the execution order run every fixed timestep (60Hz). At ~500 entities, this is comfortably within budget.

**Throttled:** None in v1. AI could be throttled to every 5-10 frames for expensive pathfinding, but v1 AI is simple state machines (O(1) per enemy per frame). No throttling needed.

**On-demand only:** GunStatSystem (runs only after trait upgrades, not every frame).

### Known Hot Paths

1. **CollisionDetectionSystem:** Most expensive system. Spatial hash keeps it linear in entity count. Watch for: regenerating the hash every frame for dynamic entities.
2. **Instanced rendering updates:** Updating instance matrices for bullets/enemies/pickups every render frame. Use typed arrays and bulk matrix updates, not per-instance Three.js API calls.
3. **Particle system:** At peak (explosions + combat), ~100 particles. Instanced mesh handles this. Watch for: creating/destroying Three.js objects per particle (use pool).
4. **GC pressure:** Hot loops (movement, collision) must not allocate. Reuse Vec3 scratch objects. No `new` in per-frame system code.

### Draw Call Budget

Target: < 50 draw calls.
- Walls: 1 instanced draw call
- Floor: 1 instanced draw call
- Per enemy type: 1 instanced draw call × 5 types = 5
- Bullets (player): 1 instanced draw call
- Bullets (enemy): 1 instanced draw call
- Pickups per type: 1 × 4 = 4
- Hazards per type: 1 × 3 = 3
- Destructibles: 1 instanced draw call
- Player: 1
- Particles: 1 instanced draw call
- Lights: 2
- **Total: ~21 draw calls** — well within budget.
