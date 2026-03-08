import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import { EventQueue } from '../src/gameloop/events';
import { chestSystem } from '../src/systems/chestSystem';
import {
  EventType,
  GunType,
  SoundId,
  PickupType,
  ColliderShape,
} from '../src/ecs/components';
import type {
  Chest,
  Position,
  Pickup,
  Gun,
} from '../src/ecs/components';
import type { InputState } from '../src/input/inputManager';
import type { AudioEvent } from '../src/gameloop/events';

function makeInput(overrides: Partial<InputState> = {}): InputState {
  return {
    moveX: 0,
    moveY: 0,
    aimWorldX: 0,
    aimWorldY: 0,
    mouseDeltaX: 0,
    mouseDeltaY: 0,
    pointerLockLost: false,
    fireSidearm: false,
    fireLongArm: false,
    reload: false,
    dodgeRoll: false,
    interact: false,
    openUpgrade: false,
    pause: false,
    debugSpeedUp: false,
    debugSpeedDown: false,
    ...overrides,
  };
}

function createPlayerWithFlags(
  world: World,
  nearChest: boolean,
): number {
  const id = world.createEntity();
  world.addComponent(id, 'PlayerTag', {});
  world.addComponent(id, 'ProximityFlags', {
    nearPickup: false,
    nearChest,
    nearShop: false,
    nearStairs: false,
  });
  world.addComponent<Position>(id, 'Position', { x: 0, y: 0, z: 0 });
  return id;
}

function createChestEntity(
  world: World,
  position: { x: number; y: number; z: number },
  gunType: GunType,
  isOpen = false,
): number {
  const id = world.createEntity();
  world.addComponent<Chest>(id, 'Chest', { isOpen, gunType });
  world.addComponent<Position>(id, 'Position', { ...position });
  world.addComponent(id, 'ChestTag', {});
  world.addComponent(id, 'Collider', {
    type: ColliderShape.AABB,
    width: 1,
    height: 1,
    depth: 1,
    isStatic: true,
    isTrigger: false,
  });
  return id;
}

function getAudioEvents(eq: EventQueue): AudioEvent[] {
  return eq.consume<EventType.Audio>(EventType.Audio);
}

function countGunPickups(world: World): number {
  return world.query(['Pickup', 'Gun']).filter((id) => {
    const pickup = world.getComponent<Pickup>(id, 'Pickup');
    return pickup?.pickupType === PickupType.GunPickup;
  }).length;
}

