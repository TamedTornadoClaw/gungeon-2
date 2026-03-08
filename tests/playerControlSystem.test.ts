import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import type {
  Position,
  Velocity,
  Rotation,
  Player,
  DodgeRoll,
  Gun,
  SpeedModifier,
} from '../src/ecs/components';
import { WeaponSlot, GunCategory, GunType, GunTrait, AppState } from '../src/ecs/components';
import type { InputState } from '../src/input/inputManager';
import { playerControlSystem } from '../src/systems/playerControlSystem';
import { useAppStore } from '../src/store/appStore';
import { getDesignParams } from '../src/config/designParams';

// ── Helpers ──────────────────────────────────────────────────────────────────

function defaultInput(overrides: Partial<InputState> = {}): InputState {
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

function makeGun(world: World, overrides: Partial<Gun> = {}): number {
  const id = world.createEntity();
  world.addComponent<Gun>(id, 'Gun', {
    gunType: GunType.Pistol,
    category: GunCategory.Sidearm,
    baseDamage: 10,
    baseFireRate: 3,
    baseMagazineSize: 12,
    baseReloadTime: 1,
    baseSpread: 0,
    baseProjectileCount: 1,
    baseProjectileSpeed: 30,
    baseKnockback: 0,
    baseCritChance: 0,
    baseCritMultiplier: 1,
    damage: 10,
    fireRate: 3,
    magazineSize: 12,
    reloadTime: 1,
    spread: 0,
    projectileCount: 1,
    projectileSpeed: 30,
    knockback: 0,
    critChance: 0,
    critMultiplier: 1,
    currentAmmo: 12,
    isReloading: false,
    reloadTimer: 0,
    fireCooldown: 0,
    fireRequested: false,
    traits: [GunTrait.Damage, GunTrait.FireRate, GunTrait.MagazineSize],
    traitLevels: [0, 0, 0],
    xp: 0,
    forcedUpgradeTriggered: false,
    ...overrides,
  });
  return id;
}

function makePlayer(
  world: World,
  opts: {
    position?: Partial<Position>;
    sidearmOverrides?: Partial<Gun>;
    longArmOverrides?: Partial<Gun>;
    dodgeRollOverrides?: Partial<DodgeRoll>;
    speedModifier?: number;
    noDodgeRoll?: boolean;
  } = {},
) {
  const sidearmId = makeGun(world, {
    category: GunCategory.Sidearm,
    ...opts.sidearmOverrides,
  });
  const longArmId = makeGun(world, {
    gunType: GunType.SMG,
    category: GunCategory.LongArm,
    ...opts.longArmOverrides,
  });

  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x: 0, y: 0, z: 0, ...opts.position });
  world.addComponent<Velocity>(id, 'Velocity', { x: 0, y: 0, z: 0 });
  world.addComponent<Rotation>(id, 'Rotation', { y: 0 });
  world.addComponent<Player>(id, 'Player', {
    sidearmSlot: sidearmId,
    longArmSlot: longArmId,
    activeSlot: WeaponSlot.LongArm,
    currency: 0,
  });

  if (!opts.noDodgeRoll) {
    world.addComponent<DodgeRoll>(id, 'DodgeRoll', {
      cooldownRemaining: 0,
      isRolling: false,
      rollTimer: 0,
      rollDirectionX: 0,
      rollDirectionY: 0,
      ...opts.dodgeRollOverrides,
    });
  }

  if (opts.speedModifier !== undefined) {
    world.addComponent<SpeedModifier>(id, 'SpeedModifier', {
      multiplier: opts.speedModifier,
      refreshed: true,
    });
  }

  return { playerId: id, sidearmId, longArmId };
}

// ── Tests ────────────────────────────────────────────────────────────────────

const params = getDesignParams();
const MOVE_SPEED = params.player.baseMovementSpeed;
const ROLL_SPEED = params.player.dodgeRoll.speed;
const DT = 1 / 60;

