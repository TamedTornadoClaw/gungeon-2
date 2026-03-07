import { AppState, GunTrait, SoundId } from '../ecs/components';
import { useAppStore } from '../store/appStore';
import { useUpgradeStore } from '../store/upgradeStore';
import { getDesignParams } from '../config/designParams';
import { getAudioManager } from '../audio/audioManager';

const TRAIT_LABELS: Record<GunTrait, string> = {
  [GunTrait.Damage]: 'Damage',
  [GunTrait.FireRate]: 'Fire Rate',
  [GunTrait.MagazineSize]: 'Magazine Size',
  [GunTrait.ReloadTime]: 'Reload Time',
  [GunTrait.Spread]: 'Spread',
  [GunTrait.ProjectileCount]: 'Projectile Count',
  [GunTrait.ProjectileSpeed]: 'Projectile Speed',
  [GunTrait.Knockback]: 'Knockback',
  [GunTrait.CriticalChance]: 'Critical Chance',
  [GunTrait.CriticalMultiplier]: 'Critical Multiplier',
  [GunTrait.Piercing]: 'Piercing',
  [GunTrait.Bouncing]: 'Bouncing',
};

const OVERLAY_STYLE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  zIndex: 200,
  fontFamily: 'monospace',
  color: '#ffffff',
};

const PANEL_STYLE: React.CSSProperties = {
  backgroundColor: 'rgba(20, 20, 30, 0.95)',
  border: '2px solid rgba(255, 255, 255, 0.3)',
  borderRadius: 8,
  padding: 24,
  minWidth: 320,
  maxWidth: 480,
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 'bold',
  textAlign: 'center',
  marginBottom: 8,
};

const XP_STYLE: React.CSSProperties = {
  fontSize: 14,
  textAlign: 'center',
  marginBottom: 16,
  color: '#00ffff',
};

const TRAIT_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  marginBottom: 8,
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  borderRadius: 4,
  border: '1px solid rgba(255, 255, 255, 0.1)',
};

const UPGRADE_BUTTON_BASE: React.CSSProperties = {
  padding: '6px 16px',
  border: 'none',
  borderRadius: 4,
  fontFamily: 'monospace',
  fontSize: 13,
  fontWeight: 'bold',
  cursor: 'pointer',
};

const CLOSE_BUTTON_STYLE: React.CSSProperties = {
  display: 'block',
  margin: '16px auto 0',
  padding: '8px 32px',
  backgroundColor: '#444',
  color: '#ffffff',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderRadius: 4,
  fontFamily: 'monospace',
  fontSize: 14,
  cursor: 'pointer',
};

export function GunUpgradeMenu() {
  const currentState = useAppStore((s) => s.currentState);
  const transition = useAppStore((s) => s.transition);
  const xp = useUpgradeStore((s) => s.xp);
  const traits = useUpgradeStore((s) => s.traits);
  const traitLevels = useUpgradeStore((s) => s.traitLevels);
  const spendXP = useUpgradeStore((s) => s.spendXP);
  const closeUpgrade = useUpgradeStore((s) => s.closeUpgrade);

  if (currentState !== AppState.GunUpgrade) return null;

  const params = getDesignParams();

  const handleUpgrade = (index: number) => {
    const success = spendXP(index);
    if (success) {
      getAudioManager().play(SoundId.UpgradeSpent);
    }
  };

  const handleClose = () => {
    closeUpgrade();
    transition(AppState.Gameplay);
  };

  return (
    <div data-testid="gun-upgrade-menu" style={OVERLAY_STYLE}>
      <div style={PANEL_STYLE}>
        <div style={TITLE_STYLE}>Upgrade Gun</div>
        <div data-testid="gun-xp" style={XP_STYLE}>
          XP: {xp}
        </div>

        <div data-testid="trait-list">
          {traits.map((trait, index) => {
            const level = traitLevels[index];
            const maxed = level >= params.traits.maxLevel;
            const cost = maxed ? null : params.traits.xpCosts[level];
            const canAfford = cost !== null && xp >= cost;
            const disabled = maxed || !canAfford;

            return (
              <div key={index} style={TRAIT_STYLE} data-testid={`trait-${index}`}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 'bold' }}>
                    {TRAIT_LABELS[trait]}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    Lv {level} / {params.traits.maxLevel}
                  </div>
                </div>
                <button
                  data-testid={`upgrade-${index}`}
                  disabled={disabled}
                  onClick={() => handleUpgrade(index)}
                  style={{
                    ...UPGRADE_BUTTON_BASE,
                    backgroundColor: maxed
                      ? '#333'
                      : canAfford
                        ? '#2a7a2a'
                        : '#555',
                    color: disabled ? '#888' : '#fff',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.6 : 1,
                  }}
                >
                  {maxed ? 'MAX' : `${cost} XP`}
                </button>
              </div>
            );
          })}
        </div>

        <button
          data-testid="upgrade-close"
          onClick={handleClose}
          style={CLOSE_BUTTON_STYLE}
        >
          Close
        </button>
      </div>
    </div>
  );
}
