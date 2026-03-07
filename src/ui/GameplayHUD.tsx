import { AppState, GunType, WeaponSlot } from '../ecs/components';
import { useAppStore } from '../store/appStore';
import { useGameplayStore } from '../store/gameplayStore';

const SLOT_LABELS: Record<WeaponSlot, string> = {
  [WeaponSlot.Sidearm]: 'Sidearm',
  [WeaponSlot.LongArm]: 'Long Arm',
};

const GUN_TYPE_LABELS: Record<GunType, string> = {
  [GunType.Pistol]: 'Pistol',
  [GunType.SMG]: 'SMG',
  [GunType.AssaultRifle]: 'AR',
  [GunType.Shotgun]: 'Shotgun',
  [GunType.LMG]: 'LMG',
};

const HUD_STYLE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 100,
  fontFamily: 'monospace',
  color: '#ffffff',
  textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
};

const HEALTH_BAR_BG: React.CSSProperties = {
  width: 200,
  height: 20,
  backgroundColor: 'rgba(0,0,0,0.6)',
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: 3,
  overflow: 'hidden',
};

const BOTTOM_LEFT: React.CSSProperties = {
  position: 'absolute',
  bottom: 16,
  left: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const BOTTOM_RIGHT: React.CSSProperties = {
  position: 'absolute',
  bottom: 16,
  right: 16,
  textAlign: 'right',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const TOP_RIGHT: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  textAlign: 'right',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const MINIMAP_PLACEHOLDER: React.CSSProperties = {
  width: 120,
  height: 120,
  backgroundColor: 'rgba(0,0,0,0.5)',
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  color: 'rgba(255,255,255,0.5)',
};

export function GameplayHUD() {
  const currentState = useAppStore((s) => s.currentState);
  const currentHealth = useGameplayStore((s) => s.currentHealth);
  const maxHealth = useGameplayStore((s) => s.maxHealth);
  const currency = useGameplayStore((s) => s.currency);
  const floorDepth = useGameplayStore((s) => s.floorDepth);
  const activeSlot = useGameplayStore((s) => s.activeSlot);
  const activeGun = useGameplayStore((s) => s.activeGun);

  if (currentState !== AppState.Gameplay) return null;

  const healthPct = maxHealth > 0 ? (currentHealth / maxHealth) * 100 : 0;
  const healthColor = healthPct > 50 ? '#4caf50' : healthPct > 25 ? '#ff9800' : '#f44336';

  return (
    <div data-testid="gameplay-hud" style={HUD_STYLE}>
      {/* Bottom-left: Health + Currency */}
      <div style={BOTTOM_LEFT}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 2 }}>
            HP {currentHealth}/{maxHealth}
          </div>
          <div style={HEALTH_BAR_BG}>
            <div
              data-testid="health-bar-fill"
              style={{
                width: `${healthPct}%`,
                height: '100%',
                backgroundColor: healthColor,
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        </div>
        <div data-testid="currency-counter" style={{ fontSize: 14 }}>
          $ {currency}
        </div>
      </div>

      {/* Bottom-right: Gun info */}
      <div style={BOTTOM_RIGHT}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{SLOT_LABELS[activeSlot]}</div>
        {activeGun && (
          <>
            <div style={{ fontSize: 14, fontWeight: 'bold' }}>
              {GUN_TYPE_LABELS[activeGun.gunType]}
            </div>
            {activeGun.isReloading ? (
              <div data-testid="reload-indicator" style={{ fontSize: 14, color: '#ff9800' }}>
                RELOADING
              </div>
            ) : (
              <div data-testid="ammo-display" style={{ fontSize: 14 }}>
                {activeGun.currentAmmo} / {activeGun.magazineSize}
              </div>
            )}
          </>
        )}
      </div>

      {/* Top-right: Floor depth + Minimap */}
      <div style={TOP_RIGHT}>
        <div data-testid="floor-depth" style={{ fontSize: 14, marginBottom: 4 }}>
          Floor {floorDepth}
        </div>
        <div data-testid="minimap-placeholder" style={MINIMAP_PLACEHOLDER}>
          Minimap
        </div>
      </div>
    </div>
  );
}
