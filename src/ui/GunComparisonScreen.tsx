import { useCallback } from 'react';
import { AppState, GunTrait, GunType } from '../ecs/components';
import { SoundId } from '../ecs/components';
import { useAppStore } from '../store/appStore';
import { useComparisonStore } from '../store/comparisonStore';
import type { ComparisonGunData } from '../store/comparisonStore';
import { getAudioManager } from '../audio/audioManager';

const GUN_TYPE_NAMES: Record<GunType, string> = {
  [GunType.Pistol]: 'Pistol',
  [GunType.SMG]: 'SMG',
  [GunType.AssaultRifle]: 'Assault Rifle',
  [GunType.Shotgun]: 'Shotgun',
  [GunType.LMG]: 'LMG',
};

const TRAIT_NAMES: Record<GunTrait, string> = {
  [GunTrait.Damage]: 'Damage',
  [GunTrait.FireRate]: 'Fire Rate',
  [GunTrait.MagazineSize]: 'Magazine Size',
  [GunTrait.ReloadTime]: 'Reload Time',
  [GunTrait.Spread]: 'Spread',
  [GunTrait.ProjectileCount]: 'Projectile Count',
  [GunTrait.ProjectileSpeed]: 'Projectile Speed',
  [GunTrait.Knockback]: 'Knockback',
  [GunTrait.CriticalChance]: 'Crit Chance',
  [GunTrait.CriticalMultiplier]: 'Crit Multiplier',
  [GunTrait.Piercing]: 'Piercing',
  [GunTrait.Bouncing]: 'Bouncing',
};

interface GunPanelProps {
  gun: ComparisonGunData;
  title: string;
  testIdPrefix: string;
}

function GunPanel({ gun, title, testIdPrefix }: GunPanelProps) {
  return (
    <div
      data-testid={`${testIdPrefix}-panel`}
      style={{
        border: '2px solid #555',
        backgroundColor: '#1a1a1a',
        padding: '16px',
        borderRadius: '8px',
        minWidth: '240px',
      }}
    >
      <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '4px' }}>{title}</div>
      <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>
        {GUN_TYPE_NAMES[gun.gunType]}
      </div>

      <div style={{ fontSize: '12px', lineHeight: '1.8' }}>
        <StatLabel label="Damage" value={gun.damage} />
        <StatLabel label="Fire Rate" value={gun.fireRate} />
        <StatLabel label="Magazine" value={gun.magazineSize} />
        <StatLabel label="Reload" value={gun.reloadTime} />
        <StatLabel label="Spread" value={gun.spread} />
        <StatLabel label="Projectiles" value={gun.projectileCount} />
        <StatLabel label="Proj Speed" value={gun.projectileSpeed} />
        <StatLabel label="Knockback" value={gun.knockback} />
        <StatLabel label="Crit Chance" value={gun.critChance} />
        <StatLabel label="Crit Multi" value={gun.critMultiplier} />
      </div>

      <div style={{ marginTop: '12px', fontSize: '12px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#ffcc00' }}>Traits</div>
        {gun.traits.map((trait, i) => (
          <div key={i} data-testid={`${testIdPrefix}-trait-${i}`}>
            {TRAIT_NAMES[trait]} (Lv {gun.traitLevels[i]})
          </div>
        ))}
      </div>
    </div>
  );
}

function StatLabel({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function GunComparisonScreen() {
  const currentState = useAppStore((s) => s.currentState);
  const transition = useAppStore((s) => s.transition);
  const currentGun = useComparisonStore((s) => s.currentGun);
  const foundGun = useComparisonStore((s) => s.foundGun);
  const swapGuns = useComparisonStore((s) => s.swapGuns);
  const clearComparison = useComparisonStore((s) => s.clearComparison);

  const handleSwap = useCallback(() => {
    if (swapGuns) swapGuns();
    getAudioManager().play(SoundId.GunSwapConfirm);
    clearComparison();
    transition(AppState.Gameplay);
  }, [swapGuns, clearComparison, transition]);

  const handleCancel = useCallback(() => {
    clearComparison();
    transition(AppState.Gameplay);
  }, [clearComparison, transition]);

  if (currentState !== AppState.GunComparison) return null;
  if (!currentGun || !foundGun) return null;

  return (
    <div
      data-testid="gun-comparison-screen"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        color: '#eee',
        fontFamily: 'monospace',
        zIndex: 200,
        gap: '24px',
      }}
    >
      <h1 style={{ fontSize: '24px', margin: 0 }}>Gun Found!</h1>

      <div style={{ display: 'flex', gap: '24px' }}>
        <GunPanel gun={currentGun} title="Current" testIdPrefix="current-gun" />
        <GunPanel gun={foundGun} title="Found" testIdPrefix="found-gun" />
      </div>

      <div style={{ display: 'flex', gap: '16px' }}>
        <button
          data-testid="cancel-button"
          onClick={handleCancel}
          style={{
            padding: '12px 32px',
            fontSize: '16px',
            backgroundColor: '#333',
            color: '#eee',
            border: '2px solid #555',
            borderRadius: '8px',
            cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          Keep Current
        </button>
        <button
          data-testid="swap-button"
          onClick={handleSwap}
          style={{
            padding: '12px 32px',
            fontSize: '18px',
            fontWeight: 'bold',
            backgroundColor: '#2a6e2a',
            color: '#fff',
            border: '2px solid #4a4',
            borderRadius: '8px',
            cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          Swap
        </button>
      </div>
    </div>
  );
}
