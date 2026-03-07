import { AppState, PickupType } from '../ecs/components';
import { useAppStore } from '../store/appStore';
import { useGameplayStore } from '../store/gameplayStore';
import { useShopStore } from '../store/shopStore';

const PICKUP_LABELS: Record<PickupType, string> = {
  [PickupType.XPGem]: 'XP Gem',
  [PickupType.HealthPickup]: 'Health Pack',
  [PickupType.Currency]: 'Currency',
  [PickupType.GunPickup]: 'Gun',
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

const CURRENCY_STYLE: React.CSSProperties = {
  fontSize: 14,
  textAlign: 'center',
  marginBottom: 16,
  color: '#ffd700',
};

const ITEM_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  marginBottom: 8,
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  borderRadius: 4,
  border: '1px solid rgba(255, 255, 255, 0.1)',
};

const BUY_BUTTON_BASE: React.CSSProperties = {
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

export function ShopUI() {
  const currentState = useAppStore((s) => s.currentState);
  const transition = useAppStore((s) => s.transition);
  const currency = useGameplayStore((s) => s.currency);
  const items = useShopStore((s) => s.items);
  const purchase = useShopStore((s) => s.purchase);
  const closeShop = useShopStore((s) => s.closeShop);

  if (currentState !== AppState.ShopBrowse) return null;

  const handlePurchase = (index: number) => {
    purchase(index, currency);
  };

  const handleClose = () => {
    closeShop();
    useAppStore.setState({ activeShopEntityId: null });
    transition(AppState.Gameplay);
  };

  return (
    <div data-testid="shop-ui" style={OVERLAY_STYLE}>
      <div style={PANEL_STYLE}>
        <div style={TITLE_STYLE}>Shop</div>
        <div data-testid="shop-currency" style={CURRENCY_STYLE}>
          $ {currency}
        </div>

        <div data-testid="shop-inventory">
          {items.map((item, index) => {
            const canAfford = currency >= item.price;
            const disabled = item.sold || !canAfford;

            return (
              <div key={index} style={ITEM_STYLE} data-testid={`shop-item-${index}`}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 'bold' }}>
                    {PICKUP_LABELS[item.type]}
                  </div>
                  {item.healAmount !== undefined && (
                    <div style={{ fontSize: 11, opacity: 0.7 }}>
                      +{item.healAmount} HP
                    </div>
                  )}
                </div>
                <button
                  data-testid={`shop-buy-${index}`}
                  disabled={disabled}
                  onClick={() => handlePurchase(index)}
                  style={{
                    ...BUY_BUTTON_BASE,
                    backgroundColor: item.sold
                      ? '#333'
                      : canAfford
                        ? '#2a7a2a'
                        : '#555',
                    color: disabled ? '#888' : '#fff',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.6 : 1,
                  }}
                >
                  {item.sold ? 'SOLD' : `$ ${item.price}`}
                </button>
              </div>
            );
          })}
        </div>

        <button
          data-testid="shop-close"
          onClick={handleClose}
          style={CLOSE_BUTTON_STYLE}
        >
          Close
        </button>
      </div>
    </div>
  );
}
