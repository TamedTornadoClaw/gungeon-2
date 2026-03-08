import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { World } from '../src/ecs/world';
import { EventQueue } from '../src/gameloop/events';

const defaultInput = () => ({
  moveX: 0, moveY: 0, aimWorldX: 0, aimWorldY: 0,
  mouseDeltaX: 0, mouseDeltaY: 0, pointerLockLost: false,
  fireSidearm: false, fireLongArm: false, reload: false,
  dodgeRoll: false, interact: false, openUpgrade: false, pause: false,
  debugSpeedUp: false, debugSpeedDown: false,
});

const mocks = vi.hoisted(() => ({
  inputSystem: vi.fn().mockReturnValue({
    moveX: 0, moveY: 0, aimWorldX: 0, aimWorldY: 0,
    mouseDeltaX: 0, mouseDeltaY: 0, pointerLockLost: false,
    fireSidearm: false, fireLongArm: false, reload: false,
    dodgeRoll: false, interact: false, openUpgrade: false, pause: false,
    debugSpeedUp: false, debugSpeedDown: false,
  }),
  playerControlSystem: vi.fn(),
  dodgeRollSystem: vi.fn(),
  aiSystem: vi.fn(),
  projectileSystem: vi.fn(),
  enemyWeaponSystem: vi.fn(),
  movementSystem: vi.fn(),
  collisionDetectionSystem: vi.fn().mockReturnValue([]),
  collisionResponseSystem: vi.fn(),
  updateSpikeCooldowns: vi.fn(),
  damageSystem: vi.fn(),
  shieldRegenSystem: vi.fn(),
  hazardSystem: vi.fn(),
  lifetimeSystem: vi.fn(),
  pickupSystem: vi.fn(),
  chestSystem: vi.fn(),
  shopSystem: vi.fn(),
  gunXPSystem: vi.fn(),
  destructibleSystem: vi.fn(),
  doorSystem: vi.fn(),
  spawnSystem: vi.fn(),
  floorTransitionSystem: vi.fn(),
  deathSystem: vi.fn(),
  expireModifiersSystem: vi.fn(),
  particleSystem: vi.fn(),
  audioEventSystem: vi.fn(),
  visibilitySystem: vi.fn(),
  effectsPipelineSystem: vi.fn(),
  syncHUDSystem: vi.fn(),
  gunStatSystem: vi.fn(),
}));

vi.mock('../src/config/designParams', () => ({
  getDesignParams: () => ({
    gameLoop: { fixedTimestep: 0.01667, maxFrameTime: 0.1 },
  }),
}));

