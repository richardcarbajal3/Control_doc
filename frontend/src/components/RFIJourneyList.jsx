import { useState, useEffect, useRef } from 'react';
import { groupRfiJourneys } from '../lib/rfiJourney';
import { buildOnedriveUrl } from '../lib/onedriveUrl';

const fmt = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Resizable columns (the leading toggle column is fixed). Widths persist in
// localStorage so the layout the user sets sticks across sessions.
const COLUMNS = [
  { key: 'documento', label: 'DOCUMENTO', width: 180 },
  { key: 'descripcion', label: 'DESCRIPCIÓN', width: 300 },
  { key: 'inicio', label: 'INICIO (RECIBIDO)', width: 128 },
  { key: 'cierre', label: 'CIERRE (ENVIADO)', width: 128 },
  { key: 'estado', label: 'ESTADO', width: 104 },
  { key: 'dias', label: 'DÍAS', width: 60 },
  { key: 'remisiones', label: 'REMISIONES', width: 96 },
  { key: 'carpetas', label: 'CARPETAS', width: 96 },
];
const TOGGLE_W = 28;
const MIN_W = 48;
const LS_KEY = 'rfiJourney.colWidths';

const defaultWidths = () => Object.fromEntries(COLUMNS.map((c) => [c.key, c.width]));

function estadoPill(j) {
  if (j.estado === 'cerrado') {
    const late = j.inicio && j.cierre && j.inicio.fecha_vencimiento &&
      new Date(j.cierre.fecha) > new Date(j.inicio.fecha_vencimiento);
    return late
      ? <span className="pill pill-warn" title="Atendido fuera de plazo">Atendido (tarde)</span>
      : <span className="pill pill-ok" title="RFI atendido / respuesta enviada">Atendido</span>;
  }
  return <span className="pill pill-info" title="A la espera de respuesta">Pendiente</span>;
}

