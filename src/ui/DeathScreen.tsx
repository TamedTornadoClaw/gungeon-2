import { AppState, GunType } from '../ecs/components';
import { useAppStore } from '../store/appStore';

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(10, 0, 0, 0.95)',
  color: '#e0e0e0',
  fontFamily: 'monospace',
  zIndex: 1000,
};

const titleStyle: React.CSSProperties = {
  fontSize: '4rem',
  fontWeight: 'bold',
  letterSpacing: '0.3em',
  marginBottom: '2rem',
  textTransform: 'uppercase',
  color: '#cc0000',
  textShadow: '0 0 20px rgba(204, 0, 0, 0.5)',
};

const statsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  marginBottom: '2.5rem',
  padding: '1.5rem 2rem',
  border: '1px solid #444',
  minWidth: '300px',
};

const statRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '1.1rem',
};

const statLabelStyle: React.CSSProperties = {
  color: '#999',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
};

const statValueStyle: React.CSSProperties = {
  color: '#e0e0e0',
  fontWeight: 'bold',
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
  minWidth: '220px',
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function DeathScreen() {
  const currentState = useAppStore((s) => s.currentState);
  const transition = useAppStore((s) => s.transition);
  const runStats = useAppStore((s) => s.runStats);

  if (currentState !== AppState.Death) return null;

  const kills = runStats?.kills ?? 0;
  const depth = runStats?.depthReached ?? 0;
  const time = runStats?.timeSurvived ?? 0;
  const gunsUsed = runStats?.gunsUsed ?? [];
  const traitsLeveled = runStats?.traitsLeveled ?? 0;

  return (
    <div style={containerStyle} data-testid="death-screen">
      <h1 style={titleStyle}>You Died</h1>
      <div style={statsContainerStyle}>
        <div style={statRowStyle}>
          <span style={statLabelStyle}>Kills</span>
          <span style={statValueStyle}>{kills}</span>
        </div>
        <div style={statRowStyle}>
          <span style={statLabelStyle}>Depth</span>
          <span style={statValueStyle}>Floor {depth}</span>
        </div>
        <div style={statRowStyle}>
          <span style={statLabelStyle}>Time</span>
          <span style={statValueStyle}>{formatTime(time)}</span>
        </div>
        <div style={statRowStyle}>
          <span style={statLabelStyle}>Guns Used</span>
          <span style={statValueStyle}>
            {gunsUsed.length > 0
              ? gunsUsed.map((g) => GunType[g]).join(', ')
              : 'None'}
          </span>
        </div>
        <div style={statRowStyle}>
          <span style={statLabelStyle}>Traits Leveled</span>
          <span style={statValueStyle}>{traitsLeveled}</span>
        </div>
      </div>
      <button style={buttonStyle} onClick={() => transition(AppState.MainMenu)}>
        Return to Menu
      </button>
    </div>
  );
}