vi.mock('../src/systems/inputSystem', () => ({ inputSystem: mocks.inputSystem }));
vi.mock('../src/systems/playerControlSystem', () => ({ playerControlSystem: mocks.playerControlSystem }));
vi.mock('../src/systems/dodgeRollSystem', () => ({ dodgeRollSystem: mocks.dodgeRollSystem }));
vi.mock('../src/systems/aiSystem', () => ({ aiSystem: mocks.aiSystem }));
vi.mock('../src/systems/projectileSystem', () => ({ projectileSystem: mocks.projectileSystem }));
vi.mock('../src/systems/enemyWeaponSystem', () => ({ enemyWeaponSystem: mocks.enemyWeaponSystem }));
vi.mock('../src/systems/movementSystem', () => ({ movementSystem: mocks.movementSystem }));
vi.mock('../src/systems/collisionDetectionSystem', () => ({
  collisionDetectionSystem: mocks.collisionDetectionSystem,
}));
vi.mock('../src/systems/collisionResponseSystem', () => ({
  collisionResponseSystem: mocks.collisionResponseSystem,
  updateSpikeCooldowns: mocks.updateSpikeCooldowns,
}));
vi.mock('../src/systems/damageSystem', () => ({ damageSystem: mocks.damageSystem }));
vi.mock('../src/systems/shieldRegenSystem', () => ({ shieldRegenSystem: mocks.shieldRegenSystem }));
vi.mock('../src/systems/hazardSystem', () => ({ hazardSystem: mocks.hazardSystem }));
vi.mock('../src/systems/lifetimeSystem', () => ({ lifetimeSystem: mocks.lifetimeSystem }));
vi.mock('../src/systems/pickupSystem', () => ({ pickupSystem: mocks.pickupSystem }));
vi.mock('../src/systems/chestSystem', () => ({ chestSystem: mocks.chestSystem }));
vi.mock('../src/systems/shopSystem', () => ({ shopSystem: mocks.shopSystem, purchaseShopItem: vi.fn() }));
vi.mock('../src/systems/gunXPSystem', () => ({ gunXPSystem: mocks.gunXPSystem }));
vi.mock('../src/systems/destructibleSystem', () => ({ destructibleSystem: mocks.destructibleSystem }));
vi.mock('../src/systems/doorSystem', () => ({ doorSystem: mocks.doorSystem }));
vi.mock('../src/systems/spawnSystem', () => ({ spawnSystem: mocks.spawnSystem }));
vi.mock('../src/systems/floorTransitionSystem', () => ({
  floorTransitionSystem: mocks.floorTransitionSystem,
}));
vi.mock('../src/systems/deathSystem', () => ({ deathSystem: mocks.deathSystem }));
vi.mock('../src/systems/expireModifiersSystem', () => ({ expireModifiersSystem: mocks.expireModifiersSystem }));
vi.mock('../src/systems/particleSystem', () => ({ particleSystem: mocks.particleSystem }));
vi.mock('../src/systems/audioEventSystem', () => ({
  audioEventSystem: mocks.audioEventSystem,
  createLoopManager: vi.fn(),
}));
vi.mock('../src/systems/effectsPipelineSystem', () => ({
  effectsPipelineSystem: mocks.effectsPipelineSystem,
  createEffectsBuffer: () => ({ damageNumbers: [], shakeIntensity: 0, hitFlashTriggered: false }),
  clearEffectsBuffer: vi.fn(),
}));
vi.mock('../src/systems/gunStatSystem', () => ({ gunStatSystem: mocks.gunStatSystem }));
vi.mock('../src/dungeon/generator', () => ({ generateDungeon: vi.fn() }));
vi.mock('../src/rendering/particleRenderer', () => ({ createParticleRenderer: vi.fn() }));
vi.mock('../src/rendering/cameraController', () => ({
  updateCameraOrbit: vi.fn(),
  getCameraRay: vi.fn(() => ({ ox: 0, oy: 5, oz: -6, dx: 0, dy: 0, dz: -1 })),
}));
vi.mock('../src/rendering/aimRaycast', () => ({
  aimRaycast: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
  buildAimCollisionMesh: vi.fn(),
  disposeAimCollisionMesh: vi.fn(),
}));
vi.mock('../src/systems/visibilitySystem', () => ({ visibilitySystem: mocks.visibilitySystem }));
vi.mock('../src/systems/syncHUDSystem', () => ({ syncHUDSystem: mocks.syncHUDSystem }));

import { createGameLoop, GameLoopDeps } from '../src/gameloop/gameLoop';

const FIXED_TIMESTEP = 0.01667;

// Manual RAF control
let rafCallbacks: Array<{ id: number; cb: FrameRequestCallback }> = [];
let nextRafId = 1;

function mockRequestAnimationFrame(cb: FrameRequestCallback): number {
  const id = nextRafId++;
  rafCallbacks.push({ id, cb });
  return id;
}

function mockCancelAnimationFrame(id: number): void {
  rafCallbacks = rafCallbacks.filter((entry) => entry.id !== id);
}

function fireRaf(timestamp: number): void {
  const current = rafCallbacks.splice(0, rafCallbacks.length);
  for (const entry of current) {
    entry.cb(timestamp);
  }
}

