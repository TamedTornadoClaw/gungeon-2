import { describe, it, expect, beforeEach } from 'vitest';
import { AppState } from '../src/ecs/components';
import { useAppStore } from '../src/store/appStore';

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

describe('LoadingScreen logic', () => {
  beforeEach(() => {
    resetStore();
  });

  it('starts in Loading state', () => {
    expect(useAppStore.getState().currentState).toBe(AppState.Loading);
  });

  it('can transition from Loading to MainMenu', () => {
    useAppStore.getState().transition(AppState.MainMenu);
    expect(useAppStore.getState().currentState).toBe(AppState.MainMenu);
  });

  it('cannot transition from Loading to states other than MainMenu', () => {
    expect(() => useAppStore.getState().transition(AppState.Gameplay)).toThrow(
      /Invalid transition/,
    );
    expect(() => useAppStore.getState().transition(AppState.Paused)).toThrow(
      /Invalid transition/,
    );
    expect(() => useAppStore.getState().transition(AppState.Death)).toThrow(
      /Invalid transition/,
    );
  });

  it('sets previousState to Loading after transitioning to MainMenu', () => {
    useAppStore.getState().transition(AppState.MainMenu);
    expect(useAppStore.getState().previousState).toBe(AppState.Loading);
  });

  it('LoadingScreen module exports a function component', async () => {
    const mod = await import('../src/ui/LoadingScreen');
    expect(typeof mod.LoadingScreen).toBe('function');
  });
});
