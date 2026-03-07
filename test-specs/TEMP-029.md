# Test Spec: TEMP-029 — GunXPSystem

## Properties (must ALWAYS hold)
- For each gun in the player's slots, the system calculates the maximum trait upgrade cost across all 3 traits using the gun's current trait levels and the `xpCosts` array from design params.
- If `gun.xp >= maxCost` AND `gun.forcedUpgradeTriggered === false`: the system sets `gun.forcedUpgradeTriggered = true` and transitions game state to `ForcedUpgrade`.
- If `gun.forcedUpgradeTriggered === true`, no transition occurs regardless of XP amount (prevents re-triggering).
- After the player spends XP in the ForcedUpgrade screen (handled by the upgrade UI), `forcedUpgradeTriggered` is reset to `false`.
- The system checks both gun slots (sidearm and long arm) every frame it runs.
- `maxCost` is determined by looking at the current level of each of the gun's 3 traits and finding the highest `xpCosts[level]` among them. A trait at level 0 has cost `xpCosts[0] = 50`; at level 4 has cost `xpCosts[4] = 1200`. A trait at max level (5) has no further cost and is excluded from the max calculation.

## Adversarial Test Cases

### Case: Gun reaches forced upgrade threshold (all traits at level 0)
- **Setup:** Player's sidearm (Pistol) has all traits at level 0. `xpCosts[0] = 50`. So `maxCost = 50`. Set `gun.xp = 50`. `forcedUpgradeTriggered = false`.
- **Why this matters:** The simplest trigger case. All traits at level 0 means the cheapest upgrade costs 50, and that is also the max cost. This validates the basic threshold logic.
- **Expected behavior:** `forcedUpgradeTriggered` set to `true`. Game state transitions to `ForcedUpgrade`.

### Case: XP just below threshold does not trigger
- **Setup:** Same as above but `gun.xp = 49`. `maxCost = 50`.
- **Why this matters:** Off-by-one boundary. The condition is `>=`, not `>`. At 49, the condition must fail.
- **Expected behavior:** No state transition. `forcedUpgradeTriggered` remains `false`.

### Case: XP exactly at threshold triggers
- **Setup:** `gun.xp = 50`, `maxCost = 50`.
- **Why this matters:** Boundary test for the `>=` operator.
- **Expected behavior:** Forced upgrade triggered.

### Case: XP far exceeds threshold
- **Setup:** `gun.xp = 5000`, all traits at level 0. `maxCost = 50`.
- **Why this matters:** Extreme overshoot. The system should still trigger exactly once, not repeatedly or with overflow issues.
- **Expected behavior:** `forcedUpgradeTriggered` set to `true`. Single state transition.

### Case: forcedUpgradeTriggered prevents re-trigger
- **Setup:** `gun.xp = 100`, `maxCost = 50`, `forcedUpgradeTriggered = true` (already triggered, player hasn't spent XP yet).
- **Why this matters:** Without this guard, the system would transition to ForcedUpgrade every frame, locking the player in an infinite loop of upgrade screens.
- **Expected behavior:** No state transition. `forcedUpgradeTriggered` remains `true`.

### Case: Flag resets after spending XP
- **Setup:** Gun had `forcedUpgradeTriggered = true`. Player spends XP in the upgrade UI, reducing `gun.xp` to 30 (below the new maxCost). UI sets `forcedUpgradeTriggered = false`. Next frame, GunXPSystem runs.
- **Why this matters:** The reset-and-recheck cycle is critical. If the flag doesn't reset, the player can never be forced to upgrade again. If it resets but the system doesn't recheck, XP can accumulate without triggering.
- **Expected behavior:** `forcedUpgradeTriggered` is `false`. `xp (30) < maxCost` so no trigger. System does nothing.

### Case: Flag resets but XP still above threshold
- **Setup:** Player spends XP but not enough to drop below the new threshold. E.g., traits at levels [1, 0, 0]. `xpCosts` for level 1 is 150, for level 0 is 50. `maxCost = max(150, 50, 50) = 150`. After spending, `gun.xp = 200`. UI resets `forcedUpgradeTriggered = false`.
- **Why this matters:** If the player spends XP on the cheapest trait but still has enough for the most expensive, the system should immediately re-trigger on the next frame.
- **Expected behavior:** GunXPSystem detects `xp (200) >= maxCost (150)` and `forcedUpgradeTriggered === false`. Sets flag to `true`, transitions to `ForcedUpgrade` again.

### Case: Mixed trait levels produce correct maxCost
- **Setup:** Gun traits at levels [3, 1, 4]. `xpCosts = [50, 150, 350, 700, 1200]`. Costs for next upgrade: trait 0 at level 3 costs `xpCosts[3] = 700`, trait 1 at level 1 costs `xpCosts[1] = 150`, trait 2 at level 4 costs `xpCosts[4] = 1200`. `maxCost = max(700, 150, 1200) = 1200`. Set `gun.xp = 1200`.
- **Why this matters:** Verifies that `maxCost` correctly finds the maximum across traits at different levels, not the minimum or average.
- **Expected behavior:** Forced upgrade triggered because `1200 >= 1200`.

### Case: One trait at max level (level 5), others not
- **Setup:** Gun traits at levels [5, 0, 2]. Trait 0 is at max level and cannot be upgraded further. `maxCost` should be calculated from trait 1 (`xpCosts[0] = 50`) and trait 2 (`xpCosts[2] = 350`). `maxCost = max(50, 350) = 350`. `gun.xp = 350`.
- **Why this matters:** A maxed-out trait must be excluded from cost calculation. If it's included, the system might use an out-of-bounds index (`xpCosts[5]` which doesn't exist) or never trigger because the cost is undefined/infinite.
- **Expected behavior:** Forced upgrade triggered. `maxCost = 350`, not undefined or Infinity.