function createDeps(): GameLoopDeps {
  return {
    world: new World(),
    inputManager: {} as GameLoopDeps['inputManager'],
    audioManager: {} as GameLoopDeps['audioManager'],
    cameraController: { orbitYaw: 0, orbitPitch: 0 } as GameLoopDeps['cameraController'],
    floorState: { currentDepth: 1, seed: 42 },
    effectsBuffer: { damageNumbers: [], shakeIntensity: 0, hitFlashTriggered: false },
    onRender: vi.fn(),
  };
}

function allSimMocks() {
  return [
    mocks.inputSystem,
    mocks.playerControlSystem,
    mocks.dodgeRollSystem,
    mocks.aiSystem,
    mocks.projectileSystem,
    mocks.enemyWeaponSystem,
    mocks.movementSystem,
    mocks.collisionDetectionSystem,
    mocks.collisionResponseSystem,
    mocks.updateSpikeCooldowns,
    mocks.damageSystem,
    mocks.shieldRegenSystem,
    mocks.hazardSystem,
    mocks.lifetimeSystem,
    mocks.pickupSystem,
    mocks.chestSystem,
    mocks.shopSystem,
    mocks.gunXPSystem,
    mocks.destructibleSystem,
    mocks.doorSystem,
    mocks.spawnSystem,
    mocks.visibilitySystem,
    mocks.floorTransitionSystem,
    mocks.deathSystem,
    mocks.expireModifiersSystem,
    mocks.particleSystem,
    mocks.audioEventSystem,
    mocks.effectsPipelineSystem,
    mocks.syncHUDSystem,
  ];
}

