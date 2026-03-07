# Test Spec: TEMP-022 — HazardSystem

## Properties (must ALWAYS hold)
- Every entity with a DamageOverTime component and a Health component causes exactly one DamageEvent emission per frame.
- The emitted DamageEvent.amount equals `damagePerSecond * dt` exactly.
- After emitting the DamageEvent, the system sets `refreshed = false` on the DamageOverTime component.
- The system does not remove the DamageOverTime component itself — that is ExpireModifiersSystem's job.
- The system does not modify Health directly — it emits events for DamageSystem to process.
- Entities with DamageOverTime but without Health are not processed (the query requires both).
- The system does not create, destroy, or modify any entities beyond setting the `refreshed` flag.

## Adversarial Test Cases

### Case: Standard fire tick emits correct damage
- **Setup:** Entity with DamageOverTime { damagePerSecond: 10, sourceType: Fire, refreshed: true } and Health { current: 80, max: 100 }. Run system with dt = 1/60.
- **Why this matters:** Baseline correctness. The damage event amount must be 10 * (1/60) = 0.1667, not 10 (full second) or some other value. Getting the per-frame fraction wrong would make hazards either trivial or instantly lethal.
- **Expected behavior:** One DamageEvent emitted with amount = 0.1667. Entity's DamageOverTime.refreshed set to false.

### Case: refreshed flag is set to false AFTER emit, not before
- **Setup:** Entity with DamageOverTime { damagePerSecond: 10, sourceType: Fire, refreshed: true }. Run system.
- **Why this matters:** If refreshed is set to false before the DamageEvent is emitted, and something checks the flag during event processing, the ordering matters. The spec says "after emit, set refreshed = false." Verify the DamageEvent is in the queue before the flag changes.
- **Expected behavior:** DamageEvent is emitted. Then refreshed = false. The event exists in the queue with the correct data regardless of flag state.

### Case: Entity with refreshed already false still emits damage
- **Setup:** Entity with DamageOverTime { damagePerSecond: 10, sourceType: Fire, refreshed: false } and Health { current: 50, max: 100 }. Run system with dt = 1/60.
- **Why this matters:** The refreshed flag controls whether ExpireModifiersSystem removes the component next frame. HazardSystem must still emit damage for this frame regardless of the refreshed state. If the system skips entities with refreshed=false, the entity would take no damage on the frame it leaves the hazard, creating an exploit where rapidly entering/exiting a hazard avoids all damage.
- **Expected behavior:** DamageEvent emitted with amount = 10/60. refreshed remains false (set to false again, idempotent).

### Case: Multiple entities with DamageOverTime each get independent events
- **Setup:** Entity A: DamageOverTime { damagePerSecond: 10, refreshed: true }, Health { current: 50 }. Entity B: DamageOverTime { damagePerSecond: 25, refreshed: true }, Health { current: 30 }. Run system with dt = 0.5.
- **Why this matters:** Ensures events are emitted per-entity, not once globally. A bug that breaks after the first entity or accumulates damage across entities would be caught.
- **Expected behavior:** Two DamageEvents: one for Entity A (amount = 5.0), one for Entity B (amount = 12.5). Both have refreshed = false after.

### Case: DamageEvent target field is the correct entity
- **Setup:** Entity with id=42, DamageOverTime { damagePerSecond: 10, refreshed: true }, Health { current: 100 }. Run system.
- **Why this matters:** The DamageEvent.target must reference the entity being damaged, not the hazard source or a null/undefined value. DamageSystem uses this to look up the entity's Health, Armor, Shield. A wrong target means damage is applied to the wrong entity or crashes.
- **Expected behavior:** DamageEvent.target = 42.

### Case: Very small dt produces very small but nonzero damage
- **Setup:** Entity with DamageOverTime { damagePerSecond: 1, refreshed: true }, Health { current: 100 }. dt = 0.0001.
- **Why this matters:** Floating-point precision. The amount would be 0.0001. If the system rounds to zero or uses integer math, the hazard would deal no damage on fast frame rates. The DamageSystem must receive the fractional amount.
- **Expected behavior:** DamageEvent emitted with amount = 0.0001 (or floating-point equivalent).

### Case: Very large damagePerSecond with normal dt
- **Setup:** Entity with DamageOverTime { damagePerSecond: 10000, refreshed: true }, Health { current: 5 }. dt = 1/60.
- **Why this matters:** HazardSystem does not clamp damage or check health. It emits the raw amount (166.67). DamageSystem is responsible for clamping health to 0. If HazardSystem tries to be clever and skip emitting because the entity would die, it breaks the pipeline.
- **Expected behavior:** DamageEvent emitted with amount = 166.67. Health is NOT modified by this system.

