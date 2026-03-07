import { AppState } from '../ecs/components';
import { useAppStore } from '../store/appStore';

export function PauseOverlay() {
  const currentState = useAppStore((s) => s.currentState);
  const transition = useAppStore((s) => s.transition);

  if (currentState !== AppState.Paused) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <h1 style={{ color: '#ffffff', fontSize: '48px', marginBottom: '32px' }}>
        PAUSED
      </h1>
      <button onClick={() => transition(AppState.Gameplay)} style={buttonStyle}>
        Resume
      </button>
      <button onClick={() => transition(AppState.Settings)} style={buttonStyle}>
        Settings
      </button>
      <button onClick={() => transition(AppState.MainMenu)} style={buttonStyle}>
        Quit to Menu
      </button>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  width: '200px',
  padding: '12px 24px',
  marginBottom: '12px',
  fontSize: '18px',
  cursor: 'pointer',
  border: '2px solid #ffffff',
  backgroundColor: 'transparent',
  color: '#ffffff',
};
