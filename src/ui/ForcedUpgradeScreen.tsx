import { AppState, GunTrait, WeaponSlot } from '../ecs/components';
import type { Gun } from '../ecs/components';
import { useAppStore } from '../store/appStore';
import { useUpgradeStore } from '../store/upgradeStore';

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

export function ForcedUpgradeScreen() {
  const currentState = useAppStore((s) => s.currentState);
  const transition = useAppStore((s) => s.transition);
  const forcedUpgradeGunSlot = useAppStore((s) => s.forcedUpgradeGunSlot);
  const gunXP = useUpgradeStore((s) => s.gunXP);
  const traits = useUpgradeStore((s) => s.traits);
  const upgradesSpent = useUpgradeStore((s) => s.upgradesSpent);
  const spendUpgrade = useUpgradeStore((s) => s.spendUpgrade);
  const closeUpgrade = useUpgradeStore((s) => s.closeUpgrade);
  const worldRef = useUpgradeStore((s) => s.worldRef);
  const gunEntityId = useUpgradeStore((s) => s.gunEntityId);

  if (currentState !== AppState.ForcedUpgrade) return null;

  const handleUpgrade = (traitIndex: number) => {
    spendUpgrade(traitIndex);
  };

  const handleClose = () => {
    // Reset forcedUpgradeTriggered on the gun
    if (worldRef && gunEntityId !== null) {
      const gun = worldRef.getComponent<Gun>(gunEntityId, 'Gun');
      if (gun) {
        gun.forcedUpgradeTriggered = false;
      }
    }

    closeUpgrade();
    useAppStore.setState({ forcedUpgradeGunSlot: null });
    transition(AppState.Gameplay);
  };

  const slotLabel =
    forcedUpgradeGunSlot === WeaponSlot.Sidearm
      ? 'Sidearm'
      : forcedUpgradeGunSlot === WeaponSlot.LongArm
        ? 'Long Arm'
        : 'Gun';

  return (
    <div data-testid="forced-upgrade-screen" style={OVERLAY_STYLE}>
      <div style={PANEL_STYLE}>
        <div style={TITLE_STYLE}>Upgrade {slotLabel}</div>
        <div data-testid="forced-upgrade-xp" style={XP_STYLE}>
          XP: {gunXP}
        </div>

        <div data-testid="forced-upgrade-traits">
          {traits.map((traitData, index) => {
            const canAfford = traitData.cost !== null && gunXP >= traitData.cost;
            const isMaxed = traitData.cost === null;
            const disabled = isMaxed || !canAfford;

            return (
              <div key={index} style={TRAIT_STYLE} data-testid={`forced-upgrade-trait-${index}`}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 'bold' }}>
                    {GunTrait[traitData.trait]}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    Lv {traitData.level} / {traitData.maxLevel}
                  </div>
                </div>
                <button
                  data-testid={`forced-upgrade-buy-${index}`}
                  disabled={disabled}
                  onClick={() => handleUpgrade(index)}
                  style={{
                    ...UPGRADE_BUTTON_BASE,
                    backgroundColor: isMaxed
                      ? '#333'
                      : canAfford
                        ? '#2a7a2a'
                        : '#555',
                    color: disabled ? '#888' : '#fff',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.6 : 1,
                  }}
                >
                  {isMaxed ? 'MAX' : `${traitData.cost} XP`}
                </button>
              </div>
            );
          })}
        </div>

        {upgradesSpent > 0 && (
          <button
            data-testid="forced-upgrade-close"
            onClick={handleClose}
            style={CLOSE_BUTTON_STYLE}
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
