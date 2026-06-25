import { useState, useEffect, useRef } from 'react';
import { groupPlanoJourneys, planoRevEstado } from '../lib/planosJourney';
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
  { key: 'rev', label: 'REV. QUE MANDA', width: 120 },
  { key: 'fecha', label: 'FECHA REV.', width: 128 },
  { key: 'estado', label: 'ESTADO', width: 128 },
  { key: 'revisiones', label: 'REVISIONES', width: 96 },
  { key: 'carpetas', label: 'CARPETAS', width: 96 },
];
const TOGGLE_W = 28;
const MIN_W = 48;
const LS_KEY = 'planosJourney.colWidths';

const defaultWidths = () => Object.fromEntries(COLUMNS.map((c) => [c.key, c.width]));

// Pill for a whole journey (driven by the governing — highest — revision).
function estadoPill(estado) {
  switch (estado) {
    case 'aprobado':
      return <span className="pill pill-ok" title="Última revisión aprobada (cerrado)">Aprobado</span>;
    case 'observaciones':
      return <span className="pill pill-warn" title="Aprobado con comentarios">Con comentarios</span>;
    case 'anulado':
      return <span className="pill pill-soft" title="Revisión anulada">Anulado</span>;
    default:
      return <span className="pill pill-info" title="Pendiente de aprobación">Pendiente</span>;
  }
}

// Collapses every revision of a document/procedure into one journey per base
// (documento_nro). The governing revision is the highest one (letters A<B<…
// then numbers 0<1<…); its approval state drives the journey status.
export default function PlanosJourneyList({ documents, onRowClick, onedriveBaseUrl }) {
  const journeys = groupPlanoJourneys(documents);
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
        <p>No se encontraron planos ni procedimientos</p>
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

// Per-revision pill (used inside the expanded detail).
function revEstadoPill(doc) {
  return estadoPill(planoRevEstado(doc));
}

function FragmentRow({ journey: j, isOpen, onToggle, onRowClick, onedriveBaseUrl, folderUrl, totalCols }) {
  return (
    <>
      <tr className="rfi-journey-row" onClick={() => onRowClick?.(j.controla)}>
        <td className="rfi-journey-toggle">
          <button
            className="rfi-expand-btn"
            title={isOpen ? 'Ocultar revisiones' : 'Ver revisiones'}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
          >
            {isOpen ? '▾' : '▸'}
          </button>
        </td>
        <td className="code-cell" title={j.root}>{j.root || '—'}</td>
        <td className="cell-ellipsis" title={j.descripcion}>{j.descripcion || '—'}</td>
        <td>
          <span className="journey-leg journey-leg-out">{j.controla?.rev || '—'}</span>
        </td>
        <td>{fmt(j.controla?.fecha)}</td>
        <td>{estadoPill(j.estado)}</td>
        <td className="rfi-journey-count">
          <span className="pill pill-soft">{j.revisiones}</span>
        </td>
        <td className="rfi-journey-folders">
          {onedriveBaseUrl && j.n_contrato
            ? <FolderLink doc={j.controla} label="Carpeta de la revisión que manda" icon="📁" folderUrl={folderUrl} />
            : '—'}
        </td>
      </tr>
      {isOpen && (
        <tr className="rfi-journey-detail-row">
          <td colSpan={totalCols}>
            <div className="rfi-journey-detail">
              <div className="rfi-flow">
                <span className="rfi-step rfi-step-pending">Primera rev. {j.primera?.rev || '—'}</span>
                <span className="rfi-arrow">→</span>
                <span className="rfi-step rfi-step-done">Rev. que manda {j.controla?.rev || '—'}</span>
              </div>
              <table className="rfi-journey-subtable">
                <thead>
                  <tr>
                    <th>REV.</th><th>FECHA</th><th>ESTATUS DE DOCUMENTO</th>
                    <th>DESCRIPCIÓN</th><th># TRANSMITTAL</th><th>ROL</th><th>CARPETA</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Revisiones de mayor → menor: la que manda primero. */}
                  {[...j.docs].reverse().map((d) => {
                    const manda = d === j.controla;
                    return (
                      <tr
                        key={d.id}
                        className={onRowClick ? 'doc-row-clickable' : ''}
                        onClick={() => onRowClick?.(d)}
                      >
                        <td className="code-cell">{d.rev || '—'}</td>
                        <td>{fmt(d.fecha)}</td>
                        <td>{revEstadoPill(d)}</td>
                        <td title={d.descripcion}>{d.descripcion || '—'}</td>
                        <td className="transmittal-cell">{d.transmittal || '—'}</td>
                        <td>
                          <span className={`pill ${manda ? 'pill-ok' : 'pill-soft'}`}>
                            {manda ? 'Manda' : 'Histórico'}
                          </span>
                        </td>
                        <td>
                          {onedriveBaseUrl && d.n_contrato
                            ? <FolderLink doc={d} label="Abrir carpeta de la revisión" icon="📁" folderUrl={folderUrl} />
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
