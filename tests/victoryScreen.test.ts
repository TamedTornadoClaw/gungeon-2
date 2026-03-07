import { describe, it, expect, beforeEach } from 'vitest';
import { AppState, GunType } from '../src/ecs/components';
import { useAppStore } from '../src/store/appStore';

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

function goToVictory() {
  const store = useAppStore.getState();
  store.transition(AppState.MainMenu);
  store.transition(AppState.WeaponSelect);
  store.transition(AppState.Gameplay);
  store.transition(AppState.Victory);
}

describe('VictoryScreen logic', () => {
  beforeEach(() => {
    resetStore();
  });

  it('can transition from Victory to MainMenu', () => {
    goToVictory();
    useAppStore.getState().transition(AppState.MainMenu);
    expect(useAppStore.getState().currentState).toBe(AppState.MainMenu);
  });

  it('cannot transition from Victory to states other than MainMenu', () => {
    goToVictory();
    expect(() => useAppStore.getState().transition(AppState.Gameplay)).toThrow(
      /Invalid transition/,
    );
    expect(() => useAppStore.getState().transition(AppState.Paused)).toThrow(
      /Invalid transition/,
    );
    expect(() => useAppStore.getState().transition(AppState.WeaponSelect)).toThrow(
      /Invalid transition/,
    );
  });

  it('sets previousState to Victory after transitioning to MainMenu', () => {
    goToVictory();
    useAppStore.getState().transition(AppState.MainMenu);
    expect(useAppStore.getState().previousState).toBe(AppState.Victory);
  });

  it('runStats are available in Victory state', () => {
    const stats = {
      kills: 42,
      depthReached: 5,
      timeSurvived: 312,
      gunsUsed: [GunType.Pistol, GunType.Shotgun],
      traitsLeveled: 7,
    };
    useAppStore.setState({ runStats: stats });
    goToVictory();
    expect(useAppStore.getState().runStats).toEqual(stats);
  });

  it('VictoryScreen module exports a function component', async () => {
    const mod = await import('../src/ui/VictoryScreen');
    expect(typeof mod.VictoryScreen).toBe('function');
  });
});
