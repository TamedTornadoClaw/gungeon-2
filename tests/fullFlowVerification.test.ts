import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppState } from '../src/ecs/components';
import { useAppStore } from '../src/store/appStore';
import { World } from '../src/ecs/world';

// ── System mocks ──────────────────────────────────────────────────────────────

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
  visibilitySystem: vi.fn(),
  floorTransitionSystem: vi.fn(),
  deathSystem: vi.fn(),
  expireModifiersSystem: vi.fn(),
  particleSystem: vi.fn(),
  audioEventSystem: vi.fn(),
  effectsPipelineSystem: vi.fn(),
  syncHUDSystem: vi.fn(),
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
vi.mock('../src/systems/gunStatSystem', () => ({ gunStatSystem: vi.fn() }));
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

import { createGameLoop, type GameLoopDeps } from '../src/gameloop/gameLoop';

// ── RAF helpers ───────────────────────────────────────────────────────────────

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

function resetStore() {
  useAppStore.setState({
    currentState: AppState.Loading,
    previousState: null,
    selectedSidearm: null,
    selectedLongArm: null,
    comparisonGunEntityId: null,
    comparisonSlot: null,
    forcedUpgradeGunSlot: null,
    activeShopEntityId: null,
    runStats: null,
  });
}

function transition(to: AppState) {
  useAppStore.getState().transition(to);
}

