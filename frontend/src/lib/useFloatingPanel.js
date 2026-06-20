import { useEffect, useRef, useState } from 'react';

// Small helper to make a panel draggable + resizable, persisting its
// position and size in localStorage under `${key}.pos` / `${key}.size`.
// Returns props to spread onto the panel and its drag handle (title bar).

const read = (k) => {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch { return null; }
};
const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
};

export function useFloatingPanel(key, { defaultPos, enabled = true } = {}) {
  const posKey = `${key}.pos`;
  const sizeKey = `${key}.size`;

  const [pos, setPos] = useState(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const saved = read(posKey);
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      // Keep it on-screen if the viewport shrank since last session.
      return { x: Math.min(saved.x, vw - 60), y: Math.min(saved.y, vh - 40) };
    }
    return defaultPos || { x: 24, y: 132 };
  });
  const [size, setSize] = useState(() => read(sizeKey));
  const panelRef = useRef(null);
  const dragging = useRef(false);

  useEffect(() => { write(posKey, pos); }, [pos]);
  useEffect(() => { if (size) write(sizeKey, size); }, [size]);

  // Persist size as the user resizes the panel (CSS resize: both).
  useEffect(() => {
    if (!enabled) return;
    const el = panelRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (!el.offsetWidth) return;
      const next = { w: el.offsetWidth, h: el.offsetHeight };
      setSize((p) => (p && p.w === next.w && p.h === next.h ? p : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [enabled]);

  // Drag by the title bar via pointer events (never HTML5 draggable, so it
  // doesn't collide with row drag-and-drop elsewhere).
  const onDragStart = (e) => {
    if (e.target.closest('button, select, input, a, textarea, [data-no-drag]')) return;
    dragging.current = true;
    const sx = e.clientX;
    const sy = e.clientY;
    const orig = { ...pos };
    const move = (ev) => {
      if (!dragging.current) return;
      setPos({
        x: Math.min(window.innerWidth - 60, Math.max(0, orig.x + (ev.clientX - sx))),
        y: Math.min(window.innerHeight - 40, Math.max(0, orig.y + (ev.clientY - sy))),
      });
    };
    const up = () => {
      dragging.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const style = {
    left: `${pos.x}px`,
    top: `${pos.y}px`,
    ...(size ? { width: `${size.w}px`, height: `${size.h}px` } : {}),
  };

  return { panelRef, onDragStart, style };
}
