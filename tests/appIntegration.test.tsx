// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { act } from 'react';
import { AppState, GunType } from '../src/ecs/components';
import { useAppStore } from '../src/store/appStore';
import type { GameLoop } from '../src/gameloop/gameLoop';

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../src/audio/audioManager', () => ({
  getAudioManager: () => ({ resumeContext: vi.fn() }),
}));

vi.mock('../src/gameSession', () => ({
  createGameSession: vi.fn(() => {
    const mockLoop = createMockGameLoop();
    return {
      gameLoop: mockLoop,
      world: {},
      rendererCtx: {},
      renderSystem: { releaseAll: vi.fn(), update: vi.fn(), getMeshMap: vi.fn() },
      inputManager: { detach: vi.fn() },
      floorState: { currentDepth: 1, seed: 1 },
      cleanup: vi.fn(),
    };
  }),
}));

vi.mock('../src/ui/LoadingScreen', () => ({
  LoadingScreen: () => <div data-testid="loading-screen" />,
}));
vi.mock('../src/ui/MainMenu', () => ({
  MainMenu: () => <div data-testid="main-menu" />,
}));
vi.mock('../src/ui/WeaponSelect', () => ({
  WeaponSelect: () => <div data-testid="weapon-select" />,
}));
vi.mock('../src/ui/GameplayHUD', () => ({
  GameplayHUD: () => <div data-testid="gameplay-hud" />,
}));
vi.mock('../src/ui/Crosshair', () => ({
  Crosshair: () => <div data-testid="crosshair" />,
}));
vi.mock('../src/ui/PauseOverlay', () => ({
  PauseOverlay: () => <div data-testid="pause-overlay" />,
}));
vi.mock('../src/ui/GunComparisonScreen', () => ({
  GunComparisonScreen: () => <div data-testid="gun-comparison-screen" />,
}));
vi.mock('../src/ui/GunUpgradeMenu', () => ({
  GunUpgradeMenu: () => <div data-testid="gun-upgrade-menu" />,
}));
vi.mock('../src/ui/ForcedUpgradeScreen', () => ({
  ForcedUpgradeScreen: () => <div data-testid="forced-upgrade-screen" />,
}));
vi.mock('../src/ui/ShopUI', () => ({
  ShopUI: () => <div data-testid="shop-ui" />,
}));
vi.mock('../src/ui/DeathScreen', () => ({
  DeathScreen: () => <div data-testid="death-screen" />,
}));
vi.mock('../src/ui/VictoryScreen', () => ({
  VictoryScreen: () => <div data-testid="victory-screen" />,
}));
vi.mock('../src/ui/SettingsScreen', () => ({
  SettingsScreen: () => <div data-testid="settings-screen" />,
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function createMockGameLoop(): GameLoop {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    freeze: vi.fn(),
    resume: vi.fn(),
  };
}

function resetStore(overrides?: Partial<ReturnType<typeof useAppStore.getState>>) {
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
    ...overrides,
  });
}

function transition(to: AppState) {
  useAppStore.getState().transition(to);
}

// Import App and appState after mocks are set up
const { App } = await import('../src/App');
const { CANVAS_STATES, FROZEN_STATES, setActiveGameLoop, clearActiveSession, getActiveGameLoop } =
  await import('../src/appState');

// ── Tests ───────────────────────────────────────────────────────────────────