// Collapses RFI transmittals into one journey per root document and shows, for
// each, the recorrido: recibido (inicio) → enviado (cierre / atención).
export default function RFIJourneyList({ documents, onRowClick, onedriveBaseUrl }) {
  const journeys = groupRfiJourneys(documents);
  const [expanded, setExpanded] = useState(() => new Set());
  const [widths, setWidths] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      return saved && typeof saved === 'object' ? { ...defaultWidths(), ...saved } : defaultWidths();
    } catch { return defaultWidths(); }
  });
  const resizing = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(widths)); } catch { /* ignore */ }
  }, [widths]);

  const startResize = (e, key) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = { key, startX: e.clientX, startW: widths[key] ?? MIN_W };
    const onMove = (ev) => {
      const r = resizing.current;
      if (!r) return;
      const w = Math.max(MIN_W, r.startW + (ev.clientX - r.startX));
      setWidths((s) => ({ ...s, [r.key]: w }));
    };
    const onUp = () => {
      resizing.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  const resetCol = (key) => setWidths((s) => ({ ...s, [key]: defaultWidths()[key] }));

  if (journeys.length === 0) {
    return (
      <div className="empty-state">
        <p>No se encontraron RFIs</p>
      </div>
    );
  }

  const toggle = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // OneDrive folder for a single transmittal (remisión), or contract folder.
  const folderUrl = (d) =>
    d.transmittal
      ? buildOnedriveUrl(onedriveBaseUrl, d.n_contrato, d.status, d.transmittal)
      : buildOnedriveUrl(onedriveBaseUrl, d.n_contrato);

  const totalCols = COLUMNS.length + 1; // + toggle column

  return (
    <div className="doc-table-scroll">
      <table className="doc-table rfi-journey-table">
        <colgroup>
          <col style={{ width: `${TOGGLE_W}px` }} />
          {COLUMNS.map((c) => (
            <col key={c.key} style={{ width: `${widths[c.key]}px` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th />
            {COLUMNS.map((c) => (
              <th key={c.key} title={c.label}>
                <span className="rfi-col-label">{c.label}</span>
                <span
                  className="col-resize-handle"
                  title="Arrastra para ajustar · doble clic para restablecer"
                  onPointerDown={(e) => startResize(e, c.key)}
                  onDoubleClick={() => resetCol(c.key)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {journeys.map((j) => (
            <FragmentRow
              key={j.key}
              journey={j}
              isOpen={expanded.has(j.key)}
              onToggle={() => toggle(j.key)}
              onRowClick={onRowClick}
              onedriveBaseUrl={onedriveBaseUrl}
              folderUrl={folderUrl}
              totalCols={totalCols}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FolderLink({ doc, label, icon, folderUrl }) {
  if (!doc) return null;
  return (
    <a
      href={folderUrl(doc)}
      target="_blank"
      rel="noopener noreferrer"
      className="rfi-folder-link"
      title={`${label}${doc.transmittal ? `: ${doc.transmittal}` : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      {icon}
    </a>
  );
}

function FragmentRow({ journey: j, isOpen, onToggle, onRowClick, onedriveBaseUrl, folderUrl, totalCols }) {
  return (
    <>
      <tr className="rfi-journey-row" onClick={() => onRowClick?.(j.inicio)}>
        <td className="rfi-journey-toggle">
          <button
            className="rfi-expand-btn"
            title={isOpen ? 'Ocultar remisiones' : 'Ver remisiones'}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
          >
            {isOpen ? '▾' : '▸'}
          </button>
        </td>
        <td className="code-cell" title={j.root}>{j.root || '—'}</td>
        <td className="cell-ellipsis" title={j.descripcion}>{j.descripcion || '—'}</td>
        <td>
          <span className="journey-leg journey-leg-in">{fmt(j.inicio?.fecha)}</span>
        </td>
        <td>
          {j.cierre
            ? <span className="journey-leg journey-leg-out">{fmt(j.cierre.fecha)}</span>
            : <span className="journey-leg journey-leg-empty">— pendiente —</span>}
        </td>
        <td>{estadoPill(j)}</td>
        <td className="rfi-journey-dias">{j.diasRespuesta != null ? `${j.diasRespuesta}d` : '—'}</td>
        <td className="rfi-journey-count">
          <span className="pill pill-soft">{j.docs.length}</span>
        </td>
        <td className="rfi-journey-folders">
          {onedriveBaseUrl && j.n_contrato ? (
            <>
              <FolderLink doc={j.inicio} label="Carpeta recibido (inicio)" icon="📥" folderUrl={folderUrl} />
              {j.cierre && j.cierre.transmittal !== j.inicio?.transmittal && (
                <FolderLink doc={j.cierre} label="Carpeta enviado (cierre)" icon="📤" folderUrl={folderUrl} />
              )}
            </>
          ) : '—'}
        </td>
      </tr>
      {isOpen && (
        <tr className="rfi-journey-detail-row">
          <td colSpan={totalCols}>
            <div className="rfi-journey-detail">
              <div className="rfi-flow">
                <span className={`rfi-step ${j.inicio ? 'rfi-step-done' : 'rfi-step-pending'}`}>Recibido (inicio)</span>
                <span className="rfi-arrow">→</span>
                <span className={`rfi-step ${j.cierre ? 'rfi-step-done' : 'rfi-step-pending'}`}>Enviado (cierre / atención)</span>
              </div>
              <table className="rfi-journey-subtable">
                <thead>
                  <tr>
                    <th>FECHA</th><th># TRANSMITTAL</th><th>STATUS</th><th>STATUS G</th>
                    <th>DESCRIPCIÓN</th><th>ESTATUS DE DOCUMENTO</th><th>ROL</th><th>CARPETA</th>
                  </tr>
                </thead>
                <tbody>
                  {j.docs.map((d) => {
                    const rol = d === j.inicio ? 'Inicio' : d === j.cierre ? 'Cierre' : 'Remisión';
                    return (
                      <tr
                        key={d.id}
                        className={onRowClick ? 'doc-row-clickable' : ''}
                        onClick={() => onRowClick?.(d)}
                      >
                        <td>{fmt(d.fecha)}</td>
                        <td className="transmittal-cell">{d.transmittal || '—'}</td>
                        <td>{d.status || '—'}</td>
                        <td>{d.status_g || '—'}</td>
                        <td title={d.descripcion}>{d.descripcion || '—'}</td>
                        <td>{d.status_contratista || '—'}</td>
                        <td>
                          <span className={`pill ${rol === 'Inicio' ? 'pill-info' : rol === 'Cierre' ? 'pill-ok' : 'pill-soft'}`}>{rol}</span>
                        </td>
                        <td>
                          {onedriveBaseUrl && d.n_contrato
                            ? <FolderLink doc={d} label="Abrir carpeta de la remisión" icon="📁" folderUrl={folderUrl} />
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
