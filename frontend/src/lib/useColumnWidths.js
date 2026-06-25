import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Hook for Excel-like resizable table columns whose widths persist in
// localStorage. Pass a unique storageKey and the FIELDS array (each field may
// carry a `colWidth` default). Returns the current widths map plus a drag
// handler to wire to a resize grip in each header cell.
export function useColumnWidths(storageKey, fields) {
  const defaults = useMemo(() => {
    const d = {};
    fields.forEach((f) => { if (f.colWidth) d[f.key] = f.colWidth; });
    return d;
  }, [fields]);

  const [widths, setWidths] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return { ...defaults, ...saved };
    } catch {
      return { ...defaults };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(widths));
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [storageKey, widths]);

  const drag = useRef(null);

  const onResizeStart = useCallback((key) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const th = e.currentTarget.closest('th');
    const startWidth = th ? th.offsetWidth : (widths[key] || 80);
    drag.current = { key, startX: e.clientX, startWidth };

    const onMove = (ev) => {
      if (!drag.current) return;
      const delta = ev.clientX - drag.current.startX;
      // Clamp between a usable minimum and a sane maximum so a column can never
      // run away off-screen (which would also hide its own resize grip).
      const raw = Math.round(drag.current.startWidth + delta);
      const next = Math.min(640, Math.max(48, raw));
      setWidths((w) => ({ ...w, [drag.current.key]: next }));
    };
    const onUp = () => {
      drag.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('col-resizing');
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.classList.add('col-resizing');
  }, [widths]);

  // Double-click on the grip restores a single column to its default width.
  const resetColumn = useCallback((key) => {
    setWidths((w) => {
      const next = { ...w };
      if (defaults[key] != null) next[key] = defaults[key];
      else delete next[key];
      return next;
    });
  }, [defaults]);

  const resetAll = useCallback(() => setWidths({ ...defaults }), [defaults]);

  return { widths, onResizeStart, resetColumn, resetAll };
}
