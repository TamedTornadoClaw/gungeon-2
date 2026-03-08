import { useEffect, useState } from 'react';

const CROSSHAIR_SIZE = 24;
const CIRCLE_SIZE = 16;
const LINE_LENGTH = 8;
const LINE_THICKNESS = 2;
const COLOR = '#ffffff';

export function Crosshair() {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const onChange = () => {
      setLocked(document.pointerLockElement != null);
    };
    document.addEventListener('pointerlockchange', onChange);
    // Check initial state
    onChange();
    return () => document.removeEventListener('pointerlockchange', onChange);
  }, []);

  if (!locked) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        top: '50%',
        width: CROSSHAIR_SIZE,
        height: CROSSHAIR_SIZE,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      {/* Circle */}
      <div
        style={{
          position: 'absolute',
          left: (CROSSHAIR_SIZE - CIRCLE_SIZE) / 2,
          top: (CROSSHAIR_SIZE - CIRCLE_SIZE) / 2,
          width: CIRCLE_SIZE,
          height: CIRCLE_SIZE,
          borderRadius: '50%',
          border: `${LINE_THICKNESS}px solid ${COLOR}`,
          boxSizing: 'border-box',
        }}
      />
      {/* Top line */}
      <div
        style={{
          position: 'absolute',
          left: (CROSSHAIR_SIZE - LINE_THICKNESS) / 2,
          top: 0,
          width: LINE_THICKNESS,
          height: LINE_LENGTH,
          backgroundColor: COLOR,
        }}
      />
      {/* Bottom line */}
      <div
        style={{
          position: 'absolute',
          left: (CROSSHAIR_SIZE - LINE_THICKNESS) / 2,
          bottom: 0,
          width: LINE_THICKNESS,
          height: LINE_LENGTH,
          backgroundColor: COLOR,
        }}
      />
      {/* Left line */}
      <div
        style={{
          position: 'absolute',
          top: (CROSSHAIR_SIZE - LINE_THICKNESS) / 2,
          left: 0,
          width: LINE_LENGTH,
          height: LINE_THICKNESS,
          backgroundColor: COLOR,
        }}
      />
      {/* Right line */}
      <div
        style={{
          position: 'absolute',
          top: (CROSSHAIR_SIZE - LINE_THICKNESS) / 2,
          right: 0,
          width: LINE_LENGTH,
          height: LINE_THICKNESS,
          backgroundColor: COLOR,
        }}
      />
    </div>
  );
}
