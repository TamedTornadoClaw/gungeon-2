import { AppState } from '../ecs/components';
import { useAppStore } from '../store/appStore';

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#0a0a0a',
  color: '#e0e0e0',
  fontFamily: 'monospace',
};

const titleStyle: React.CSSProperties = {
  fontSize: '4rem',
  fontWeight: 'bold',
  letterSpacing: '0.3em',
  marginBottom: '3rem',
  textTransform: 'uppercase',
  color: '#ffcc00',
  textShadow: '0 0 20px rgba(255, 204, 0, 0.5)',
};

const buttonStyle: React.CSSProperties = {
  padding: '0.8rem 2.5rem',
  fontSize: '1.2rem',
  fontFamily: 'monospace',
  fontWeight: 'bold',
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  color: '#e0e0e0',
  backgroundColor: 'transparent',
  border: '2px solid #e0e0e0',
  cursor: 'pointer',
  marginBottom: '1rem',
  minWidth: '220px',
};

export function MainMenu() {
  const transition = useAppStore((s) => s.transition);

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Gungeon</h1>
      <button
        style={buttonStyle}
        onClick={() => transition(AppState.WeaponSelect)}
      >
        Start Game
      </button>
      <button
        style={buttonStyle}
        onClick={() => transition(AppState.Settings)}
      >
        Settings
      </button>
    </div>
  );
}
