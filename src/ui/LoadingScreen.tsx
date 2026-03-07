import { useEffect, useState } from 'react';
import { AppState } from '../ecs/components';
import { getDesignParams } from '../config/designParams';
import { useAppStore } from '../store/appStore';

const { loadDurationMs, progressIntervalMs } = getDesignParams().loadingScreen;
const PROGRESS_INCREMENT = progressIntervalMs / loadDurationMs;

export function LoadingScreen() {
  const currentState = useAppStore((s) => s.currentState);
  const transition = useAppStore((s) => s.transition);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (currentState !== AppState.Loading) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + PROGRESS_INCREMENT;
        if (next >= 1) {
          clearInterval(interval);
          return 1;
        }
        return next;
      });
    }, progressIntervalMs);

    return () => clearInterval(interval);
  }, [currentState]);

  useEffect(() => {
    if (progress >= 1) {
      transition(AppState.MainMenu);
    }
  }, [progress, transition]);

  if (currentState !== AppState.Loading) return null;

  const percentage = Math.min(Math.round(progress * 100), 100);

  return (
    <div
      data-testid="loading-screen"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        color: '#fff',
        fontFamily: 'monospace',
        zIndex: 1000,
      }}
    >
      <div style={{ fontSize: '2rem', marginBottom: '2rem' }}>Loading...</div>
      <div
        style={{
          width: '300px',
          height: '20px',
          border: '2px solid #fff',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <div
          data-testid="loading-progress-bar"
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: '#4caf50',
            transition: 'width 50ms linear',
          }}
        />
      </div>
      <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>{percentage}%</div>
    </div>
  );
}
