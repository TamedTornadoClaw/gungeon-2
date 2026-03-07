import { useState, useCallback } from 'react';
import { AppState, GunType, GunCategory } from '../ecs/components';
import { useAppStore } from '../store/appStore';
import { getDesignParams } from '../config/designParams';
import type { GunParams } from '../config/designParams';

const GUN_TYPE_NAMES: Record<GunType, string> = {
  [GunType.Pistol]: 'Pistol',
  [GunType.SMG]: 'SMG',
  [GunType.AssaultRifle]: 'Assault Rifle',
  [GunType.Shotgun]: 'Shotgun',
  [GunType.LMG]: 'LMG',
};

function getGunsByCategory(): { sidearms: GunType[]; longArms: GunType[] } {
  const params = getDesignParams();
  const sidearms: GunType[] = [];
  const longArms: GunType[] = [];

  for (const [name, gun] of Object.entries(params.guns)) {
    const gunType = GunType[name as keyof typeof GunType];
    if (gunType === undefined) continue;
    if (gun.category === GunCategory[GunCategory.Sidearm]) {
      sidearms.push(gunType);
    } else if (gun.category === GunCategory[GunCategory.LongArm]) {
      longArms.push(gunType);
    }
  }

  return { sidearms, longArms };
}

function getGunParams(gunType: GunType): GunParams {
  const params = getDesignParams();
  const name = GunType[gunType];
  return params.guns[name];
}

const STAT_LABELS: { key: keyof GunParams; label: string }[] = [
  { key: 'damage', label: 'Damage' },
  { key: 'fireRate', label: 'Fire Rate' },
  { key: 'magazineSize', label: 'Magazine' },
  { key: 'reloadTime', label: 'Reload' },
  { key: 'spread', label: 'Spread' },
  { key: 'projectileCount', label: 'Projectiles' },
  { key: 'knockback', label: 'Knockback' },
  { key: 'critChance', label: 'Crit Chance' },
  { key: 'critMultiplier', label: 'Crit Multi' },
];

interface GunCardProps {
  gunType: GunType;
  selected: boolean;
  onSelect: (gunType: GunType) => void;
}

function GunCard({ gunType, selected, onSelect }: GunCardProps) {
  const gun = getGunParams(gunType);
  const handleClick = useCallback(() => onSelect(gunType), [gunType, onSelect]);

  return (
    <button
      data-testid={`gun-card-${GunType[gunType]}`}
      onClick={handleClick}
      style={{
        border: selected ? '2px solid #ffcc00' : '2px solid #555',
        backgroundColor: selected ? '#2a2a1a' : '#1a1a1a',
        color: '#eee',
        padding: '12px',
        borderRadius: '8px',
        cursor: 'pointer',
        minWidth: '160px',
        textAlign: 'left',
      }}
    >
      <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
        {GUN_TYPE_NAMES[gunType]}
      </div>
      <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
        {STAT_LABELS.map(({ key, label }) => (
          <div key={key}>
            {label}: {gun[key]}
          </div>
        ))}
      </div>
      <div style={{ fontSize: '11px', marginTop: '8px', color: '#aaa' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Traits</div>
        {gun.traits.map((trait) => (
          <span key={trait} style={{ marginRight: '6px' }}>{trait}</span>
        ))}
      </div>
    </button>
  );
}

export function WeaponSelect() {
  const transition = useAppStore((s) => s.transition);
  const { sidearms, longArms } = getGunsByCategory();

  const [selectedSidearm, setSelectedSidearm] = useState<GunType>(sidearms[0]);
  const [selectedLongArm, setSelectedLongArm] = useState<GunType | null>(null);

  const canStart = selectedSidearm !== undefined && selectedLongArm !== null;

  const handleStartRun = useCallback(() => {
    if (!canStart) return;
    useAppStore.setState({ selectedSidearm, selectedLongArm });
    transition(AppState.Gameplay);
  }, [canStart, selectedSidearm, selectedLongArm, transition]);

  const handleBack = useCallback(() => {
    transition(AppState.MainMenu);
  }, [transition]);

  return (
    <div
      data-testid="weapon-select-screen"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#111',
        color: '#eee',
        fontFamily: 'monospace',
        gap: '24px',
      }}
    >
      <h1 style={{ fontSize: '28px', margin: 0 }}>Choose Your Weapons</h1>

      <div>
        <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Sidearm</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          {sidearms.map((g) => (
            <GunCard
              key={g}
              gunType={g}
              selected={g === selectedSidearm}
              onSelect={setSelectedSidearm}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Long Arm</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          {longArms.map((g) => (
            <GunCard
              key={g}
              gunType={g}
              selected={g === selectedLongArm}
              onSelect={setSelectedLongArm}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
        <button
          data-testid="back-button"
          onClick={handleBack}
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
          Back
        </button>
        <button
          data-testid="start-run-button"
          onClick={handleStartRun}
          disabled={!canStart}
          style={{
            padding: '12px 32px',
            fontSize: '18px',
            fontWeight: 'bold',
            backgroundColor: canStart ? '#2a6e2a' : '#333',
            color: canStart ? '#fff' : '#666',
            border: canStart ? '2px solid #4a4' : '2px solid #444',
            borderRadius: '8px',
            cursor: canStart ? 'pointer' : 'not-allowed',
            fontFamily: 'monospace',
          }}
        >
          Start Run
        </button>
      </div>
    </div>
  );
}