### Case: dt = 0 emits a DamageEvent with amount 0
- **Setup:** Entity with DamageOverTime { damagePerSecond: 10, refreshed: true }, Health { current: 50 }. dt = 0.
- **Why this matters:** Even with dt=0, the system should run its logic: emit a zero-damage event and set refreshed=false. Alternatively, it could skip emission for zero damage. The spec says "emit each frame" unconditionally, so a zero-amount event is acceptable. The critical part is that refreshed must still be set to false.
- **Expected behavior:** DamageEvent emitted with amount = 0 (or system may skip zero-damage events — either is acceptable). refreshed = false.

### Case: Entity has DamageOverTime but no Health component
- **Setup:** Entity with DamageOverTime { damagePerSecond: 10, refreshed: true } but NO Health component.
- **Why this matters:** The system signature queries for entities with both DamageOverTime AND Health. An entity missing Health (e.g., a destructible that lost its health component, or a pickup) must not be processed. If the system iterates DamageOverTime alone and tries to emit a DamageEvent targeting an entity without Health, DamageSystem will fail or no-op.
- **Expected behavior:** No DamageEvent emitted. Entity is skipped entirely.

### Case: Source field on DamageEvent
- **Setup:** Entity with DamageOverTime { damagePerSecond: 10, sourceType: Fire, refreshed: true }, Health { current: 50 }. Run system.
- **Why this matters:** DamageEvent has a `source` field. For hazard damage, the source entity is ambiguous — there is no single hazard entity reference stored in DamageOverTime. The system must decide what to use as source. If it uses the damaged entity itself as source, DamageSystem might misattribute the kill. Verify the source is set to something sensible (possibly a sentinel value or the entity itself).
- **Expected behavior:** DamageEvent.source is defined (not undefined/null). The exact value depends on implementation — but it must not reference a player gun entity, or DeathSystem would misattribute XP gems. DamageEvent.isCritical should be false (hazards do not crit).

## Edge Cases
- Entity with damagePerSecond = 0: emits a DamageEvent with amount 0. Technically harmless but wasteful. System should still set refreshed = false.
- Entity with negative damagePerSecond: not expected, but if present, would emit negative damage (healing). DamageSystem behavior for negative amounts is undefined. Document or assert damagePerSecond > 0.
- Multiple DamageOverTime components on the same entity (e.g., standing in two fire hazards): depends on ECS implementation. If the ECS allows only one DamageOverTime per entity (likely), CollisionResponseSystem should refresh the existing one rather than adding a second. HazardSystem processes whatever is there.
- Entity destroyed mid-iteration: if another system destroys an entity while HazardSystem is iterating, the system must handle it gracefully (skip destroyed entities).

## Interaction Concerns
- **CollisionResponseSystem (order 9) sets refreshed = true** while the entity overlaps a hazard. HazardSystem (order 12) then emits damage and sets refreshed = false. ExpireModifiersSystem (order 24) then removes DamageOverTime if refreshed is still false. This three-system handshake means: overlap sustains the effect, leaving the hazard removes it one frame later. A test should verify the full cycle: enter hazard (CollisionResponse adds DamageOverTime with refreshed=true) -> HazardSystem emits damage, sets refreshed=false -> next frame, CollisionResponse refreshes if still overlapping, or doesn't -> ExpireModifiersSystem removes if not refreshed.
- **DamageSystem (order 10) runs before HazardSystem (order 12).** This means DamageEvents emitted by HazardSystem are processed by DamageSystem on the NEXT frame, not the current one. Verify the event queue carries events across to the next DamageSystem invocation, or if DamageSystem runs again after HazardSystem in the same frame.
- **Shield interaction:** Fire damage emitted as a DamageEvent goes through DamageSystem, which routes through Shield -> Armor -> Health. This is correct per spec. HazardSystem should NOT bypass this pipeline.
- **Enemies ignore hazards:** Per AISystem spec, enemies are unaffected by hazards. This means enemies should never have a DamageOverTime component applied. CollisionResponseSystem should not apply DamageOverTime to enemies. HazardSystem only processes what it finds — if an enemy somehow gets DamageOverTime, it would take damage. The guard is in CollisionResponseSystem, not here.