### Case: All traits at max level
- **Setup:** Gun traits at levels [5, 5, 5]. All traits fully upgraded. `gun.xp = 9999`.
- **Why this matters:** If all traits are maxed, there are no upgradeable traits. The system should not trigger a forced upgrade (there's nothing to upgrade). If `maxCost` is computed as -Infinity or 0 from an empty set, the condition `xp >= maxCost` could erroneously trigger.
- **Expected behavior:** No forced upgrade triggered. The system recognizes there are no remaining upgrades and skips the check entirely. No crash, no state transition.

### Case: Both guns checked independently
- **Setup:** Sidearm has `xp = 10`, `maxCost = 50`, `forcedUpgradeTriggered = false` (below threshold). Long arm has `xp = 200`, `maxCost = 150`, `forcedUpgradeTriggered = false` (above threshold).
- **Why this matters:** The system must check BOTH gun slots, not just the active gun or just the sidearm.
- **Expected behavior:** Long arm triggers forced upgrade. Sidearm is unaffected. `forcedUpgradeTriggered` set to `true` on the long arm only.

### Case: Both guns above threshold simultaneously
- **Setup:** Both sidearm and long arm have `xp >= maxCost` and `forcedUpgradeTriggered = false`.
- **Why this matters:** Can only transition to one `ForcedUpgrade` state at a time. The system must handle this without entering two simultaneous upgrade screens or skipping one.
- **Expected behavior:** The system triggers forced upgrade for one gun (define deterministic order: sidearm first, or first in iteration). The other gun's `forcedUpgradeTriggered` remains `false` and will trigger on a subsequent frame after the first upgrade is resolved.

## Edge Cases
- `gun.xp` is exactly 0: No trigger (0 < 50). Trivial but verify.
- `gun.xp` is negative (malformed data): Should not trigger. Verify `negative >= positive` is false.
- Gun entity referenced by player slot no longer exists: System must handle dangling references without crashing.
- Player has only one gun slot populated (e.g., during initial game state before long arm is acquired, if applicable): System should not crash iterating a null/undefined slot.
- XP added and forced upgrade check happen in the same frame (PickupSystem at step 14 adds XP, GunXPSystem at step 17 checks): Verify the XP value read by GunXPSystem reflects the additions from earlier in the frame.

## Interaction Concerns
- **PickupSystem (step 14) adds XP to guns.** GunXPSystem (step 17) checks thresholds. This ordering guarantees that XP collected this frame is visible to the threshold check. If ordering were reversed, there would be a one-frame delay.
- **GunStatSystem (step 18) is on-demand, not per-frame.** The forced upgrade UI calls GunStatSystem after trait levels change. GunXPSystem does NOT call GunStatSystem. These are independent systems.
- **State transition to ForcedUpgrade** must pause the game loop or prevent further system execution for the remainder of the frame. If DamageSystem or DeathSystem run after the transition, the player could die while the upgrade screen is open.
- **Upgrade UI responsibility:** The UI action that spends XP and resets `forcedUpgradeTriggered` must run atomically. If the flag resets but XP is not deducted (or vice versa), the system enters an inconsistent state.
