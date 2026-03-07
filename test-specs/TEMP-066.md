# Test Spec: TEMP-066 — Wire effects and audio pipeline

## Properties (must ALWAYS hold)
- Every DamageEvent processed by DamageSystem emits both a ParticleEvent and an AudioEvent. No damage is silent or invisible.
- Every enemy death processed by DeathSystem emits a ParticleEvent and an AudioEvent. No death is silent.
- ParticleEvents produce visible particle instances in the ParticleSystem. No event is silently dropped.
- AudioEvents produce sound playback via AudioManager. No event is silently dropped (subject to maxInstances pooling).
- Looping ambient sounds (FireAmbient, WaterAmbient) are started on proximity enter and stopped on proximity exit — never re-triggered per frame.
- Screen shake intensity decays exponentially by `shakeDamping` per frame. It never increases without a new trigger.
- DamageNumberEvents produce floating text sprites at the correct world position with the correct amount.

## Scenarios

### Scenario: Player bullet hits enemy — full effect chain
- **Given:** A player bullet collides with a KnifeRusher enemy. The bullet deals 15 damage (non-critical).
- **When:** CollisionResponseSystem emits DamageEvent. DamageSystem processes it.
- **Then:** DamageSystem emits ParticleEvent(BloodSplat) at the impact position. DamageSystem emits AudioEvent(EnemyHitFlesh). DamageSystem emits DamageNumberEvent(15, impactPosition, isCritical=false). The particle renderer spawns BloodSplat particles per the particle manifest (count, lifetime, speed, color). AudioManager plays EnemyHitFlesh with pitch variation. A white damage number "15" appears at the impact position and drifts upward.
- **Why:** Any break in this chain (missing event emission, dropped event consumption, wrong effect type) makes combat feel unresponsive.

### Scenario: Critical hit produces enhanced effects
- **Given:** A player bullet deals a critical hit (isCritical=true, damage=30).
- **When:** DamageSystem processes the DamageEvent.
- **Then:** DamageNumberEvent has isCritical=true. The damage number is rendered in yellow and scaled by critScale (1.5x). A hit flash (screen white overlay) is triggered with duration=0.08s and opacity=0.4.
- **Why:** If critical hits look identical to normal hits, the player cannot tell their build is working. Missing hit flash removes the visceral feedback.

### Scenario: Enemy death produces particles and sound
- **Given:** A Shotgunner enemy has health reduced to 0 by a player bullet.
- **When:** DeathSystem processes the dead entity.
- **Then:** ParticleEvent(BloodSplat) is emitted at the enemy's position. AudioEvent(EnemyDeath) is emitted. XP gem, potential currency, and potential health pickup are spawned. The enemy entity is destroyed.
- **Why:** Silent, invisible deaths make the player unsure if they killed the enemy or if it escaped.

### Scenario: Suicide bomber explosion produces explosion effects
- **Given:** A SuicideBomber contacts the player. CollisionResponseSystem triggers the explosion.
- **When:** The explosion is processed.
- **Then:** ParticleEvent(Explosion) is emitted at the bomber's position. AudioEvent(Explosion) is emitted. Screen shake is triggered with explosionIntensity (0.6). Hit flash is triggered. DamageEvents are emitted for all entities within explosionRadius (3.0 units).
- **Why:** Explosions are high-impact moments. Missing any effect (particles, sound, shake, flash) makes them feel weak.

### Scenario: Suicide bomber killed by gunfire also explodes
- **Given:** A SuicideBomber is killed by player bullets (health <= 0, hasExploded=false).
- **When:** DeathSystem processes the dead bomber.
- **Then:** DeathSystem triggers the explosion (radius damage, ParticleEvent(Explosion), AudioEvent(Explosion), screen shake). Then proceeds with normal death loot drops. hasExploded is not checked as true (it was false — bomber died from gunfire, not contact).
- **Why:** If gunfire-killed bombers don't explode, the player can safely ignore the explosion mechanic by sniping them.

### Scenario: Suicide bomber contact explosion does not double-explode on death
- **Given:** A SuicideBomber contacts the player. CollisionResponseSystem sets hasExploded=true and triggers the explosion.
- **When:** DeathSystem processes the bomber (health set to 0 by collision response).
- **Then:** DeathSystem checks hasExploded=true and skips the explosion. Only loot drops and entity destruction occur. No second ParticleEvent(Explosion) or AudioEvent(Explosion).
- **Why:** Double explosion deals double damage to nearby entities and produces jarring duplicate sound/particle effects.