describe('playerControlSystem', () => {
  beforeEach(() => {
    // Reset app state to Gameplay before each test
    useAppStore.setState({ currentState: AppState.Gameplay, previousState: null });
  });

  // ── Property-based tests ──────────────────────────────────────────────

  describe('property: velocity magnitude <= movementSpeed', () => {
    it('for any moveX,moveY in [-1,1], velocity magnitude never exceeds movementSpeed', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -1, max: 1, noNaN: true }),
          fc.float({ min: -1, max: 1, noNaN: true }),
          (moveX, moveY) => {
            const world = new World();
            makePlayer(world);
            const input = defaultInput({ moveX, moveY });
            playerControlSystem(world, input, DT);

            const ids = world.query(['Player', 'Velocity']);
            const vel = world.getComponent<Velocity>(ids[0], 'Velocity')!;
            const mag = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
            expect(mag).toBeLessThanOrEqual(MOVE_SPEED + 1e-9);
          },
        ),
      );
    });
  });

  describe('property: rotation faces aim point', () => {
    it('rotation.y = atan2(dx, dz) for any aim and position', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -100, max: 100, noNaN: true }),
          fc.float({ min: -100, max: 100, noNaN: true }),
          fc.float({ min: -100, max: 100, noNaN: true }),
          fc.float({ min: -100, max: 100, noNaN: true }),
          (px, pz, aimX, aimY) => {
            const world = new World();
            makePlayer(world, { position: { x: px, z: pz } });
            const input = defaultInput({ aimWorldX: aimX, aimWorldY: aimY });
            playerControlSystem(world, input, DT);

            const ids = world.query(['Player', 'Rotation']);
            const rot = world.getComponent<Rotation>(ids[0], 'Rotation')!;
            const expected = Math.atan2(aimX - px, aimY - pz);
            expect(rot.y).toBeCloseTo(expected, 10);
          },
        ),
      );
    });
  });

  // ── Adversarial Test Cases ────────────────────────────────────────────

  it('1. Diagonal movement normalization — (1,1) → magnitude = movementSpeed', () => {
    const world = new World();
    makePlayer(world);
    const input = defaultInput({ moveX: 1, moveY: 1 });
    playerControlSystem(world, input, DT);

    const ids = world.query(['Player', 'Velocity']);
    const vel = world.getComponent<Velocity>(ids[0], 'Velocity')!;
    const mag = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
    expect(mag).toBeCloseTo(MOVE_SPEED, 5);
  });

  it('2. Zero movement produces zero velocity — no NaN', () => {
    const world = new World();
    makePlayer(world);
    const input = defaultInput({ moveX: 0, moveY: 0 });
    playerControlSystem(world, input, DT);

    const ids = world.query(['Player', 'Velocity']);
    const vel = world.getComponent<Velocity>(ids[0], 'Velocity')!;
    expect(vel.x).toBe(0);
    expect(vel.z).toBe(0);
    expect(Number.isNaN(vel.x)).toBe(false);
    expect(Number.isNaN(vel.z)).toBe(false);
  });

  it('3. Fire sidearm with empty magazine — fireRequested is true (intent captured, projectileSystem handles guard)', () => {
    const world = new World();
    const { sidearmId } = makePlayer(world, {
      sidearmOverrides: { currentAmmo: 0 },
    });
    const input = defaultInput({ fireSidearm: true });
    playerControlSystem(world, input, DT);

    const gun = world.getComponent<Gun>(sidearmId, 'Gun')!;
    expect(gun.fireRequested).toBe(true);
  });

  it('4. Fire long arm while reloading — fireRequested is true (intent captured, projectileSystem handles guard)', () => {
    const world = new World();
    const { longArmId } = makePlayer(world, {
      longArmOverrides: { isReloading: true, reloadTimer: 0.5 },
    });
    const input = defaultInput({ fireLongArm: true });
    playerControlSystem(world, input, DT);

    const gun = world.getComponent<Gun>(longArmId, 'Gun')!;
    expect(gun.fireRequested).toBe(true);
  });

  it('5. Fire sidearm while cooldown positive — fireRequested is true (intent captured, projectileSystem handles guard)', () => {
    const world = new World();
    const { sidearmId } = makePlayer(world, {
      sidearmOverrides: { fireCooldown: 0.2 },
    });
    const input = defaultInput({ fireSidearm: true });
    playerControlSystem(world, input, DT);

    const gun = world.getComponent<Gun>(sidearmId, 'Gun')!;
    expect(gun.fireRequested).toBe(true);
  });

  it('6. Both fire inputs pressed simultaneously — at most one gun fires', () => {
    const world = new World();
    const { sidearmId, longArmId } = makePlayer(world);
    const input = defaultInput({ fireSidearm: true, fireLongArm: true });
    playerControlSystem(world, input, DT);

    const sidearm = world.getComponent<Gun>(sidearmId, 'Gun')!;
    const longArm = world.getComponent<Gun>(longArmId, 'Gun')!;
    const firedCount = (sidearm.fireRequested ? 1 : 0) + (longArm.fireRequested ? 1 : 0);
    expect(firedCount).toBeLessThanOrEqual(1);
    // Sidearm takes priority
    expect(sidearm.fireRequested).toBe(true);
    expect(longArm.fireRequested).toBe(false);
  });

  it('7. Dodge roll while already rolling — no re-initiation', () => {
    const world = new World();
    makePlayer(world, {
      dodgeRollOverrides: {
        isRolling: true,
        rollTimer: 0.2,
        rollDirectionX: 1,
        rollDirectionY: 0,
        cooldownRemaining: 0.8,
      },
    });
    const input = defaultInput({ dodgeRoll: true, moveX: 0, moveY: -1 });
    playerControlSystem(world, input, DT);

    const ids = world.query(['Player', 'DodgeRoll']);
    const roll = world.getComponent<DodgeRoll>(ids[0], 'DodgeRoll')!;
    // Direction should not have changed
    expect(roll.rollDirectionX).toBe(1);
    expect(roll.rollDirectionY).toBe(0);
    expect(roll.rollTimer).toBe(0.2);
  });

  it('8. Dodge roll during cooldown — not initiated', () => {
    const world = new World();
    makePlayer(world, {
      dodgeRollOverrides: { cooldownRemaining: 0.5, isRolling: false },
    });
    const input = defaultInput({ dodgeRoll: true, moveX: 1, moveY: 0 });
    playerControlSystem(world, input, DT);

    const ids = world.query(['Player', 'DodgeRoll']);
    const roll = world.getComponent<DodgeRoll>(ids[0], 'DodgeRoll')!;
    expect(roll.isRolling).toBe(false);
  });

  it('9. Velocity override during roll ignores movement input', () => {
    const world = new World();
    makePlayer(world, {
      dodgeRollOverrides: {
        isRolling: true,
        rollTimer: 0.2,
        rollDirectionX: 0,
        rollDirectionY: 1,
        cooldownRemaining: 0.8,
      },
    });
    const input = defaultInput({ moveX: -1, moveY: -1 });
    playerControlSystem(world, input, DT);

    const ids = world.query(['Player', 'Velocity']);
    const vel = world.getComponent<Velocity>(ids[0], 'Velocity')!;
    expect(vel.x).toBeCloseTo(0);
    expect(vel.z).toBeCloseTo(ROLL_SPEED);
  });

  it('10. SpeedModifier applied correctly — velocity *= 0.5', () => {
    const world = new World();
    makePlayer(world, { speedModifier: 0.5 });
    const input = defaultInput({ moveX: 1, moveY: 0 });
    playerControlSystem(world, input, DT);

    const ids = world.query(['Player', 'Velocity']);
    const vel = world.getComponent<Velocity>(ids[0], 'Velocity')!;
    expect(vel.x).toBeCloseTo(MOVE_SPEED * 0.5);
    expect(vel.z).toBeCloseTo(0);
  });

  it('11. SpeedModifier does NOT affect roll speed', () => {
    const world = new World();
    makePlayer(world, {
      speedModifier: 0.5,
      dodgeRollOverrides: {
        isRolling: true,
        rollTimer: 0.2,
        rollDirectionX: 1,
        rollDirectionY: 0,
        cooldownRemaining: 0.8,
      },
    });
    const input = defaultInput({ moveX: 1, moveY: 0 });
    playerControlSystem(world, input, DT);

    const ids = world.query(['Player', 'Velocity']);
    const vel = world.getComponent<Velocity>(ids[0], 'Velocity')!;
    expect(vel.x).toBeCloseTo(ROLL_SPEED);
    expect(vel.z).toBeCloseTo(0);
  });

  it('12. Rotation faces aim point independent of movement', () => {
    const world = new World();
    makePlayer(world, { position: { x: 0, z: 0 } });
    const input = defaultInput({ moveX: -1, moveY: 0, aimWorldX: 5, aimWorldY: 5 });
    playerControlSystem(world, input, DT);

    const ids = world.query(['Player', 'Rotation']);
    const rot = world.getComponent<Rotation>(ids[0], 'Rotation')!;
    expect(rot.y).toBeCloseTo(Math.atan2(5, 5));
  });

  it('13. openUpgrade with insufficient XP — no transition', () => {
    const world = new World();
    makePlayer(world, {
      sidearmOverrides: { xp: 0 },
      longArmOverrides: { xp: 0 },
    });
    const input = defaultInput({ openUpgrade: true });
    playerControlSystem(world, input, DT);

    expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
  });

  it('14. openUpgrade with exactly enough XP — transition', () => {
    const xpCost = params.traits.xpCosts[0]; // cost for level 0→1
    const world = new World();
    makePlayer(world, {
      longArmOverrides: { xp: xpCost },
    });
    const input = defaultInput({ openUpgrade: true });
    playerControlSystem(world, input, DT);

    expect(useAppStore.getState().currentState).toBe(AppState.GunUpgrade);
  });

  it('15. Reload on already-reloading gun is no-op', () => {
    const world = new World();
    const { longArmId } = makePlayer(world, {
      longArmOverrides: { isReloading: true, reloadTimer: 0.5 },
    });
    const input = defaultInput({ reload: true });
    playerControlSystem(world, input, DT);

    const gun = world.getComponent<Gun>(longArmId, 'Gun')!;
    // Timer should not have been reset
    expect(gun.reloadTimer).toBe(0.5);
  });

  // ── Edge Cases ────────────────────────────────────────────────────────

  it('edge: very small movement input produces small but valid velocity', () => {
    const world = new World();
    makePlayer(world);
    const input = defaultInput({ moveX: 0.0001, moveY: 0 });
    playerControlSystem(world, input, DT);

    const ids = world.query(['Player', 'Velocity']);
    const vel = world.getComponent<Velocity>(ids[0], 'Velocity')!;
    expect(vel.x).toBeCloseTo(0.0001 * MOVE_SPEED);
    expect(vel.z).toBeCloseTo(0);
    expect(Number.isNaN(vel.x)).toBe(false);
  });

  it('edge: all inputs true simultaneously — deterministic handling', () => {
    const xpCost = params.traits.xpCosts[0];
    const world = new World();
    const { sidearmId, longArmId } = makePlayer(world, {
      longArmOverrides: { xp: xpCost },
    });
    const input = defaultInput({
      moveX: 1,
      moveY: 1,
      aimWorldX: 10,
      aimWorldY: 10,
      fireSidearm: true,
      fireLongArm: true,
      reload: true,
      dodgeRoll: true,
      interact: true,
      openUpgrade: true,
      pause: true,
    });

    // Should not throw
    expect(() => playerControlSystem(world, input, DT)).not.toThrow();

    // At most one gun fires
    const sidearm = world.getComponent<Gun>(sidearmId, 'Gun')!;
    const longArm = world.getComponent<Gun>(longArmId, 'Gun')!;
    const firedCount = (sidearm.fireRequested ? 1 : 0) + (longArm.fireRequested ? 1 : 0);
    expect(firedCount).toBeLessThanOrEqual(1);
  });

  it('edge: missing SpeedModifier component — base speed, no crash', () => {
    const world = new World();
    makePlayer(world); // no speedModifier
    const input = defaultInput({ moveX: 1, moveY: 0 });
    playerControlSystem(world, input, DT);

    const ids = world.query(['Player', 'Velocity']);
    const vel = world.getComponent<Velocity>(ids[0], 'Velocity')!;
    expect(vel.x).toBeCloseTo(MOVE_SPEED);
  });

  it('edge: missing DodgeRoll component — no crash', () => {
    const world = new World();
    makePlayer(world, { noDodgeRoll: true });
    const input = defaultInput({ dodgeRoll: true, moveX: 1, moveY: 0 });

    expect(() => playerControlSystem(world, input, DT)).not.toThrow();

    const ids = world.query(['Player', 'Velocity']);
    const vel = world.getComponent<Velocity>(ids[0], 'Velocity')!;
    expect(vel.x).toBeCloseTo(MOVE_SPEED);
  });

  // ── Additional fire/slot tests ────────────────────────────────────────

  it('fireSidearm sets activeSlot to Sidearm', () => {
    const world = new World();
    const { playerId } = makePlayer(world);
    const input = defaultInput({ fireSidearm: true });
    playerControlSystem(world, input, DT);

    const player = world.getComponent<Player>(playerId, 'Player')!;
    expect(player.activeSlot).toBe(WeaponSlot.Sidearm);
  });

  it('fireLongArm sets activeSlot to LongArm', () => {
    const world = new World();
    const { playerId } = makePlayer(world);
    // Set initial active slot to Sidearm
    world.getComponent<Player>(playerId, 'Player')!.activeSlot = WeaponSlot.Sidearm;
    const input = defaultInput({ fireLongArm: true });
    playerControlSystem(world, input, DT);

    const player = world.getComponent<Player>(playerId, 'Player')!;
    expect(player.activeSlot).toBe(WeaponSlot.LongArm);
  });

  it('fireRequested never set on wrong gun slot', () => {
    const world = new World();
    const { sidearmId, longArmId } = makePlayer(world);
    const input = defaultInput({ fireSidearm: true });
    playerControlSystem(world, input, DT);

    const sidearm = world.getComponent<Gun>(sidearmId, 'Gun')!;
    const longArm = world.getComponent<Gun>(longArmId, 'Gun')!;
    expect(sidearm.fireRequested).toBe(true);
    expect(longArm.fireRequested).toBe(false);
  });

  it('reload starts on active gun: sets isReloading and reloadTimer', () => {
    const world = new World();
    const { longArmId } = makePlayer(world, {
      longArmOverrides: { reloadTime: 2.0 },
    });
    const input = defaultInput({ reload: true });
    playerControlSystem(world, input, DT);

    const gun = world.getComponent<Gun>(longArmId, 'Gun')!;
    expect(gun.isReloading).toBe(true);
    expect(gun.reloadTimer).toBe(2.0);
  });

  it('pause transitions to Paused unconditionally', () => {
    const world = new World();
    makePlayer(world);
    const input = defaultInput({ pause: true });
    playerControlSystem(world, input, DT);

    expect(useAppStore.getState().currentState).toBe(AppState.Paused);
  });

  it('cardinal movement (1,0) produces exact movementSpeed', () => {
    const world = new World();
    makePlayer(world);
    const input = defaultInput({ moveX: 1, moveY: 0 });
    playerControlSystem(world, input, DT);

    const ids = world.query(['Player', 'Velocity']);
    const vel = world.getComponent<Velocity>(ids[0], 'Velocity')!;
    expect(vel.x).toBeCloseTo(MOVE_SPEED);
    expect(vel.z).toBeCloseTo(0);
  });

  // ── aimYaw (pointer lock camera control) ──────────────────────────────

  describe('aimYaw from camera orbit', () => {
    it('when aimYaw is defined, rotation.y = aimYaw (not computed from aimWorld)', () => {
      const world = new World();
      makePlayer(world, { position: { x: 0, z: 0 } });
      const input = defaultInput({ aimWorldX: 10, aimWorldY: 10, aimYaw: 1.5 });
      playerControlSystem(world, input, DT);

      const ids = world.query(['Player', 'Rotation']);
      const rot = world.getComponent<Rotation>(ids[0], 'Rotation')!;
      expect(rot.y).toBe(1.5);
    });

    it('when aimYaw is undefined, falls back to atan2 from aimWorld', () => {
      const world = new World();
      makePlayer(world, { position: { x: 0, z: 0 } });
      const input = defaultInput({ aimWorldX: 5, aimWorldY: 5 });
      // aimYaw is undefined by default
      playerControlSystem(world, input, DT);

      const ids = world.query(['Player', 'Rotation']);
      const rot = world.getComponent<Rotation>(ids[0], 'Rotation')!;
      expect(rot.y).toBeCloseTo(Math.atan2(5, 5));
    });
  });

  describe('pointerLockLost', () => {
    it('triggers AppState.Paused transition', () => {
      const world = new World();
      makePlayer(world);
      const input = defaultInput({ pointerLockLost: true });
      playerControlSystem(world, input, DT);

      expect(useAppStore.getState().currentState).toBe(AppState.Paused);
    });

    it('does not pause when pointerLockLost is false', () => {
      const world = new World();
      makePlayer(world);
      const input = defaultInput({ pointerLockLost: false });
      playerControlSystem(world, input, DT);

      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
    });
  });

  // ── Debug Speed Tuning ──────────────────────────────────────────────

  describe('debug speed tuning', () => {
    it('debugSpeedUp increases baseMovementSpeed by 1.0', () => {
      const originalSpeed = params.player.baseMovementSpeed;
      const world = new World();
      makePlayer(world);
      const input = defaultInput({ debugSpeedUp: true });
      playerControlSystem(world, input, DT);

      expect(params.player.baseMovementSpeed).toBe(originalSpeed + 1.0);
      // Restore
      params.player.baseMovementSpeed = originalSpeed;
    });

    it('debugSpeedDown decreases baseMovementSpeed by 1.0', () => {
      const originalSpeed = params.player.baseMovementSpeed;
      params.player.baseMovementSpeed = 5.0;
      const world = new World();
      makePlayer(world);
      const input = defaultInput({ debugSpeedDown: true });
      playerControlSystem(world, input, DT);

      expect(params.player.baseMovementSpeed).toBe(4.0);
      // Restore
      params.player.baseMovementSpeed = originalSpeed;
    });

    it('debugSpeedDown clamps at minimum 1.0', () => {
      const originalSpeed = params.player.baseMovementSpeed;
      params.player.baseMovementSpeed = 1.0;
      const world = new World();
      makePlayer(world);
      const input = defaultInput({ debugSpeedDown: true });
      playerControlSystem(world, input, DT);

      expect(params.player.baseMovementSpeed).toBe(1.0);
      // Restore
      params.player.baseMovementSpeed = originalSpeed;
    });
  });
});
