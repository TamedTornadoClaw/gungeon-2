import { describe, it, expect, beforeEach } from 'vitest';
import { AppState, GunType } from '../src/ecs/components';
import { useAppStore } from '../src/store/appStore';
import type { RunStats } from '../src/store/appStore';

function resetStore() {
  useAppStore.setState({
    currentState: AppState.Loading,
    previousState: null,
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

function currentState(): AppState {
  return useAppStore.getState().currentState;
}

function previousState(): AppState | null {
  return useAppStore.getState().previousState;
}

describe('AppStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('initial state', () => {
    it('starts in Loading state', () => {
      expect(currentState()).toBe(AppState.Loading);
    });

    it('previousState is null initially', () => {
      expect(previousState()).toBeNull();
    });

    it('all per-state data fields initialized to null', () => {
      const state = useAppStore.getState();
      expect(state.selectedLongArm).toBeNull();
      expect(state.comparisonGunEntityId).toBeNull();
      expect(state.comparisonSlot).toBeNull();
      expect(state.forcedUpgradeGunSlot).toBeNull();
      expect(state.activeShopEntityId).toBeNull();
      expect(state.runStats).toBeNull();
    });
  });

  describe('AppState enum', () => {
    it('has exactly 12 states', () => {
      const numericValues = Object.values(AppState).filter(
        (v) => typeof v === 'number',
      );
      expect(numericValues).toHaveLength(12);
    });

    it('contains all expected states', () => {
      const expectedStates = [
        'Loading', 'MainMenu', 'WeaponSelect', 'Gameplay', 'Paused',
        'GunComparison', 'GunUpgrade', 'ForcedUpgrade', 'ShopBrowse',
        'Death', 'Victory', 'Settings',
      ];
      for (const name of expectedStates) {
        expect(AppState[name as keyof typeof AppState]).toBeDefined();
      }
    });
  });

  describe('valid transitions', () => {
    const validTransitions: [AppState, AppState][] = [
      [AppState.Loading, AppState.MainMenu],
      [AppState.MainMenu, AppState.WeaponSelect],
      [AppState.MainMenu, AppState.Settings],
      [AppState.WeaponSelect, AppState.Gameplay],
      [AppState.WeaponSelect, AppState.MainMenu],
      [AppState.Gameplay, AppState.Paused],
      [AppState.Gameplay, AppState.GunComparison],
      [AppState.Gameplay, AppState.GunUpgrade],
      [AppState.Gameplay, AppState.ForcedUpgrade],
      [AppState.Gameplay, AppState.ShopBrowse],
      [AppState.Gameplay, AppState.Death],
      [AppState.Gameplay, AppState.Victory],
      [AppState.Paused, AppState.Gameplay],
      [AppState.Paused, AppState.Settings],
      [AppState.Paused, AppState.MainMenu],
      [AppState.GunComparison, AppState.Gameplay],
      [AppState.GunUpgrade, AppState.Gameplay],
      [AppState.ForcedUpgrade, AppState.Gameplay],
      [AppState.ShopBrowse, AppState.Gameplay],
      [AppState.Death, AppState.MainMenu],
      [AppState.Victory, AppState.MainMenu],
    ];

    for (const [from, to] of validTransitions) {
      it(`${AppState[from]} -> ${AppState[to]} succeeds`, () => {
        useAppStore.setState({ currentState: from, previousState: null });
        transition(to);
        expect(currentState()).toBe(to);
        expect(previousState()).toBe(from);
      });
    }
  });

  describe('Settings transitions', () => {
    it('Settings -> previousState (MainMenu) succeeds', () => {
      // MainMenu -> Settings
      useAppStore.setState({ currentState: AppState.MainMenu });
      transition(AppState.Settings);
      expect(currentState()).toBe(AppState.Settings);
      expect(previousState()).toBe(AppState.MainMenu);

      // Settings -> MainMenu (previousState)
      transition(AppState.MainMenu);
      expect(currentState()).toBe(AppState.MainMenu);
      expect(previousState()).toBe(AppState.Settings);
    });

    it('Settings -> previousState (Paused) succeeds', () => {
      // Gameplay -> Paused -> Settings
      useAppStore.setState({ currentState: AppState.Gameplay });
      transition(AppState.Paused);
      transition(AppState.Settings);
      expect(currentState()).toBe(AppState.Settings);
      expect(previousState()).toBe(AppState.Paused);

      // Settings -> Paused
      transition(AppState.Paused);
      expect(currentState()).toBe(AppState.Paused);
    });

    it('Settings -> non-previousState throws even if target is otherwise valid', () => {
      // MainMenu -> Settings (previousState = MainMenu)
      useAppStore.setState({ currentState: AppState.MainMenu });
      transition(AppState.Settings);

      // Settings -> Paused should throw (Paused is valid state but not previousState)
      expect(() => transition(AppState.Paused)).toThrow();
      expect(() => transition(AppState.Paused)).toThrow('Settings');
      expect(() => transition(AppState.Paused)).toThrow('Paused');
    });

    it('Settings -> Loading throws', () => {
      useAppStore.setState({ currentState: AppState.MainMenu });
      transition(AppState.Settings);
      expect(() => transition(AppState.Loading)).toThrow();
    });

    it('Settings -> Gameplay throws', () => {
      useAppStore.setState({ currentState: AppState.MainMenu });
      transition(AppState.Settings);
      expect(() => transition(AppState.Gameplay)).toThrow();
    });

    it('Settings -> Death throws', () => {
      useAppStore.setState({ currentState: AppState.MainMenu });
      transition(AppState.Settings);
      expect(() => transition(AppState.Death)).toThrow();
    });

    it('Settings re-entry updates previousState correctly', () => {
      // MainMenu -> Settings -> MainMenu -> Settings again
      useAppStore.setState({ currentState: AppState.MainMenu });
      transition(AppState.Settings);
      transition(AppState.MainMenu); // back
      transition(AppState.Settings); // re-enter
      expect(previousState()).toBe(AppState.MainMenu);
      transition(AppState.MainMenu); // back again
      expect(currentState()).toBe(AppState.MainMenu);
    });
  });

  describe('invalid transitions', () => {
    const invalidTransitions: [AppState, AppState][] = [
      [AppState.Loading, AppState.Gameplay],
      [AppState.Loading, AppState.Settings],
      [AppState.Loading, AppState.Death],
      [AppState.MainMenu, AppState.Gameplay],
      [AppState.MainMenu, AppState.Paused],
      [AppState.MainMenu, AppState.Death],
      [AppState.MainMenu, AppState.Victory],
      [AppState.WeaponSelect, AppState.Paused],
      [AppState.WeaponSelect, AppState.Death],
      [AppState.WeaponSelect, AppState.Settings],
      [AppState.Gameplay, AppState.MainMenu],
      [AppState.Gameplay, AppState.WeaponSelect],
      [AppState.Gameplay, AppState.Loading],
      [AppState.GunComparison, AppState.MainMenu],
      [AppState.GunComparison, AppState.Death],
      [AppState.GunComparison, AppState.Paused],
      [AppState.Death, AppState.Gameplay],
      [AppState.Death, AppState.Death],
      [AppState.Death, AppState.Victory],
      [AppState.Victory, AppState.Gameplay],
      [AppState.Victory, AppState.Victory],
      [AppState.Victory, AppState.Death],
    ];

    for (const [from, to] of invalidTransitions) {
      it(`${AppState[from]} -> ${AppState[to]} throws`, () => {
        useAppStore.setState({ currentState: from, previousState: null });
        expect(() => transition(to)).toThrow();
      });
    }
  });

  describe('self-transitions throw', () => {
    const allStates = Object.values(AppState).filter(
      (v): v is AppState => typeof v === 'number',
    );

    for (const state of allStates) {
      it(`${AppState[state]} -> ${AppState[state]} throws`, () => {
        useAppStore.setState({ currentState: state, previousState: null });
        expect(() => transition(state)).toThrow();
      });
    }
  });

  describe('previousState tracking through chained transitions', () => {
    it('tracks correctly: Loading -> MainMenu -> WeaponSelect -> Gameplay -> Paused', () => {
      expect(previousState()).toBeNull();

      transition(AppState.MainMenu);
      expect(previousState()).toBe(AppState.Loading);

      transition(AppState.WeaponSelect);
      expect(previousState()).toBe(AppState.MainMenu);

      transition(AppState.Gameplay);
      expect(previousState()).toBe(AppState.WeaponSelect);

      transition(AppState.Paused);
      expect(previousState()).toBe(AppState.Gameplay);
    });
  });

  describe('double transition sequence', () => {
    it('Gameplay -> Death -> MainMenu succeeds in order', () => {
      useAppStore.setState({ currentState: AppState.Gameplay });

      transition(AppState.Death);
      expect(currentState()).toBe(AppState.Death);
      expect(previousState()).toBe(AppState.Gameplay);

      transition(AppState.MainMenu);
      expect(currentState()).toBe(AppState.MainMenu);
      expect(previousState()).toBe(AppState.Death);
    });
  });

  describe('rapid sequential transitions', () => {
    it('Gameplay -> Paused -> Gameplay -> Paused all succeed', () => {
      useAppStore.setState({ currentState: AppState.Gameplay });

      transition(AppState.Paused);
      expect(currentState()).toBe(AppState.Paused);
      expect(previousState()).toBe(AppState.Gameplay);

      transition(AppState.Gameplay);
      expect(currentState()).toBe(AppState.Gameplay);
      expect(previousState()).toBe(AppState.Paused);

      transition(AppState.Paused);
      expect(currentState()).toBe(AppState.Paused);
      expect(previousState()).toBe(AppState.Gameplay);
    });
  });

  describe('error message format', () => {
    it('contains from and to state names', () => {
      useAppStore.setState({ currentState: AppState.Death });
      expect(() => transition(AppState.Gameplay)).toThrow(/Death/);
      expect(() => transition(AppState.Gameplay)).toThrow(/Gameplay/);
    });
  });

  describe('transition is synchronous', () => {
    it('state is updated before transition returns', () => {
      transition(AppState.MainMenu);
      // If this line executes, state was already updated synchronously
      expect(currentState()).toBe(AppState.MainMenu);
    });
  });

  describe('invalid input to transition', () => {
    it('throws for value not in AppState enum', () => {
      expect(() => transition(999 as AppState)).toThrow();
    });

    it('throws for undefined', () => {
      expect(() => transition(undefined as unknown as AppState)).toThrow();
    });

    it('throws for null', () => {
      expect(() => transition(null as unknown as AppState)).toThrow();
    });
  });

  describe('store shape', () => {
    it('has all required fields', () => {
      const state = useAppStore.getState();
      expect(state).toHaveProperty('currentState');
      expect(state).toHaveProperty('previousState');
      expect(state).toHaveProperty('transition');
      expect(state).toHaveProperty('selectedLongArm');
      expect(state).toHaveProperty('comparisonGunEntityId');
      expect(state).toHaveProperty('comparisonSlot');
      expect(state).toHaveProperty('forcedUpgradeGunSlot');
      expect(state).toHaveProperty('activeShopEntityId');
      expect(state).toHaveProperty('runStats');
    });
  });

  describe('RunStats interface', () => {
    it('has exactly the required fields', () => {
      const stats: RunStats = {
        kills: 10,
        depthReached: 3,
        timeSurvived: 120.5,
        gunsUsed: [GunType.Pistol, GunType.Shotgun],
        traitsLeveled: 5,
      };
      useAppStore.setState({ runStats: stats });
      const stored = useAppStore.getState().runStats;
      expect(stored).not.toBeNull();
      expect(stored!.kills).toBe(10);
      expect(stored!.depthReached).toBe(3);
      expect(stored!.timeSurvived).toBe(120.5);
      expect(stored!.gunsUsed).toEqual([GunType.Pistol, GunType.Shotgun]);
      expect(stored!.traitsLeveled).toBe(5);
    });
  });

  describe('exhaustive invalid transition coverage', () => {
    const allStates = Object.values(AppState).filter(
      (v): v is AppState => typeof v === 'number',
    );

    const validTransitionSet = new Set<string>([
      `${AppState.Loading}->${AppState.MainMenu}`,
      `${AppState.MainMenu}->${AppState.WeaponSelect}`,
      `${AppState.MainMenu}->${AppState.Settings}`,
      `${AppState.WeaponSelect}->${AppState.Gameplay}`,
      `${AppState.WeaponSelect}->${AppState.MainMenu}`,
      `${AppState.Gameplay}->${AppState.Paused}`,
      `${AppState.Gameplay}->${AppState.GunComparison}`,
      `${AppState.Gameplay}->${AppState.GunUpgrade}`,
      `${AppState.Gameplay}->${AppState.ForcedUpgrade}`,
      `${AppState.Gameplay}->${AppState.ShopBrowse}`,
      `${AppState.Gameplay}->${AppState.Death}`,
      `${AppState.Gameplay}->${AppState.Victory}`,
      `${AppState.Paused}->${AppState.Gameplay}`,
      `${AppState.Paused}->${AppState.Settings}`,
      `${AppState.Paused}->${AppState.MainMenu}`,
      `${AppState.GunComparison}->${AppState.Gameplay}`,
      `${AppState.GunUpgrade}->${AppState.Gameplay}`,
      `${AppState.ForcedUpgrade}->${AppState.Gameplay}`,
      `${AppState.ShopBrowse}->${AppState.Gameplay}`,
      `${AppState.Death}->${AppState.MainMenu}`,
      `${AppState.Victory}->${AppState.MainMenu}`,
    ]);

    for (const from of allStates) {
      for (const to of allStates) {
        // Skip Settings (handled separately) and valid transitions
        if (from === AppState.Settings) continue;
        const key = `${from}->${to}`;
        if (validTransitionSet.has(key)) continue;

        it(`${AppState[from]} -> ${AppState[to]} is invalid and throws`, () => {
          useAppStore.setState({ currentState: from, previousState: null });
          expect(() => transition(to)).toThrow();
        });
      }
    }
  });
});
