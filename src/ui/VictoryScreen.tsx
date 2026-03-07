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
  marginBottom: '2rem',
  textTransform: 'uppercase',
  color: '#00ff88',
  textShadow: '0 0 20px rgba(0, 255, 136, 0.5)',
};

const statsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  marginBottom: '2rem',
  fontSize: '1.1rem',
  minWidth: '280px',
};

const statRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '0.3rem 0',
  borderBottom: '1px solid #333',
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
  marginTop: '1rem',
  minWidth: '220px',
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VictoryScreen() {
  const transition = useAppStore((s) => s.transition);
  const runStats = useAppStore((s) => s.runStats);

  return (
    <div style={containerStyle} data-testid="victory-screen">
      <h1 style={titleStyle}>Victory</h1>
      {runStats && (
        <div style={statsContainerStyle} data-testid="run-stats">
          <div style={statRowStyle}>
            <span>Kills</span>
            <span>{runStats.kills}</span>
          </div>
          <div style={statRowStyle}>
            <span>Depth Reached</span>
            <span>{runStats.depthReached}</span>
          </div>
          <div style={statRowStyle}>
            <span>Time Survived</span>
            <span>{formatTime(runStats.timeSurvived)}</span>
          </div>
          <div style={statRowStyle}>
            <span>Guns Used</span>
            <span>{runStats.gunsUsed.length}</span>
          </div>
          <div style={statRowStyle}>
            <span>Traits Leveled</span>
            <span>{runStats.traitsLeveled}</span>
          </div>
        </div>
      )}
      <button
        style={buttonStyle}
        onClick={() => transition(AppState.MainMenu)}
      >
        Return to Menu
      </button>
    </div>
  );
}
