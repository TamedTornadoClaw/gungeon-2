import { useEffect, useRef, useState } from 'react';

const CROSSHAIR_SIZE = 24;
const CIRCLE_SIZE = 16;
const LINE_LENGTH = 8;
const LINE_THICKNESS = 2;
const COLOR = '#ffffff';

export function Crosshair() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const rafId = useRef(0);
  const posRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      if (!visible) setVisible(true);
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        setPosition({ x: posRef.current.x, y: posRef.current.y });
      });
    };

    document.body.style.cursor = 'none';
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId.current);
    };
  }, [visible]);

  if (!visible) return null;

  const half = CROSSHAIR_SIZE / 2;

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x - half,
        top: position.y - half,
        width: CROSSHAIR_SIZE,
        height: CROSSHAIR_SIZE,
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
