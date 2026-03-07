// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { AppState, GunType, WeaponSlot } from '../src/ecs/components';
import { useAppStore } from '../src/store/appStore';
import { useGameplayStore } from '../src/store/gameplayStore';
import { GameplayHUD } from '../src/ui/GameplayHUD';

afterEach(() => {
  cleanup();
});

function setAppState(state: AppState) {
  // Force the store state directly for testing
  useAppStore.setState({ currentState: state });
}

describe('GameplayHUD', () => {
  beforeEach(() => {
    useAppStore.setState({ currentState: AppState.Gameplay, previousState: null });
    useGameplayStore.setState({
      currentHealth: 80,
      maxHealth: 100,
      currency: 42,
      floorDepth: 3,
      activeSlot: WeaponSlot.Sidearm,
      activeGun: {
        gunType: GunType.Pistol,
        currentAmmo: 8,
        magazineSize: 12,
        isReloading: false,
        reloadTimer: 0,
        reloadTime: 1.5,
      },
    });
  });

  it('renders nothing when not in Gameplay state', () => {
    setAppState(AppState.MainMenu);
    const { container } = render(<GameplayHUD />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing in Paused state', () => {
    setAppState(AppState.Paused);
    const { container } = render(<GameplayHUD />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing in Death state', () => {
    setAppState(AppState.Death);
    const { container } = render(<GameplayHUD />);
    expect(container.innerHTML).toBe('');
  });

  it('renders HUD in Gameplay state', () => {
    render(<GameplayHUD />);
    expect(screen.getByTestId('gameplay-hud')).toBeDefined();
  });

  it('displays health bar with current/max values', () => {
    render(<GameplayHUD />);
    expect(screen.getByText('HP 80/100')).toBeDefined();
  });

  it('health bar fill width reflects health percentage', () => {
    render(<GameplayHUD />);
    const fill = screen.getByTestId('health-bar-fill');
    expect(fill.style.width).toBe('80%');
  });

  it('health bar fill is green when above 50%', () => {
    useGameplayStore.setState({ currentHealth: 60, maxHealth: 100 });
    render(<GameplayHUD />);
    const fill = screen.getByTestId('health-bar-fill');
    expect(fill.style.backgroundColor).toBe('rgb(76, 175, 80)');
  });

  it('health bar fill is orange when between 25-50%', () => {
    useGameplayStore.setState({ currentHealth: 30, maxHealth: 100 });
    render(<GameplayHUD />);
    const fill = screen.getByTestId('health-bar-fill');
    expect(fill.style.backgroundColor).toBe('rgb(255, 152, 0)');
  });

  it('health bar fill is red when below 25%', () => {
    useGameplayStore.setState({ currentHealth: 10, maxHealth: 100 });
    render(<GameplayHUD />);
    const fill = screen.getByTestId('health-bar-fill');
    expect(fill.style.backgroundColor).toBe('rgb(244, 67, 54)');
  });

  it('displays currency counter', () => {
    render(<GameplayHUD />);
    const counter = screen.getByTestId('currency-counter');
    expect(counter.textContent).toBe('$ 42');
  });

  it('displays floor depth', () => {
    render(<GameplayHUD />);
    const depth = screen.getByTestId('floor-depth');
    expect(depth.textContent).toBe('Floor 3');
  });

  it('displays ammo when not reloading', () => {
    render(<GameplayHUD />);
    const ammo = screen.getByTestId('ammo-display');
    expect(ammo.textContent).toBe('8 / 12');
  });

  it('displays reload indicator when reloading', () => {
    useGameplayStore.setState({
      activeGun: {
        gunType: GunType.Pistol,
        currentAmmo: 0,
        magazineSize: 12,
        isReloading: true,
        reloadTimer: 0.5,
        reloadTime: 1.5,
      },
    });
    render(<GameplayHUD />);
    expect(screen.getByTestId('reload-indicator')).toBeDefined();
    expect(screen.getByTestId('reload-indicator').textContent).toBe('RELOADING');
  });

  it('displays gun type name', () => {
    render(<GameplayHUD />);
    expect(screen.getByText('Pistol')).toBeDefined();
  });

  it('displays active slot label', () => {
    render(<GameplayHUD />);
    expect(screen.getByText('Sidearm')).toBeDefined();
  });

  it('displays Long Arm slot label when active', () => {
    useGameplayStore.setState({
      activeSlot: WeaponSlot.LongArm,
      activeGun: {
        gunType: GunType.Shotgun,
        currentAmmo: 4,
        magazineSize: 6,
        isReloading: false,
        reloadTimer: 0,
        reloadTime: 2.0,
      },
    });
    render(<GameplayHUD />);
    expect(screen.getByText('Long Arm')).toBeDefined();
    expect(screen.getByText('Shotgun')).toBeDefined();
  });

  it('displays minimap placeholder', () => {
    render(<GameplayHUD />);
    expect(screen.getByTestId('minimap-placeholder')).toBeDefined();
    expect(screen.getByTestId('minimap-placeholder').textContent).toBe('Minimap');
  });

  it('handles zero max health without NaN', () => {
    useGameplayStore.setState({ currentHealth: 0, maxHealth: 0 });
    render(<GameplayHUD />);
    const fill = screen.getByTestId('health-bar-fill');
    expect(fill.style.width).toBe('0%');
  });

  it('handles null activeGun gracefully', () => {
    useGameplayStore.setState({ activeGun: null });
    render(<GameplayHUD />);
    expect(screen.getByTestId('gameplay-hud')).toBeDefined();
    expect(screen.queryByTestId('ammo-display')).toBeNull();
    expect(screen.queryByTestId('reload-indicator')).toBeNull();
  });
});

describe('gameplayStore', () => {
  beforeEach(() => {
    useGameplayStore.setState({
      currentHealth: 0,
      maxHealth: 0,
      currency: 0,
      floorDepth: 1,
      activeSlot: WeaponSlot.Sidearm,
      activeGun: null,
    });
  });

  it('setHealth updates current and max', () => {
    useGameplayStore.getState().setHealth(50, 100);
    const state = useGameplayStore.getState();
    expect(state.currentHealth).toBe(50);
    expect(state.maxHealth).toBe(100);
  });

  it('setCurrency updates currency', () => {
    useGameplayStore.getState().setCurrency(999);
    expect(useGameplayStore.getState().currency).toBe(999);
  });

  it('setFloorDepth updates depth', () => {
    useGameplayStore.getState().setFloorDepth(5);
    expect(useGameplayStore.getState().floorDepth).toBe(5);
  });

  it('setActiveSlot updates slot', () => {
    useGameplayStore.getState().setActiveSlot(WeaponSlot.LongArm);
    expect(useGameplayStore.getState().activeSlot).toBe(WeaponSlot.LongArm);
  });

  it('setActiveGun updates gun data', () => {
    const gun = {
      gunType: GunType.SMG,
      currentAmmo: 25,
      magazineSize: 30,
      isReloading: false,
      reloadTimer: 0,
      reloadTime: 1.2,
    };
    useGameplayStore.getState().setActiveGun(gun);
    expect(useGameplayStore.getState().activeGun).toEqual(gun);
  });
});
