# Test Spec: TEMP-032 — DoorSystem

## Properties (must ALWAYS hold)
- A DoorInteract event targeting a closed door (`isOpen === false`) sets `isOpen = true`, changes the door's collider to a trigger (`isTrigger = true`), and emits exactly one AudioEvent(DoorOpen).
- A DoorInteract event targeting an already-open door (`isOpen === true`) produces no state change and no AudioEvent.
- Once a door is opened, it remains open permanently. No mechanism exists to close it.
- A door that has not received a DoorInteract event is never modified by the system.
- A door's collider change from solid to trigger means it no longer blocks movement (physics push-out no longer applies).

## Adversarial Test Cases

### Case: Open a closed door
- **Setup:** Create a door entity with `isOpen = false`, `collider.isTrigger = false`. Emit a DoorInteract event referencing that door entity. Run DoorSystem.
- **Why this matters:** This is the primary happy path. If this fails, doors never open.
- **Expected behavior:** `door.isOpen === true`. `collider.isTrigger === true`. Exactly one AudioEvent(DoorOpen) emitted at the door's position.

### Case: DoorInteract on an already-open door
- **Setup:** Create a door entity with `isOpen = true`, `collider.isTrigger = true`. Emit a DoorInteract event referencing it. Run DoorSystem.
- **Why this matters:** The player can walk into an open door's trigger collider repeatedly, generating DoorInteract events each frame via CollisionResponseSystem. The system must be idempotent -- no redundant audio spam.
- **Expected behavior:** No state change. No AudioEvent emitted. `isOpen` remains true. `isTrigger` remains true.

### Case: Multiple doors, only one receives event
- **Setup:** Create 3 door entities, all closed. Emit a DoorInteract event for only the second door. Run DoorSystem.
- **Why this matters:** Verifies the system targets events correctly and does not broadcast the open action to all doors.
- **Expected behavior:** Only the targeted door opens. The other two remain closed with solid colliders. Exactly one AudioEvent emitted.

### Case: Multiple DoorInteract events for the same door in one frame
- **Setup:** Create a closed door. Emit two DoorInteract events both referencing the same door entity. Run DoorSystem.
- **Why this matters:** If CollisionResponseSystem emits duplicate events (e.g., player overlapping door collider from two collision pairs), the system must not double-process. Duplicate AudioEvent(DoorOpen) sounds unnatural.
- **Expected behavior:** Door opens. At most one AudioEvent(DoorOpen) emitted (not two).

### Case: DoorInteract event with invalid/destroyed entity ID
- **Setup:** Emit a DoorInteract event with an entity ID that does not exist in the world. Run DoorSystem.
- **Why this matters:** If an entity is destroyed between event emission and DoorSystem processing (unlikely given execution order but defensively important), the system must not crash.
- **Expected behavior:** Event is ignored. No crash. No AudioEvent.

### Case: Door permanence across multiple frames
- **Setup:** Create a closed door. Open it via DoorInteract event in frame 1. Run DoorSystem for frames 2, 3, 4 with no events.
- **Why this matters:** Validates the "doors stay open permanently" invariant. Some implementations might reset state each frame.
- **Expected behavior:** Door remains `isOpen = true` and `isTrigger = true` across all subsequent frames. No further AudioEvents emitted.

### Case: Collider isTrigger transition allows passthrough
- **Setup:** Create a closed door with a solid collider (isTrigger = false, isStatic = true). Open it. Then simulate a collision pair between the player and the now-open door.
- **Why this matters:** The entire point of changing the collider to a trigger is that CollisionResponseSystem no longer pushes the player out. If `isTrigger` is set but the response system does not respect it, doors are visually open but physically blocking.
- **Expected behavior:** After opening, the collider's `isTrigger` is true. CollisionResponseSystem should not produce push-out corrections for trigger colliders (per system contract).

### Case: No events in queue
- **Setup:** Create 3 closed doors. Run DoorSystem with an empty event queue.
- **Why this matters:** System must handle the no-work case gracefully without iterating doors unnecessarily or producing side effects.
- **Expected behavior:** No doors modified. No events emitted. No errors.

## Edge Cases
- Door entity that has a Door component but no Collider component: system should either skip it gracefully or the entity composition invariant should prevent this from ever occurring. Either way, no crash.
- DoorInteract event arriving on the same frame the door entity was just created: should still work since entity exists in the world.
- A door at the exact boundary of the spatial hash cell: changing its collider type should not corrupt the spatial hash (though DoorSystem may not directly manage the hash -- verify whether the hash needs updating when a collider's trigger status changes).

## Interaction Concerns
- **CollisionResponseSystem (step 9) -> DoorSystem (step 20):** CollisionResponseSystem emits DoorInteract events. DoorSystem consumes them 11 steps later. The event queue must persist across these steps. No system between steps 9 and 20 should consume or discard DoorInteract events.
- **Spatial hash update:** When a door's collider changes from solid to trigger, the spatial hash entry may need updating. Static colliders are inserted once at level load. If the spatial hash does not distinguish solid vs. trigger, the door will still appear in collision pairs but CollisionResponseSystem should skip push-out for triggers. Verify this interaction is correct.
- **SpawnSystem cleared flag:** The spec mentions that `cleared` flags can be used by DoorSystem to keep doors locked until a room is cleared. If this feature is implemented, DoorSystem must check the associated SpawnZone's `cleared` flag before honoring DoorInteract events. If not implemented in v1, document that this interaction is deferred.
- **Player walk-through timing:** The player may be overlapping the door's solid collider when it transitions to trigger. On the next CollisionDetection pass, the pair should still be detected (triggers produce pairs) but CollisionResponseSystem should not push the player out. Verify no single-frame "ejection" occurs.