### Scenario: Player takes damage — screen shake and vignette
- **Given:** Player has health=80/100. An enemy bullet hits the player for 20 damage.
- **When:** DamageSystem processes the DamageEvent with target=player.
- **Then:** Screen shake is triggered with playerHitIntensity (0.3). AudioEvent(PlayerHitGrunt) is emitted. Health drops to 60/100. Since 60/100 > healthThreshold (0.25), no damage vignette.
- **Why:** Without screen shake on player hits, damage feels inconsequential.

### Scenario: Low health triggers damage vignette
- **Given:** Player has health=30/100. Player takes 10 damage, reducing health to 20/100.
- **When:** The render system checks player health.
- **Then:** 20/100 = 0.20, which is below healthThreshold (0.25). The red damage vignette overlay activates, pulsing at pulseSpeed (2.0 Hz).
- **Why:** Without the vignette, the player doesn't realize they're about to die until the death screen appears.

### Scenario: Damage vignette deactivates when healed above threshold
- **Given:** Player has health=20/100 (vignette active). Player picks up a health pickup for 30 HP.
- **When:** Health increases to 50/100.
- **Then:** 50/100 = 0.50, which is above healthThreshold. The damage vignette deactivates.
- **Why:** A persistent vignette after healing creates false urgency and obscures vision unnecessarily.

### Scenario: Screen shake decays over time
- **Given:** Screen shake was triggered with intensity 0.6 (explosion). shakeDamping=0.9.
- **When:** 5 render frames pass with no new shake triggers.
- **Then:** Intensity decays: 0.6, 0.54, 0.486, 0.4374, 0.3937. Camera offset magnitude decreases each frame. After sufficient frames, intensity approaches 0 and camera stabilizes.
- **Why:** Without decay, a single explosion causes permanent screen shake. Without exponential decay (e.g., linear), the shake lingers too long or cuts off abruptly.

### Scenario: Multiple screen shake sources stack correctly
- **Given:** Screen shake is at intensity 0.3 (player hit). An explosion occurs, adding intensity 0.6.
- **When:** The shake system processes the new trigger.
- **Then:** Shake intensity becomes 0.3 + 0.6 = 0.9 (additive). It then decays from 0.9 with damping.
- **Why:** If shakes don't stack, simultaneous damage and explosion feels less impactful than either alone. If shakes multiply instead of add, values explode.

### Scenario: Destructible break produces type-specific effects
- **Given:** A Crate destructible (meshId=Crate) has health reduced to 0.
- **When:** DestructibleSystem processes the destruction.
- **Then:** ParticleEvent(DestructibleDebrisWood) is emitted at the crate's position. AudioEvent(DestructibleBreakWood) is emitted. The entity is destroyed and its collider is removed from the spatial hash.
- **Why:** If all destructibles use the same particle/sound regardless of type, a stone pillar producing wood splinters breaks immersion.

### Scenario: Pillar destruction uses stone effects
- **Given:** A Pillar destructible (meshId=Pillar) is destroyed.
- **When:** DestructibleSystem processes it.
- **Then:** ParticleEvent(DestructibleDebrisStone) and AudioEvent(DestructibleBreakStone) are emitted.
- **Why:** Validates that the MeshId-to-effect mapping covers all destructible types, not just the first one implemented.

### Scenario: Fire hazard proximity starts ambient loop
- **Given:** Player is not near any fire hazard. FireAmbient sound is not playing.
- **When:** Player moves within proximity of a Fire hazard (CollisionResponseSystem applies DamageOverTime).
- **Then:** AudioManager starts playing FireAmbient as a looping sound. The sound continues playing without retriggering each frame.
- **Why:** Retriggering a looping sound per frame causes audio stacking — 60 overlapping instances per second.

### Scenario: Fire hazard proximity exit stops ambient loop
- **Given:** Player is overlapping a Fire hazard. FireAmbient is playing.
- **When:** Player moves away from the fire. ExpireModifiersSystem removes DamageOverTime (refreshed=false).
- **Then:** AudioManager stops the FireAmbient looping sound.
- **Why:** A fire sound that plays forever after first contact is disorienting and masks other audio cues.

### Scenario: Water hazard proximity controls WaterAmbient
- **Given:** Player enters a Water hazard area.
- **When:** CollisionResponseSystem applies SpeedModifier.
- **Then:** AudioManager starts WaterAmbient loop. When player exits and SpeedModifier expires, WaterAmbient stops.
- **Why:** Same retriggering bug as fire. Same stale sound bug on exit.

### Scenario: Damage numbers drift and fade
- **Given:** A DamageNumberEvent(amount=15, position=(10, 0, 5), isCritical=false) is emitted.
- **When:** The damage number renderer processes it.
- **Then:** A white text sprite "15" appears at world position (10, 0, 5). Over 0.8 seconds (lifetime from design params), it drifts upward at driftSpeed (2.0 units/s) and fades to transparent. After 0.8s, the sprite is removed.
- **Why:** Damage numbers that don't fade accumulate and obscure the game. Numbers that don't drift stack on top of each other and become unreadable.

