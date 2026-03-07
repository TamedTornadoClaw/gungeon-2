# Test Spec: TEMP-021 — ShieldRegenSystem

## Properties (must ALWAYS hold)
- `timeSinceLastHit` increases by exactly `dt` every frame, unconditionally.
- Regeneration begins only when `timeSinceLastHit >= regenDelay`. Not before. Not at equality minus epsilon.
- While regenerating, `current` increases by exactly `regenRate * dt` per frame.
- `current` is clamped to `max` and never exceeds it, regardless of `regenRate` or `dt` magnitude.
- If `current === max`, no mutation occurs to `current` (idempotent at full shield).
- The system never modifies `max`, `regenRate`, or `regenDelay`.
- The system does not reset `timeSinceLastHit` — only DamageSystem resets it to 0 on hit.
- Entities without a Shield component are untouched.

## Adversarial Test Cases

### Case: Timer increments even when shield is full
- **Setup:** Entity with Shield { current: 50, max: 50, regenRate: 10, regenDelay: 2.0, timeSinceLastHit: 0 }. Run system with dt = 0.5.
- **Why this matters:** A naive implementation might skip the entire system when current === max. But timeSinceLastHit must still increment so that regen starts immediately after a future hit if enough time has already elapsed. If the timer is not ticked while at full shield, a hit followed by a frame could see timeSinceLastHit stuck at 0 even though seconds have passed.
- **Expected behavior:** timeSinceLastHit = 0.5. current remains 50 (already at max).

### Case: Regen does not start one frame too early
- **Setup:** Entity with Shield { current: 20, max: 50, regenRate: 10, regenDelay: 2.0, timeSinceLastHit: 1.98 }. Run system with dt = 1/60 (0.01667).
- **Why this matters:** After adding dt, timeSinceLastHit = 1.99667 which is still < 2.0. A floating-point rounding error or an off-by-one (`>` vs `>=`) could trigger regen one frame early. This tests the boundary precisely.
- **Expected behavior:** timeSinceLastHit = 1.99667. current remains 20 (no regen yet).

### Case: Regen starts exactly at the delay boundary
- **Setup:** Entity with Shield { current: 20, max: 50, regenRate: 10, regenDelay: 2.0, timeSinceLastHit: 1.99 }. Run system with dt = 0.01.
- **Why this matters:** After increment, timeSinceLastHit = 2.0 exactly. The contract says `>=`, so regen must activate. Tests that equality is included.
- **Expected behavior:** timeSinceLastHit = 2.0. current = 20 + 10 * 0.01 = 20.1.

### Case: Regen clamps at max and does not overshoot
- **Setup:** Entity with Shield { current: 49.5, max: 50, regenRate: 100, regenDelay: 1.0, timeSinceLastHit: 5.0 }. Run system with dt = 1/60.
- **Why this matters:** regenRate * dt = 100 * 0.01667 = 1.667, which would bring current to 51.167 if unclamped. The system must clamp to 50.0.
- **Expected behavior:** current = 50.0 (clamped). timeSinceLastHit = 5.01667.

### Case: Very large dt does not break the system
- **Setup:** Entity with Shield { current: 0, max: 100, regenRate: 50, regenDelay: 1.0, timeSinceLastHit: 0 }. Run system with dt = 10.0 (simulating a massive lag spike that survived the spiral-of-death cap).
- **Why this matters:** After increment, timeSinceLastHit = 10.0 (>= regenDelay). regenRate * dt = 500, far exceeding max. If clamping is applied additively before checking, or if there is an integer overflow concern, this breaks. This also verifies that a single large frame can push past the delay and start regen in the same call.
- **Expected behavior:** timeSinceLastHit = 10.0. current = 100.0 (clamped from 500).

### Case: Zero regenRate means no regen even after delay
- **Setup:** Entity with Shield { current: 30, max: 50, regenRate: 0, regenDelay: 1.0, timeSinceLastHit: 5.0 }. Run system with dt = 1/60.
- **Why this matters:** Edge case where regenRate is zero. The system should not error or produce NaN. current should remain unchanged because 0 * dt = 0.
- **Expected behavior:** timeSinceLastHit = 5.01667. current = 30 (unchanged).

### Case: Multiple entities processed independently
- **Setup:** Entity A: Shield { current: 10, max: 50, regenRate: 5, regenDelay: 1.0, timeSinceLastHit: 2.0 }. Entity B: Shield { current: 40, max: 50, regenRate: 5, regenDelay: 3.0, timeSinceLastHit: 1.0 }. Run system with dt = 0.5.
- **Why this matters:** Ensures the system processes each entity independently. Entity A should regen (past delay), entity B should not (not yet past delay). A bug that shares state between iterations would corrupt results.
- **Expected behavior:** Entity A: timeSinceLastHit = 2.5, current = 12.5. Entity B: timeSinceLastHit = 1.5, current = 40 (no regen).

### Case: timeSinceLastHit is not reset by the system
- **Setup:** Entity with Shield { current: 25, max: 50, regenRate: 10, regenDelay: 2.0, timeSinceLastHit: 100.0 }. Run system with dt = 1/60.
- **Why this matters:** The timer should keep accumulating indefinitely. If the system resets timeSinceLastHit to 0 after regen starts or after shield is full, future hits would have incorrect delay tracking.
- **Expected behavior:** timeSinceLastHit = 100.01667. current = 25.1667.

### Case: dt = 0 is a no-op for regen amount
- **Setup:** Entity with Shield { current: 30, max: 50, regenRate: 10, regenDelay: 1.0, timeSinceLastHit: 5.0 }. Run system with dt = 0.
- **Why this matters:** dt = 0 can occur if the fixed timestep produces a zero remainder. The timer should not change, and regen should add 0.
- **Expected behavior:** timeSinceLastHit = 5.0. current = 30 (regenRate * 0 = 0).

## Edge Cases
- Shield component with current = 0, max = 0: system should not divide by zero or produce NaN. No regen should occur (current cannot exceed max = 0, so adding anything is clamped to 0).
- Shield component with regenDelay = 0: regen should start immediately on any frame (timeSinceLastHit >= 0 is always true).
- Negative dt: not expected from the game loop, but if passed, timeSinceLastHit would decrease. The system spec does not guard against this — document as undefined behavior or assert dt >= 0.
- Entity gains Shield component mid-frame (timeSinceLastHit initialized to 0): system should process it normally — no regen until delay is met.

## Interaction Concerns
- **DamageSystem resets timeSinceLastHit to 0:** ShieldRegenSystem runs after DamageSystem in the execution order (slot 11 vs slot 10). If damage occurs this frame, DamageSystem has already reset the timer before ShieldRegenSystem increments it. The result is timeSinceLastHit = 0 + dt, which is correct — regen won't start until regenDelay frames later.
- **Shield at 0 current with damage pass-through:** When shield.current is 0, DamageSystem skips the shield and does not reset timeSinceLastHit. ShieldRegenSystem should still regen the shield if the delay has passed. This means the shield can regenerate from 0 even if the entity is still taking health damage — verify this is intended behavior.
- **ExpireModifiersSystem does not affect Shield:** Shield is a permanent component, not a modifier. Ensure ShieldRegenSystem does not confuse Shield with SpeedModifier/DamageOverTime refresh mechanics.