describe('ChestSystem', () => {
  it('opens a closed chest when player is near and presses interact', () => {
    const world = new World();
    const eq = new EventQueue();
    createPlayerWithFlags(world, true);
    const chestId = createChestEntity(world, { x: 5, y: 0, z: 5 }, GunType.Shotgun);

    chestSystem(world, makeInput({ interact: true }), eq);

    const chest = world.getComponent<Chest>(chestId, 'Chest')!;
    expect(chest.isOpen).toBe(true);

    expect(countGunPickups(world)).toBe(1);

    const pickupIds = world.query(['Pickup', 'Gun']);
    const pickupPos = world.getComponent<Position>(pickupIds[0], 'Position')!;
    expect(pickupPos.x).toBe(5);
    expect(pickupPos.y).toBe(0);
    expect(pickupPos.z).toBe(5);

    const gun = world.getComponent<Gun>(pickupIds[0], 'Gun')!;
    expect(gun.gunType).toBe(GunType.Shotgun);

    const audio = getAudioEvents(eq);
    expect(audio).toHaveLength(1);
    expect(audio[0].sound).toBe(SoundId.ChestOpen);
    expect(audio[0].position).toEqual({ x: 5, y: 0, z: 5 });
  });

  it('does not re-open an already opened chest', () => {
    const world = new World();
    const eq = new EventQueue();
    createPlayerWithFlags(world, true);
    const chestId = createChestEntity(world, { x: 5, y: 0, z: 5 }, GunType.Pistol);

    // Open it
    chestSystem(world, makeInput({ interact: true }), eq);
    getAudioEvents(eq); // consume

    // Try again
    chestSystem(world, makeInput({ interact: true }), eq);

    const chest = world.getComponent<Chest>(chestId, 'Chest')!;
    expect(chest.isOpen).toBe(true);
    expect(countGunPickups(world)).toBe(1);
    expect(getAudioEvents(eq)).toHaveLength(0);
  });

  it('does not open chest when interact is not pressed', () => {
    const world = new World();
    const eq = new EventQueue();
    createPlayerWithFlags(world, true);
    const chestId = createChestEntity(world, { x: 5, y: 0, z: 5 }, GunType.SMG);

    chestSystem(world, makeInput({ interact: false }), eq);

    const chest = world.getComponent<Chest>(chestId, 'Chest')!;
    expect(chest.isOpen).toBe(false);
    expect(countGunPickups(world)).toBe(0);
    expect(getAudioEvents(eq)).toHaveLength(0);
  });

  it('does not open chest when player is not near', () => {
    const world = new World();
    const eq = new EventQueue();
    createPlayerWithFlags(world, false);
    const chestId = createChestEntity(world, { x: 50, y: 0, z: 50 }, GunType.LMG);

    chestSystem(world, makeInput({ interact: true }), eq);

    const chest = world.getComponent<Chest>(chestId, 'Chest')!;
    expect(chest.isOpen).toBe(false);
    expect(countGunPickups(world)).toBe(0);
    expect(getAudioEvents(eq)).toHaveLength(0);
  });

  it('rapid interact spam over multiple frames only opens once', () => {
    const world = new World();
    const eq = new EventQueue();
    createPlayerWithFlags(world, true);
    createChestEntity(world, { x: 5, y: 0, z: 5 }, GunType.AssaultRifle);

    for (let i = 0; i < 10; i++) {
      chestSystem(world, makeInput({ interact: true }), eq);
    }

    expect(countGunPickups(world)).toBe(1);
    const audio = getAudioEvents(eq);
    expect(audio).toHaveLength(1);
  });

  it('opens only one chest when multiple are in range', () => {
    const world = new World();
    const eq = new EventQueue();
    createPlayerWithFlags(world, true);
    const chest1 = createChestEntity(world, { x: 1, y: 0, z: 1 }, GunType.Pistol);
    const chest2 = createChestEntity(world, { x: 2, y: 0, z: 2 }, GunType.SMG);

    chestSystem(world, makeInput({ interact: true }), eq);

    const c1 = world.getComponent<Chest>(chest1, 'Chest')!;
    const c2 = world.getComponent<Chest>(chest2, 'Chest')!;

    // Exactly one should be open
    const openCount = [c1.isOpen, c2.isOpen].filter(Boolean).length;
    expect(openCount).toBe(1);
    expect(countGunPickups(world)).toBe(1);
    expect(getAudioEvents(eq)).toHaveLength(1);
  });

  it('spawns correct gun for each GunType', () => {
    const allTypes = [GunType.Pistol, GunType.SMG, GunType.AssaultRifle, GunType.Shotgun, GunType.LMG];

    for (const gunType of allTypes) {
      const world = new World();
      const eq = new EventQueue();
      createPlayerWithFlags(world, true);
      createChestEntity(world, { x: 10, y: 0, z: 10 }, gunType);

      chestSystem(world, makeInput({ interact: true }), eq);

      const pickupIds = world.query(['Pickup', 'Gun']);
      expect(pickupIds).toHaveLength(1);
      const gun = world.getComponent<Gun>(pickupIds[0], 'Gun')!;
      expect(gun.gunType).toBe(gunType);
    }
  });

  it('spawns GunPickup at chest position, not default origin', () => {
    const world = new World();
    const eq = new EventQueue();
    createPlayerWithFlags(world, true);
    createChestEntity(world, { x: 100, y: 0, z: -50 }, GunType.Pistol);

    chestSystem(world, makeInput({ interact: true }), eq);

    const pickupIds = world.query(['Pickup', 'Gun']);
    const pos = world.getComponent<Position>(pickupIds[0], 'Position')!;
    expect(pos.x).toBe(100);
    expect(pos.z).toBe(-50);
  });

  it('runs without error when no chests exist', () => {
    const world = new World();
    const eq = new EventQueue();
    createPlayerWithFlags(world, true);

    expect(() => chestSystem(world, makeInput({ interact: true }), eq)).not.toThrow();
    expect(countGunPickups(world)).toBe(0);
    expect(getAudioEvents(eq)).toHaveLength(0);
  });

  it('runs without error when no player exists', () => {
    const world = new World();
    const eq = new EventQueue();
    createChestEntity(world, { x: 5, y: 0, z: 5 }, GunType.Shotgun);

    expect(() => chestSystem(world, makeInput({ interact: true }), eq)).not.toThrow();
    expect(countGunPickups(world)).toBe(0);
  });

  it('does not open chest already created with isOpen=true', () => {
    const world = new World();
    const eq = new EventQueue();
    createPlayerWithFlags(world, true);
    createChestEntity(world, { x: 5, y: 0, z: 5 }, GunType.Pistol, true);

    chestSystem(world, makeInput({ interact: true }), eq);

    expect(countGunPickups(world)).toBe(0);
    expect(getAudioEvents(eq)).toHaveLength(0);
  });

  it('near chest + interact: spawned GunPickup has all required components', () => {
    const world = new World();
    const eq = new EventQueue();
    createPlayerWithFlags(world, true);
    createChestEntity(world, { x: 5, y: 0, z: 5 }, GunType.Shotgun);

    chestSystem(world, makeInput({ interact: true }), eq);

    const pickupIds = world.query(['Pickup', 'Gun']);
    expect(pickupIds).toHaveLength(1);
    const id = pickupIds[0];

    expect(world.hasComponent(id, 'Position')).toBe(true);
    expect(world.hasComponent(id, 'Gun')).toBe(true);
    expect(world.hasComponent(id, 'Pickup')).toBe(true);
    expect(world.hasComponent(id, 'Collider')).toBe(true);
    expect(world.hasComponent(id, 'Renderable')).toBe(true);
    expect(world.hasComponent(id, 'PickupTag')).toBe(true);
  });

  // Property-based tests
  describe('property-based', () => {
    const gunTypeArb = fc.constantFrom(
      GunType.Pistol,
      GunType.SMG,
      GunType.AssaultRifle,
      GunType.Shotgun,
      GunType.LMG,
    );

    it('a closed chest opened once always produces exactly one GunPickup', () => {
      fc.assert(
        fc.property(
          gunTypeArb,
          fc.integer({ min: -1000, max: 1000 }),
          fc.integer({ min: -1000, max: 1000 }),
          (gunType, x, z) => {
            const world = new World();
            const eq = new EventQueue();
            createPlayerWithFlags(world, true);
            createChestEntity(world, { x, y: 0, z }, gunType);

            chestSystem(world, makeInput({ interact: true }), eq);

            expect(countGunPickups(world)).toBe(1);

            const pickupIds = world.query(['Pickup', 'Gun']);
            const gun = world.getComponent<Gun>(pickupIds[0], 'Gun')!;
            expect(gun.gunType).toBe(gunType);

            const pos = world.getComponent<Position>(pickupIds[0], 'Position')!;
            expect(pos.x).toBe(x);
            expect(pos.z).toBe(z);
          },
        ),
      );
    });

    it('no interact means no chest ever opens regardless of proximity', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.integer({ min: 1, max: 5 }),
          gunTypeArb,
          (nearChest, chestCount, gunType) => {
            const world = new World();
            const eq = new EventQueue();
            createPlayerWithFlags(world, nearChest);

            for (let i = 0; i < chestCount; i++) {
              createChestEntity(world, { x: i * 5, y: 0, z: 0 }, gunType);
            }

            chestSystem(world, makeInput({ interact: false }), eq);

            expect(countGunPickups(world)).toBe(0);
            expect(getAudioEvents(eq)).toHaveLength(0);
          },
        ),
      );
    });

    it('repeated opens on the same chest never produce more than one pickup', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          gunTypeArb,
          (frames, gunType) => {
            const world = new World();
            const eq = new EventQueue();
            createPlayerWithFlags(world, true);
            createChestEntity(world, { x: 0, y: 0, z: 0 }, gunType);

            for (let i = 0; i < frames; i++) {
              chestSystem(world, makeInput({ interact: true }), eq);
            }

            expect(countGunPickups(world)).toBe(1);
          },
        ),
      );
    });

    it('already-open chests never produce pickups', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          gunTypeArb,
          (frames, gunType) => {
            const world = new World();
            const eq = new EventQueue();
            createPlayerWithFlags(world, true);
            createChestEntity(world, { x: 0, y: 0, z: 0 }, gunType, true);

            for (let i = 0; i < frames; i++) {
              chestSystem(world, makeInput({ interact: true }), eq);
            }

            expect(countGunPickups(world)).toBe(0);
            expect(getAudioEvents(eq)).toHaveLength(0);
          },
        ),
      );
    });
  });
});