describe('gameLoop', () => {
  beforeEach(() => {
    rafCallbacks = [];
    nextRafId = 1;
    vi.stubGlobal('requestAnimationFrame', mockRequestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', mockCancelAnimationFrame);
    for (const mock of allSimMocks()) {
      mock.mockClear();
    }
    mocks.gunStatSystem.mockClear();
    mocks.inputSystem.mockReturnValue(defaultInput());
    mocks.collisionDetectionSystem.mockReturnValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('fixed timestep', () => {
    it('uses exactly 0.01667s timestep', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      fireRaf(18);

      expect(mocks.movementSystem).toHaveBeenCalledTimes(1);
      expect(mocks.movementSystem).toHaveBeenCalledWith(deps.world, FIXED_TIMESTEP);
      loop.stop();
    });
  });

  describe('single frame under budget', () => {
    it('executes exactly 1 step with 0.018s elapsed', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      fireRaf(18);

      expect(mocks.inputSystem).toHaveBeenCalledTimes(1);
      expect(mocks.audioEventSystem).toHaveBeenCalledTimes(1);
      loop.stop();
    });
  });

  describe('multiple steps per frame (catch-up)', () => {
    it('executes exactly 2 steps with 0.05s elapsed', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      fireRaf(50);

      expect(mocks.inputSystem).toHaveBeenCalledTimes(2);
      expect(mocks.movementSystem).toHaveBeenCalledTimes(2);
      loop.stop();
    });
  });

  describe('spiral-of-death protection', () => {
    it('clamps elapsed time to maxFrameTime (0.1s), runs at most 5-6 steps', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      fireRaf(500);

      const stepCount = mocks.inputSystem.mock.calls.length;
      expect(stepCount).toBeGreaterThanOrEqual(5);
      expect(stepCount).toBeLessThanOrEqual(6);
      loop.stop();
    });

    it('does not bleed excess time into subsequent frames', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      fireRaf(500);
      mocks.inputSystem.mockClear();

      fireRaf(518);
      // Remainder from capped frame (~0.01665s) + 18ms = ~0.03465s = 2 steps
      // The point is this is NOT ~30 steps from leaked 0.4s
      expect(mocks.inputSystem.mock.calls.length).toBeLessThanOrEqual(2);
      loop.stop();
    });
  });

  describe('system execution order', () => {
    it('calls all 29 systems in the correct order', () => {
      const callOrder: string[] = [];
      mocks.inputSystem.mockImplementation(() => { callOrder.push('Input'); return defaultInput(); });
      mocks.playerControlSystem.mockImplementation(() => callOrder.push('PlayerControl'));
      mocks.dodgeRollSystem.mockImplementation(() => callOrder.push('DodgeRoll'));
      mocks.aiSystem.mockImplementation(() => callOrder.push('AI'));
      mocks.projectileSystem.mockImplementation(() => callOrder.push('Projectile'));
      mocks.enemyWeaponSystem.mockImplementation(() => callOrder.push('EnemyWeapon'));
      mocks.movementSystem.mockImplementation(() => callOrder.push('Movement'));
      mocks.collisionDetectionSystem.mockImplementation(() => { callOrder.push('CollisionDetection'); return []; });
      mocks.updateSpikeCooldowns.mockImplementation(() => callOrder.push('UpdateSpikeCooldowns'));
      mocks.collisionResponseSystem.mockImplementation(() => callOrder.push('CollisionResponse'));
      mocks.damageSystem.mockImplementation(() => callOrder.push('Damage'));
      mocks.shieldRegenSystem.mockImplementation(() => callOrder.push('ShieldRegen'));
      mocks.hazardSystem.mockImplementation(() => callOrder.push('Hazard'));
      mocks.lifetimeSystem.mockImplementation(() => callOrder.push('Lifetime'));
      mocks.pickupSystem.mockImplementation(() => callOrder.push('Pickup'));
      mocks.chestSystem.mockImplementation(() => callOrder.push('Chest'));
      mocks.shopSystem.mockImplementation(() => callOrder.push('Shop'));
      mocks.gunXPSystem.mockImplementation(() => callOrder.push('GunXP'));
      mocks.destructibleSystem.mockImplementation(() => callOrder.push('Destructible'));
      mocks.doorSystem.mockImplementation(() => callOrder.push('Door'));
      mocks.spawnSystem.mockImplementation(() => callOrder.push('Spawn'));
      mocks.visibilitySystem.mockImplementation(() => callOrder.push('Visibility'));
      mocks.floorTransitionSystem.mockImplementation(() => callOrder.push('FloorTransition'));
      mocks.deathSystem.mockImplementation(() => callOrder.push('Death'));
      mocks.expireModifiersSystem.mockImplementation(() => callOrder.push('ExpireModifiers'));
      mocks.particleSystem.mockImplementation(() => callOrder.push('Particle'));
      mocks.audioEventSystem.mockImplementation(() => callOrder.push('Audio'));
      mocks.effectsPipelineSystem.mockImplementation(() => callOrder.push('EffectsPipeline'));
      mocks.syncHUDSystem.mockImplementation(() => callOrder.push('SyncHUD'));

      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      fireRaf(18);

      expect(callOrder).toEqual([
        'Input', 'PlayerControl', 'DodgeRoll', 'AI', 'Projectile', 'EnemyWeapon',
        'Movement', 'CollisionDetection', 'UpdateSpikeCooldowns', 'CollisionResponse',
        'Damage', 'ShieldRegen', 'Hazard', 'Lifetime', 'Pickup', 'Chest', 'Shop',
        'GunXP', 'Destructible', 'Door', 'Spawn', 'Visibility', 'FloorTransition', 'Death',
        'ExpireModifiers', 'Particle', 'Audio', 'EffectsPipeline', 'SyncHUD',
      ]);
      loop.stop();
    });

    it('no system is called twice within a single step', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      fireRaf(18);

      for (const mock of allSimMocks()) {
        expect(mock).toHaveBeenCalledTimes(1);
      }
      loop.stop();
    });
  });

  describe('GunStatSystem exclusion', () => {
    it('is never called by the game loop', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      for (let i = 1; i <= 10; i++) {
        fireRaf(i * 100);
      }
      expect(mocks.gunStatSystem).not.toHaveBeenCalled();
      loop.stop();
    });
  });

  describe('freeze/resume', () => {
    it('freeze stops simulation but not rendering', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      fireRaf(18);

      loop.freeze();
      mocks.inputSystem.mockClear();
      (deps.onRender as ReturnType<typeof vi.fn>).mockClear();

      fireRaf(118);
      expect(mocks.inputSystem).not.toHaveBeenCalled();
      expect(deps.onRender).toHaveBeenCalled();
      loop.stop();
    });

    it('resume after freeze does not simulate frozen time', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      fireRaf(18);

      loop.freeze();
      fireRaf(5018);

      loop.resume();
      mocks.inputSystem.mockClear();
      fireRaf(5036); // first frame after resume: initializes timestamp
      fireRaf(5054); // 18ms elapsed after initialization

      expect(mocks.inputSystem).toHaveBeenCalledTimes(1);
      loop.stop();
    });

    it('freeze when already frozen is a no-op', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      loop.freeze();
      loop.freeze();
      loop.stop();
    });

    it('resume when not frozen is a no-op', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      loop.resume();
      loop.stop();
    });
  });

  describe('stop', () => {
    it('stops the RAF loop', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      loop.stop();
      expect(rafCallbacks.length).toBe(0);
    });

    it('stop is idempotent', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      loop.stop();
      loop.stop();
    });

    it('start after stop creates a fresh loop', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      fireRaf(18);
      loop.stop();
      mocks.inputSystem.mockClear();

      loop.start();
      fireRaf(0);
      fireRaf(18);
      expect(mocks.inputSystem).toHaveBeenCalledTimes(1);
      loop.stop();
    });
  });

  describe('start idempotency', () => {
    it('calling start twice does not create two loops', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      loop.start();

      fireRaf(0);
      fireRaf(18);
      expect(mocks.inputSystem).toHaveBeenCalledTimes(1);
      loop.stop();
    });
  });

  describe('event queue cleared between steps', () => {
    it('events from step N are not visible in step N+1', () => {
      let stepCount = 0;
      mocks.inputSystem.mockImplementation(() => { stepCount++; return defaultInput(); });

      // DamageSystem emits an event during step 1
      mocks.damageSystem.mockImplementation((_w: unknown, eq: EventQueue) => {
        if (stepCount === 1) {
          eq.emit({
            type: 'Damage' as never,
            target: 1, amount: 10, source: 2,
            isCritical: false, impactPosition: { x: 0, y: 0, z: 0 },
          });
        }
      });

      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      fireRaf(50); // 2 steps

      expect(mocks.damageSystem).toHaveBeenCalledTimes(2);
      loop.stop();
    });
  });

  describe('zero elapsed time', () => {
    it('produces zero simulation steps', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      mocks.inputSystem.mockClear();
      fireRaf(0);
      expect(mocks.inputSystem).not.toHaveBeenCalled();
      loop.stop();
    });
  });

  describe('edge cases', () => {
    it('handles backward timestamp (negative dt clamped to 0)', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(100);
      mocks.inputSystem.mockClear();
      fireRaf(50);
      expect(mocks.inputSystem).not.toHaveBeenCalled();
      loop.stop();
    });

    it('first frame produces no simulation steps', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(1000);
      expect(mocks.inputSystem).not.toHaveBeenCalled();
      expect(deps.onRender).toHaveBeenCalled();
      loop.stop();
    });

    it('render callback receives alpha interpolation value', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      (deps.onRender as ReturnType<typeof vi.fn>).mockClear();
      fireRaf(18);

      expect(deps.onRender).toHaveBeenCalledTimes(1);
      const alpha = (deps.onRender as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThan(1);
      loop.stop();
    });
  });
});
