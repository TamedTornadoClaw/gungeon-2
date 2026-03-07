import { useAppStore } from '../store/appStore';
import { useSettingsStore } from '../store/settingsStore';

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
  zIndex: 1000,
};

const titleStyle: React.CSSProperties = {
  fontSize: '3rem',
  fontWeight: 'bold',
  letterSpacing: '0.2em',
  marginBottom: '2rem',
  textTransform: 'uppercase',
  color: '#ffcc00',
  textShadow: '0 0 20px rgba(255, 204, 0, 0.5)',
};

const sliderContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  marginBottom: '1.5rem',
  width: '300px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '1rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  marginBottom: '0.5rem',
};

const sliderStyle: React.CSSProperties = {
  width: '100%',
  cursor: 'pointer',
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

export function SettingsScreen() {
  const previousState = useAppStore((s) => s.previousState);
  const transition = useAppStore((s) => s.transition);

  const masterVolume = useSettingsStore((s) => s.masterVolume);
  const sfxVolume = useSettingsStore((s) => s.sfxVolume);
  const mouseSensitivity = useSettingsStore((s) => s.mouseSensitivity);
  const setMasterVolume = useSettingsStore((s) => s.setMasterVolume);
  const setSfxVolume = useSettingsStore((s) => s.setSfxVolume);
  const setMouseSensitivity = useSettingsStore((s) => s.setMouseSensitivity);

  const handleBack = () => {
    if (previousState !== null) {
      transition(previousState);
    }
  };

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Settings</h1>

      <div style={sliderContainerStyle}>
        <label style={labelStyle}>Master Volume: {Math.round(masterVolume * 100)}%</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={masterVolume}
          onChange={(e) => setMasterVolume(Number(e.target.value))}
          style={sliderStyle}
        />
      </div>

      <div style={sliderContainerStyle}>
        <label style={labelStyle}>SFX Volume: {Math.round(sfxVolume * 100)}%</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={sfxVolume}
          onChange={(e) => setSfxVolume(Number(e.target.value))}
          style={sliderStyle}
        />
      </div>

      <div style={sliderContainerStyle}>
        <label style={labelStyle}>Mouse Sensitivity: {Math.round(mouseSensitivity * 100)}%</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={mouseSensitivity}
          onChange={(e) => setMouseSensitivity(Number(e.target.value))}
          style={sliderStyle}
        />
      </div>

      <button style={buttonStyle} onClick={handleBack}>
        Back
      </button>
    </div>
  );
}