### Scenario: Critical damage number is yellow and scaled
- **Given:** A DamageNumberEvent(amount=30, position=(10, 0, 5), isCritical=true) is emitted.
- **When:** The damage number renderer processes it.
- **Then:** The text sprite is yellow (not white). Its size is scaled by critScale (1.5x normal). It still drifts and fades over the same lifetime.
- **Why:** If crits look the same as normal hits, the player cannot evaluate their crit chance upgrades.

### Scenario: Audio maxInstances prevents sound stacking
- **Given:** The sound manifest sets PistolFire.maxInstances=3. The player fires 5 shots in rapid succession.
- **When:** AudioManager receives 5 AudioEvent(PistolFire) calls.
- **Then:** At most 3 PistolFire sounds play simultaneously. The 4th and 5th either replace the oldest instance or are dropped.
- **Why:** Unlimited sound instances cause audio clipping and distortion during rapid fire.

### Scenario: Audio pitch variation
- **Given:** The sound manifest sets EnemyDeath.pitchMin=0.9, pitchMax=1.1.
- **When:** Two EnemyDeath AudioEvents fire in succession.
- **Then:** Each playback uses a random pitch within [0.9, 1.1]. The two playbacks sound slightly different.
- **Why:** Identical repeated sounds create a robotic feel. Pitch variation makes combat feel dynamic.

### Scenario: Bullet impact on wall produces wall-specific effects
- **Given:** A player bullet hits a wall (CollisionResponseSystem destroys the bullet).
- **When:** The collision is processed.
- **Then:** ParticleEvent(BulletImpactWall) is emitted at the collision point. AudioEvent for bullet impact plays.
- **Why:** Bullets silently vanishing on wall contact makes the player unsure if they missed or hit something.

### Scenario: Shield hit produces spark effects and armor sound
- **Given:** A player bullet hits a ShieldGun enemy from the front (within coverageArc).
- **When:** CollisionResponseSystem routes damage to enemyShield.health.
- **Then:** ParticleEvent(Sparks) is emitted at the impact position. AudioEvent(EnemyHitArmor) is emitted (not EnemyHitFlesh).
- **Why:** If shield hits produce blood effects and flesh sounds, the player doesn't realize the shield is absorbing damage and doesn't adjust tactics.

## Edge Cases
- Multiple DamageEvents in a single simulation step (e.g., shotgun hitting 3 enemies). All must produce independent particle/sound/number effects. No batching that drops events.
- DamageEvent with amount=0 (e.g., fully absorbed by shield). A damage number "0" should still appear (or be intentionally suppressed). Either behavior is acceptable but it must be deliberate, not a crash.
- ParticleEvent at the edge of the camera frustum. Particles should still spawn but may be culled by Three.js. The particle system must not crash on off-screen positions.
- AudioEvent with no position (UI sounds like MenuClick). AudioManager must play without spatialization — no crash from undefined position.
- Game loop frozen during overlay states. No new ParticleEvents or AudioEvents should be emitted (no systems running). Existing particles should continue their lifetime animation in the render loop. Existing looping sounds should continue playing.
- Rapid entity creation/destruction (e.g., LMG firing into a crowd). Particle and sound systems must handle burst loads of 20+ events per step without dropping or crashing.
- DamageNumberEvent sprite pool exhaustion. If more damage numbers are active than the pool supports, oldest numbers should be recycled, not leaked.

## Integration Warnings
- ParticleSystem and AudioEventSystem are the last two systems in the execution order (positions 25 and 26). All events from upstream systems (Damage, Death, Destructible, CollisionResponse) must be queued and available when these systems run. If events are consumed eagerly by an earlier system, the effect systems see empty queues.
- The AudioManager must be initialized before any AudioEvents fire. If the game loop starts before AudioManager.init() completes (async audio context creation), events are silently lost.
- Browser autoplay policy: AudioManager must handle the case where the AudioContext is suspended (user hasn't interacted yet). Events should be queued or dropped gracefully, not crash.
- Screen effects (shake, flash, vignette) are rendering concerns, applied in the render loop — not in the simulation step. The simulation emits trigger events; the render system applies them. Applying shake in the simulation step would cause shake amount to depend on sim rate, not render rate.
- Particle lifetime ticks in the render loop (variable dt), not the simulation loop (fixed dt). Using fixed dt for particle lifetime causes particles to desync from visual time when render rate != 60fps.