describe('App Integration', () => {
  beforeEach(() => {
    resetStore();
    clearActiveSession();
    cleanup();
  });

  describe('correct component per state', () => {
    const stateToTestId: Record<number, string[]> = {
      [AppState.Loading]: ['loading-screen'],
      [AppState.MainMenu]: ['main-menu'],
      [AppState.WeaponSelect]: ['weapon-select'],
      [AppState.Gameplay]: ['three-canvas', 'gameplay-hud', 'crosshair'],
      [AppState.Paused]: ['three-canvas', 'gameplay-hud', 'crosshair', 'pause-overlay'],
      [AppState.GunComparison]: ['three-canvas', 'gun-comparison-screen'],
      [AppState.GunUpgrade]: ['three-canvas', 'gun-upgrade-menu'],
      [AppState.ForcedUpgrade]: ['three-canvas', 'forced-upgrade-screen'],
      [AppState.ShopBrowse]: ['three-canvas', 'shop-ui'],
      [AppState.Death]: ['death-screen'],
      [AppState.Victory]: ['victory-screen'],
      [AppState.Settings]: ['settings-screen'],
    };

    const allTestIds = [
      'loading-screen', 'main-menu', 'weapon-select', 'three-canvas',
      'gameplay-hud', 'crosshair', 'pause-overlay', 'gun-comparison-screen',
      'gun-upgrade-menu', 'forced-upgrade-screen', 'shop-ui',
      'death-screen', 'victory-screen', 'settings-screen',
    ];

    for (const [stateValue, expectedIds] of Object.entries(stateToTestId)) {
      const stateName = AppState[Number(stateValue)];

      it(`renders correct components for ${stateName}`, () => {
        resetStore({ currentState: Number(stateValue) });
        render(<App />);

        for (const id of expectedIds) {
          expect(screen.queryByTestId(id), `${id} should be present in ${stateName}`).not.toBeNull();
        }

        const unexpectedIds = allTestIds.filter((id) => !expectedIds.includes(id));
        for (const id of unexpectedIds) {
          expect(screen.queryByTestId(id), `${id} should NOT be present in ${stateName}`).toBeNull();
        }
      });
    }
  });

  describe('Three.js canvas mount/unmount', () => {
    const canvasStates = [
      AppState.Gameplay, AppState.Paused, AppState.GunComparison,
      AppState.GunUpgrade, AppState.ForcedUpgrade, AppState.ShopBrowse,
    ];
    const nonCanvasStates = [
      AppState.Loading, AppState.MainMenu, AppState.WeaponSelect,
      AppState.Death, AppState.Victory, AppState.Settings,
    ];

    for (const state of canvasStates) {
      it(`canvas is mounted for ${AppState[state]}`, () => {
        resetStore({ currentState: state });
        render(<App />);
        expect(screen.queryByTestId('three-canvas')).not.toBeNull();
      });
    }

    for (const state of nonCanvasStates) {
      it(`canvas is unmounted for ${AppState[state]}`, () => {
        resetStore({ currentState: state });
        render(<App />);
        expect(screen.queryByTestId('three-canvas')).toBeNull();
      });
    }
  });

  describe('CANVAS_STATES and FROZEN_STATES sets', () => {
    it('CANVAS_STATES contains exactly the gameplay-related states', () => {
      const expected = new Set([
        AppState.Gameplay, AppState.Paused, AppState.GunComparison,
        AppState.GunUpgrade, AppState.ForcedUpgrade, AppState.ShopBrowse,
      ]);
      expect(new Set(CANVAS_STATES)).toEqual(expected);
    });

    it('FROZEN_STATES contains exactly the overlay states', () => {
      const expected = new Set([
        AppState.Paused, AppState.GunComparison, AppState.GunUpgrade,
        AppState.ForcedUpgrade, AppState.ShopBrowse,
      ]);
      expect(new Set(FROZEN_STATES)).toEqual(expected);
    });
  });

  describe('game loop lifecycle', () => {
    it('freeze is called when transitioning to Paused', () => {
      const mockLoop = createMockGameLoop();
      setActiveGameLoop(mockLoop);
      resetStore({ currentState: AppState.Gameplay });
      render(<App />);

      act(() => transition(AppState.Paused));

      expect(mockLoop.freeze).toHaveBeenCalled();
    });

    it('resume is called when transitioning back to Gameplay from Paused', () => {
      const mockLoop = createMockGameLoop();
      setActiveGameLoop(mockLoop);
      resetStore({ currentState: AppState.Gameplay });
      render(<App />);

      act(() => transition(AppState.Paused));
      act(() => transition(AppState.Gameplay));

      expect(mockLoop.resume).toHaveBeenCalled();
    });

    it('stop is called when transitioning to Death', () => {
      const mockLoop = createMockGameLoop();
      setActiveGameLoop(mockLoop);
      resetStore({ currentState: AppState.Gameplay });
      render(<App />);

      act(() => transition(AppState.Death));

      expect(mockLoop.stop).toHaveBeenCalled();
      expect(getActiveGameLoop()).toBeNull();
    });

    it('stop is called when transitioning to Victory', () => {
      const mockLoop = createMockGameLoop();
      setActiveGameLoop(mockLoop);
      resetStore({ currentState: AppState.Gameplay });
      render(<App />);

      act(() => transition(AppState.Victory));

      expect(mockLoop.stop).toHaveBeenCalled();
      expect(getActiveGameLoop()).toBeNull();
    });

    it('stop is called when transitioning to MainMenu', () => {
      const mockLoop = createMockGameLoop();
      setActiveGameLoop(mockLoop);
      resetStore({ currentState: AppState.Paused });
      render(<App />);

      act(() => transition(AppState.MainMenu));

      expect(mockLoop.stop).toHaveBeenCalled();
      expect(getActiveGameLoop()).toBeNull();
    });

    it('freeze is called for all overlay states', () => {
      const overlayStates = [
        AppState.GunComparison, AppState.GunUpgrade,
        AppState.ForcedUpgrade, AppState.ShopBrowse,
      ];

      for (const overlayState of overlayStates) {
        cleanup();
        clearActiveSession();
        const mockLoop = createMockGameLoop();
        setActiveGameLoop(mockLoop);
        resetStore({ currentState: AppState.Gameplay });
        render(<App />);

        act(() => transition(overlayState));

        expect(mockLoop.freeze, `freeze should be called for ${AppState[overlayState]}`).toHaveBeenCalled();
      }
    });

    it('Settings does not change game loop state', () => {
      const mockLoop = createMockGameLoop();
      setActiveGameLoop(mockLoop);
      resetStore({ currentState: AppState.Gameplay });
      render(<App />);

      // Gameplay → Paused (freeze)
      act(() => transition(AppState.Paused));
      expect(mockLoop.freeze).toHaveBeenCalledTimes(1);

      // Paused → Settings (no change to game loop)
      act(() => transition(AppState.Settings));
      expect(mockLoop.stop).not.toHaveBeenCalled();
      expect(mockLoop.resume).not.toHaveBeenCalled();
      expect(mockLoop.freeze).toHaveBeenCalledTimes(1); // still just the one from Paused
    });
  });

  describe('rapid state transitions', () => {
    it('Gameplay → Paused → Gameplay → Paused pairs correctly', () => {
      const mockLoop = createMockGameLoop();
      setActiveGameLoop(mockLoop);
      resetStore({ currentState: AppState.Gameplay });
      render(<App />);

      act(() => transition(AppState.Paused));
      expect(mockLoop.freeze).toHaveBeenCalledTimes(1);

      act(() => transition(AppState.Gameplay));
      expect(mockLoop.resume).toHaveBeenCalledTimes(1);

      act(() => transition(AppState.Paused));
      expect(mockLoop.freeze).toHaveBeenCalledTimes(2);
    });
  });

  describe('Settings returns to previous state', () => {
    it('Settings returns to Paused when entered from Paused', () => {
      resetStore({ currentState: AppState.Gameplay });
      render(<App />);

      act(() => transition(AppState.Paused));
      act(() => transition(AppState.Settings));

      expect(useAppStore.getState().currentState).toBe(AppState.Settings);
      expect(useAppStore.getState().previousState).toBe(AppState.Paused);

      act(() => transition(AppState.Paused));
      expect(useAppStore.getState().currentState).toBe(AppState.Paused);
    });

    it('Settings returns to MainMenu when entered from MainMenu', () => {
      resetStore({ currentState: AppState.MainMenu });
      render(<App />);

      act(() => transition(AppState.Settings));
      expect(useAppStore.getState().previousState).toBe(AppState.MainMenu);

      act(() => transition(AppState.MainMenu));
      expect(useAppStore.getState().currentState).toBe(AppState.MainMenu);
    });

    it('Settings rejects transition to non-previous state', () => {
      resetStore({ currentState: AppState.MainMenu });
      render(<App />);

      act(() => transition(AppState.Settings));

      expect(() => transition(AppState.Paused)).toThrow();
    });
  });

  describe('invalid transitions', () => {
    it('MainMenu → Gameplay throws (must go through WeaponSelect)', () => {
      resetStore({ currentState: AppState.MainMenu });
      render(<App />);

      expect(() => transition(AppState.Gameplay)).toThrow(/MainMenu.*Gameplay/);
    });

    it('transition error includes from and to state names', () => {
      resetStore({ currentState: AppState.Death });
      render(<App />);

      expect(() => transition(AppState.Gameplay)).toThrow(/Death/);
      expect(() => transition(AppState.Gameplay)).toThrow(/Gameplay/);
    });
  });

  describe('full happy path — Loading through Death', () => {
    it('Loading → MainMenu → WeaponSelect → Gameplay → Death → MainMenu', () => {
      const mockLoop = createMockGameLoop();
      resetStore({ currentState: AppState.Loading });
      render(<App />);

      // Loading → MainMenu
      act(() => transition(AppState.MainMenu));
      expect(screen.queryByTestId('main-menu')).not.toBeNull();
      expect(screen.queryByTestId('three-canvas')).toBeNull();

      // MainMenu → WeaponSelect
      act(() => transition(AppState.WeaponSelect));
      expect(screen.queryByTestId('weapon-select')).not.toBeNull();
      expect(screen.queryByTestId('three-canvas')).toBeNull();

      // WeaponSelect → Gameplay
      setActiveGameLoop(mockLoop);
      act(() => transition(AppState.Gameplay));
      expect(screen.queryByTestId('three-canvas')).not.toBeNull();
      expect(screen.queryByTestId('gameplay-hud')).not.toBeNull();

      // Gameplay → Death
      act(() => transition(AppState.Death));
      expect(screen.queryByTestId('death-screen')).not.toBeNull();
      expect(screen.queryByTestId('three-canvas')).toBeNull();
      expect(mockLoop.stop).toHaveBeenCalled();

      // Death → MainMenu
      act(() => transition(AppState.MainMenu));
      expect(screen.queryByTestId('main-menu')).not.toBeNull();
    });
  });

  describe('full happy path — Victory', () => {
    it('Gameplay → Victory stops game loop and renders VictoryScreen', () => {
      const mockLoop = createMockGameLoop();
      setActiveGameLoop(mockLoop);
      resetStore({ currentState: AppState.Gameplay });
      render(<App />);

      act(() => transition(AppState.Victory));

      expect(screen.queryByTestId('victory-screen')).not.toBeNull();
      expect(screen.queryByTestId('three-canvas')).toBeNull();
      expect(mockLoop.stop).toHaveBeenCalled();
    });
  });

  describe('overlay states preserve canvas', () => {
    it('Gameplay → Paused keeps canvas, shows overlay', () => {
      const mockLoop = createMockGameLoop();
      setActiveGameLoop(mockLoop);
      resetStore({ currentState: AppState.Gameplay });
      render(<App />);

      act(() => transition(AppState.Paused));

      expect(screen.queryByTestId('three-canvas')).not.toBeNull();
      expect(screen.queryByTestId('pause-overlay')).not.toBeNull();
      expect(screen.queryByTestId('gameplay-hud')).not.toBeNull();
    });

    it('Gameplay → GunComparison keeps canvas, shows comparison', () => {
      const mockLoop = createMockGameLoop();
      setActiveGameLoop(mockLoop);
      resetStore({ currentState: AppState.Gameplay });
      render(<App />);

      act(() => transition(AppState.GunComparison));

      expect(screen.queryByTestId('three-canvas')).not.toBeNull();
      expect(screen.queryByTestId('gun-comparison-screen')).not.toBeNull();
    });
  });

  describe('MainMenu entry clears game state', () => {
    it('game loop is stopped and session cleaned up on MainMenu', () => {
      const mockLoop = createMockGameLoop();
      setActiveGameLoop(mockLoop);
      resetStore({ currentState: AppState.Paused });
      render(<App />);

      act(() => transition(AppState.MainMenu));

      expect(mockLoop.stop).toHaveBeenCalled();
      expect(getActiveGameLoop()).toBeNull();
    });
  });

  describe('Settings → Paused → Gameplay preserves loop', () => {
    it('three transitions each work correctly', () => {
      const mockLoop = createMockGameLoop();
      setActiveGameLoop(mockLoop);
      resetStore({ currentState: AppState.Gameplay });
      render(<App />);

      // Gameplay → Paused
      act(() => transition(AppState.Paused));
      expect(mockLoop.freeze).toHaveBeenCalledTimes(1);

      // Paused → Settings
      act(() => transition(AppState.Settings));
      // Game loop unchanged (no extra freeze/resume/stop)
      expect(mockLoop.freeze).toHaveBeenCalledTimes(1);
      expect(mockLoop.stop).not.toHaveBeenCalled();

      // Settings → Paused
      act(() => transition(AppState.Paused));
      // freeze is called again (idempotent, already frozen)
      expect(mockLoop.freeze).toHaveBeenCalledTimes(2);

      // Paused → Gameplay
      act(() => transition(AppState.Gameplay));
      expect(mockLoop.resume).toHaveBeenCalledTimes(1);
    });
  });
});