function allSystemMocks() {
  return [
    mocks.inputSystem, mocks.playerControlSystem, mocks.dodgeRollSystem,
    mocks.aiSystem, mocks.projectileSystem, mocks.enemyWeaponSystem,
    mocks.movementSystem, mocks.collisionDetectionSystem,
    mocks.collisionResponseSystem, mocks.updateSpikeCooldowns,
    mocks.damageSystem, mocks.shieldRegenSystem, mocks.hazardSystem,
    mocks.lifetimeSystem, mocks.pickupSystem, mocks.chestSystem,
    mocks.shopSystem, mocks.gunXPSystem, mocks.destructibleSystem,
    mocks.doorSystem, mocks.spawnSystem, mocks.visibilitySystem,
    mocks.floorTransitionSystem,
    mocks.deathSystem, mocks.expireModifiersSystem, mocks.particleSystem,
    mocks.audioEventSystem, mocks.effectsPipelineSystem, mocks.syncHUDSystem,
  ];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Full Game Flow Verification', () => {
  beforeEach(() => {
    resetStore();
    rafCallbacks = [];
    nextRafId = 1;
    vi.stubGlobal('requestAnimationFrame', mockRequestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', mockCancelAnimationFrame);
    for (const mock of allSystemMocks()) {
      mock.mockClear();
    }
    mocks.inputSystem.mockReturnValue({
      moveX: 0, moveY: 0, aimWorldX: 0, aimWorldY: 0,
      fireSidearm: false, fireLongArm: false, reload: false,
      dodgeRoll: false, interact: false, openUpgrade: false, pause: false,
    });
    mocks.collisionDetectionSystem.mockReturnValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('state machine flow', () => {
    it('Loading → MainMenu → WeaponSelect → Gameplay → Paused → Gameplay → Death → MainMenu', () => {
      expect(useAppStore.getState().currentState).toBe(AppState.Loading);

      transition(AppState.MainMenu);
      expect(useAppStore.getState().currentState).toBe(AppState.MainMenu);

      transition(AppState.WeaponSelect);
      expect(useAppStore.getState().currentState).toBe(AppState.WeaponSelect);

      transition(AppState.Gameplay);
      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);

      transition(AppState.Paused);
      expect(useAppStore.getState().currentState).toBe(AppState.Paused);

      transition(AppState.Gameplay);
      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);

      transition(AppState.Death);
      expect(useAppStore.getState().currentState).toBe(AppState.Death);

      transition(AppState.MainMenu);
      expect(useAppStore.getState().currentState).toBe(AppState.MainMenu);
    });

    it('Loading → MainMenu → WeaponSelect → Gameplay → Victory → MainMenu', () => {
      transition(AppState.MainMenu);
      transition(AppState.WeaponSelect);
      transition(AppState.Gameplay);
      transition(AppState.Victory);
      expect(useAppStore.getState().currentState).toBe(AppState.Victory);

      transition(AppState.MainMenu);
      expect(useAppStore.getState().currentState).toBe(AppState.MainMenu);
    });

    it('previousState is tracked correctly through transitions', () => {
      transition(AppState.MainMenu);
      expect(useAppStore.getState().previousState).toBe(AppState.Loading);

      transition(AppState.WeaponSelect);
      expect(useAppStore.getState().previousState).toBe(AppState.MainMenu);

      transition(AppState.Gameplay);
      expect(useAppStore.getState().previousState).toBe(AppState.WeaponSelect);

      transition(AppState.Paused);
      expect(useAppStore.getState().previousState).toBe(AppState.Gameplay);
    });

    it('invalid transition Loading → Gameplay throws', () => {
      expect(() => transition(AppState.Gameplay)).toThrow();
    });

    it('invalid transition MainMenu → Gameplay throws (must go through WeaponSelect)', () => {
      transition(AppState.MainMenu);
      expect(() => transition(AppState.Gameplay)).toThrow();
    });

    it('invalid transition Death → Gameplay throws', () => {
      transition(AppState.MainMenu);
      transition(AppState.WeaponSelect);
      transition(AppState.Gameplay);
      transition(AppState.Death);
      expect(() => transition(AppState.Gameplay)).toThrow();
    });

    it('Settings returns to previous state only', () => {
      transition(AppState.MainMenu);
      transition(AppState.Settings);
      expect(useAppStore.getState().currentState).toBe(AppState.Settings);
      expect(useAppStore.getState().previousState).toBe(AppState.MainMenu);

      // Can return to MainMenu (previous state)
      transition(AppState.MainMenu);
      expect(useAppStore.getState().currentState).toBe(AppState.MainMenu);
    });

    it('Settings rejects transition to non-previous state', () => {
      transition(AppState.MainMenu);
      transition(AppState.Settings);
      expect(() => transition(AppState.WeaponSelect)).toThrow();
    });

    it('Gameplay → all overlay states → back to Gameplay', () => {
      transition(AppState.MainMenu);
      transition(AppState.WeaponSelect);
      transition(AppState.Gameplay);

      const overlayStates = [
        AppState.Paused,
        AppState.GunComparison,
        AppState.GunUpgrade,
        AppState.ForcedUpgrade,
        AppState.ShopBrowse,
      ];

      for (const overlay of overlayStates) {
        transition(overlay);
        expect(useAppStore.getState().currentState).toBe(overlay);
        transition(AppState.Gameplay);
        expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
      }
    });
  });

  describe('game loop starts/stops/freezes correctly', () => {
    it('game loop start → run one frame → stop', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);

      loop.start();
      fireRaf(0);
      fireRaf(18);

      // All systems should have been called once
      expect(mocks.inputSystem).toHaveBeenCalledTimes(1);
      expect(mocks.movementSystem).toHaveBeenCalledTimes(1);

      loop.stop();
      // After stop, no more RAF callbacks
      expect(rafCallbacks.length).toBe(0);
    });

    it('freeze stops simulation but onRender still fires', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);

      loop.start();
      fireRaf(0);
      fireRaf(18);
      mocks.inputSystem.mockClear();
      (deps.onRender as ReturnType<typeof vi.fn>).mockClear();

      loop.freeze();
      fireRaf(100);

      expect(mocks.inputSystem).not.toHaveBeenCalled();
      expect(deps.onRender).toHaveBeenCalled();

      loop.stop();
    });

    it('resume after freeze resumes simulation without replay of frozen time', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);

      loop.start();
      fireRaf(0);
      fireRaf(18);

      loop.freeze();
      fireRaf(5000); // 5 seconds of frozen time

      loop.resume();
      mocks.inputSystem.mockClear();
      fireRaf(5018); // re-init timestamp
      fireRaf(5036); // 18ms elapsed = 1 step

      expect(mocks.inputSystem).toHaveBeenCalledTimes(1);
      loop.stop();
    });

    it('stop after freeze cleans up', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);

      loop.start();
      fireRaf(0);
      loop.freeze();
      loop.stop();

      expect(rafCallbacks.length).toBe(0);
    });
  });

  describe('all systems callable without errors', () => {
    it('every system mock can be invoked from the game loop', () => {
      const deps = createDeps();
      const loop = createGameLoop(deps);

      loop.start();
      fireRaf(0);
      fireRaf(18);

      // Verify every system in the pipeline was called
      const systemNames = [
        'inputSystem', 'playerControlSystem', 'dodgeRollSystem',
        'aiSystem', 'projectileSystem', 'enemyWeaponSystem',
        'movementSystem', 'collisionDetectionSystem',
        'collisionResponseSystem', 'updateSpikeCooldowns',
        'damageSystem', 'shieldRegenSystem', 'hazardSystem',
        'lifetimeSystem', 'pickupSystem', 'chestSystem',
        'shopSystem', 'gunXPSystem', 'destructibleSystem',
        'doorSystem', 'spawnSystem', 'visibilitySystem', 'floorTransitionSystem',
        'deathSystem', 'expireModifiersSystem', 'particleSystem',
        'audioEventSystem', 'effectsPipelineSystem', 'syncHUDSystem',
      ] as const;

      for (const name of systemNames) {
        expect(mocks[name], `${name} should have been called`).toHaveBeenCalled();
      }

      loop.stop();
    });

    it('systems execute in correct order within a single step', () => {
      const callOrder: string[] = [];
      mocks.inputSystem.mockImplementation(() => { callOrder.push('inputSystem'); return { moveX: 0, moveY: 0, aimWorldX: 0, aimWorldY: 0, fireSidearm: false, fireLongArm: false, reload: false, dodgeRoll: false, interact: false, openUpgrade: false, pause: false }; });
      mocks.playerControlSystem.mockImplementation(() => callOrder.push('playerControlSystem'));
      mocks.dodgeRollSystem.mockImplementation(() => callOrder.push('dodgeRollSystem'));
      mocks.aiSystem.mockImplementation(() => callOrder.push('aiSystem'));
      mocks.projectileSystem.mockImplementation(() => callOrder.push('projectileSystem'));
      mocks.enemyWeaponSystem.mockImplementation(() => callOrder.push('enemyWeaponSystem'));
      mocks.movementSystem.mockImplementation(() => callOrder.push('movementSystem'));
      mocks.collisionDetectionSystem.mockImplementation(() => { callOrder.push('collisionDetectionSystem'); return []; });
      mocks.updateSpikeCooldowns.mockImplementation(() => callOrder.push('updateSpikeCooldowns'));
      mocks.collisionResponseSystem.mockImplementation(() => callOrder.push('collisionResponseSystem'));
      mocks.damageSystem.mockImplementation(() => callOrder.push('damageSystem'));
      mocks.shieldRegenSystem.mockImplementation(() => callOrder.push('shieldRegenSystem'));
      mocks.hazardSystem.mockImplementation(() => callOrder.push('hazardSystem'));
      mocks.lifetimeSystem.mockImplementation(() => callOrder.push('lifetimeSystem'));
      mocks.pickupSystem.mockImplementation(() => callOrder.push('pickupSystem'));
      mocks.chestSystem.mockImplementation(() => callOrder.push('chestSystem'));
      mocks.shopSystem.mockImplementation(() => callOrder.push('shopSystem'));
      mocks.gunXPSystem.mockImplementation(() => callOrder.push('gunXPSystem'));
      mocks.destructibleSystem.mockImplementation(() => callOrder.push('destructibleSystem'));
      mocks.doorSystem.mockImplementation(() => callOrder.push('doorSystem'));
      mocks.spawnSystem.mockImplementation(() => callOrder.push('spawnSystem'));
      mocks.visibilitySystem.mockImplementation(() => callOrder.push('visibilitySystem'));
      mocks.floorTransitionSystem.mockImplementation(() => callOrder.push('floorTransitionSystem'));
      mocks.deathSystem.mockImplementation(() => callOrder.push('deathSystem'));
      mocks.expireModifiersSystem.mockImplementation(() => callOrder.push('expireModifiersSystem'));
      mocks.particleSystem.mockImplementation(() => callOrder.push('particleSystem'));
      mocks.audioEventSystem.mockImplementation(() => callOrder.push('audioEventSystem'));
      mocks.effectsPipelineSystem.mockImplementation(() => callOrder.push('effectsPipelineSystem'));
      mocks.syncHUDSystem.mockImplementation(() => callOrder.push('syncHUDSystem'));

      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      fireRaf(18);

      expect(callOrder).toEqual([
        'inputSystem', 'playerControlSystem', 'dodgeRollSystem',
        'aiSystem', 'projectileSystem', 'enemyWeaponSystem',
        'movementSystem', 'collisionDetectionSystem',
        'updateSpikeCooldowns', 'collisionResponseSystem',
        'damageSystem', 'shieldRegenSystem', 'hazardSystem',
        'lifetimeSystem', 'pickupSystem', 'chestSystem',
        'shopSystem', 'gunXPSystem', 'destructibleSystem',
        'doorSystem', 'spawnSystem', 'visibilitySystem', 'floorTransitionSystem',
        'deathSystem', 'expireModifiersSystem', 'particleSystem',
        'audioEventSystem', 'effectsPipelineSystem', 'syncHUDSystem',
      ]);

      loop.stop();
    });
  });

  describe('combined flow: state machine + game loop lifecycle', () => {
    it('simulates a full play session with game loop behavior', () => {
      // Start at Loading
      expect(useAppStore.getState().currentState).toBe(AppState.Loading);

      // Loading → MainMenu (no game loop yet)
      transition(AppState.MainMenu);

      // MainMenu → WeaponSelect
      transition(AppState.WeaponSelect);

      // WeaponSelect → Gameplay — game loop starts
      transition(AppState.Gameplay);
      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      fireRaf(18);
      expect(mocks.inputSystem).toHaveBeenCalled();

      // Gameplay → Paused — game loop freezes
      transition(AppState.Paused);
      loop.freeze();
      mocks.inputSystem.mockClear();
      fireRaf(100);
      expect(mocks.inputSystem).not.toHaveBeenCalled();
      expect(deps.onRender).toHaveBeenCalled();

      // Paused → Gameplay — game loop resumes
      transition(AppState.Gameplay);
      loop.resume();
      mocks.inputSystem.mockClear();
      fireRaf(118);
      fireRaf(136);
      expect(mocks.inputSystem).toHaveBeenCalledTimes(1);

      // Gameplay → Death — game loop stops
      transition(AppState.Death);
      loop.stop();
      expect(rafCallbacks.length).toBe(0);

      // Death → MainMenu — back to start
      transition(AppState.MainMenu);
      expect(useAppStore.getState().currentState).toBe(AppState.MainMenu);
    });

    it('full session ending in Victory', () => {
      transition(AppState.MainMenu);
      transition(AppState.WeaponSelect);
      transition(AppState.Gameplay);

      const deps = createDeps();
      const loop = createGameLoop(deps);
      loop.start();
      fireRaf(0);
      fireRaf(18);

      // Visit some overlay states
      transition(AppState.GunComparison);
      loop.freeze();
      transition(AppState.Gameplay);
      loop.resume();

      transition(AppState.ShopBrowse);
      loop.freeze();
      transition(AppState.Gameplay);
      loop.resume();

      // Victory
      transition(AppState.Victory);
      loop.stop();
      expect(useAppStore.getState().currentState).toBe(AppState.Victory);

      transition(AppState.MainMenu);
      expect(useAppStore.getState().currentState).toBe(AppState.MainMenu);
    });
  });

  describe('every AppState enum value is reachable', () => {
    it('all states can be reached through valid transitions', () => {
      const visited = new Set<AppState>();

      // Loading
      visited.add(useAppStore.getState().currentState);

      // MainMenu
      transition(AppState.MainMenu);
      visited.add(AppState.MainMenu);

      // Settings (from MainMenu)
      transition(AppState.Settings);
      visited.add(AppState.Settings);
      transition(AppState.MainMenu); // back

      // WeaponSelect
      transition(AppState.WeaponSelect);
      visited.add(AppState.WeaponSelect);

      // Gameplay
      transition(AppState.Gameplay);
      visited.add(AppState.Gameplay);

      // Paused
      transition(AppState.Paused);
      visited.add(AppState.Paused);
      transition(AppState.Gameplay);

      // GunComparison
      transition(AppState.GunComparison);
      visited.add(AppState.GunComparison);
      transition(AppState.Gameplay);

      // GunUpgrade
      transition(AppState.GunUpgrade);
      visited.add(AppState.GunUpgrade);
      transition(AppState.Gameplay);

      // ForcedUpgrade
      transition(AppState.ForcedUpgrade);
      visited.add(AppState.ForcedUpgrade);
      transition(AppState.Gameplay);

      // ShopBrowse
      transition(AppState.ShopBrowse);
      visited.add(AppState.ShopBrowse);
      transition(AppState.Gameplay);

      // Death
      transition(AppState.Death);
      visited.add(AppState.Death);
      transition(AppState.MainMenu);

      // Victory (new session)
      transition(AppState.WeaponSelect);
      transition(AppState.Gameplay);
      transition(AppState.Victory);
      visited.add(AppState.Victory);

      // Verify every AppState value was visited
      const allStates = Object.values(AppState).filter((v) => typeof v === 'number') as AppState[];
      for (const state of allStates) {
        expect(visited.has(state), `${AppState[state]} should be reachable`).toBe(true);
      }
      expect(visited.size).toBe(allStates.length);
    });
  });
});
