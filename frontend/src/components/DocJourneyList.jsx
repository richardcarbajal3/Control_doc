import { useState, useEffect, useRef } from 'react';
import { groupDocJourneys, revEstadoText } from '../lib/docJourney';
import { buildOnedriveUrl } from '../lib/onedriveUrl';

const fmt = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
};

const KIND_CLS = { ok: 'pill-ok', warn: 'pill-warn', info: 'pill-info', danger: 'pill-danger', soft: 'pill-soft' };
const pill = (text, kind, title) =>
  <span className={`pill ${KIND_CLS[kind] || 'pill-info'}`} title={title}>{text}</span>;

// Resizable columns (the leading toggle column is fixed). Widths persist in
// localStorage so the layout the user sets sticks across sessions.
const COLUMNS = [
  { key: 'documento', label: 'DOCUMENTO', width: 180 },
  { key: 'descripcion', label: 'DESCRIPCIÓN', width: 280 },
  { key: 'clave', label: 'REV. / SEGUIM.', width: 110 },
  { key: 'fecha', label: 'ÚLTIMA FECHA', width: 120 },
  { key: 'estado', label: 'ESTADO', width: 132 },
  { key: 'lineas', label: 'LÍNEAS', width: 72 },
  { key: 'carpetas', label: 'CARPETAS', width: 96 },
];
const TOGGLE_W = 28;
const MIN_W = 48;
const LS_KEY = 'docJourney.colWidths';

const defaultWidths = () => Object.fromEntries(COLUMNS.map((c) => [c.key, c.width]));

// One unified "recorrido" per root document. Each journey is either ESTADO mode
// (RFI/RNC: recibido → atendido) or REVISIÓN mode (highest revision governs).
export default function DocJourneyList({ documents, onRowClick, onedriveBaseUrl }) {
  const journeys = groupDocJourneys(documents);
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
        <p>No se encontraron documentos con seguimiento</p>
      </div>
    );
  }

  const toggle = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

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

function ModeTag({ mode }) {
  return mode === 'estado'
    ? <span className="pill pill-soft journey-mode-tag" title="Seguimiento por estado (RFI/RNC)">estado</span>
    : <span className="pill pill-soft journey-mode-tag" title="Seguimiento por revisión">revisión</span>;
}

function FragmentRow({ journey: j, isOpen, onToggle, onRowClick, onedriveBaseUrl, folderUrl, totalCols }) {
  return (
    <>
      <tr className="rfi-journey-row" onClick={() => onRowClick?.(j.docControla)}>
        <td className="rfi-journey-toggle">
          <button
            className="rfi-expand-btn"
            title={isOpen ? 'Ocultar líneas' : 'Ver líneas'}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
          >
            {isOpen ? '▾' : '▸'}
          </button>
        </td>
        <td className="code-cell" title={j.root}>
          {j.root || '—'} <ModeTag mode={j.mode} />
        </td>
        <td className="cell-ellipsis" title={j.descripcion}>{j.descripcion || '—'}</td>
        <td>
          <span className={`journey-leg ${j.mode === 'revision' ? 'journey-leg-out' : 'journey-leg-in'}`}>{j.clave}</span>
        </td>
        <td>{fmt(j.fechaControla)}</td>
        <td>{pill(j.estadoText, j.estadoKind, j.estadoTitle)}</td>
        <td className="rfi-journey-count">
          <span className="pill pill-soft">{j.lineas}</span>
        </td>
        <td className="rfi-journey-folders">
          {onedriveBaseUrl && j.n_contrato
            ? <FolderLink doc={j.docControla} label="Carpeta de la línea que manda" icon="📁" folderUrl={folderUrl} />
            : '—'}
        </td>
      </tr>
      {isOpen && (
        <tr className="rfi-journey-detail-row">
          <td colSpan={totalCols}>
            <div className="rfi-journey-detail">
              {j.mode === 'estado'
                ? <EstadoDetail journey={j} onRowClick={onRowClick} onedriveBaseUrl={onedriveBaseUrl} folderUrl={folderUrl} />
                : <RevisionDetail journey={j} onRowClick={onRowClick} onedriveBaseUrl={onedriveBaseUrl} folderUrl={folderUrl} />}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ESTADO mode detail: RFI/RNC timeline recibido → enviado / atendido.
function EstadoDetail({ journey: j, onRowClick, onedriveBaseUrl, folderUrl }) {
  return (
    <>
      <div className="rfi-flow">
        <span className={`rfi-step ${j.inicio ? 'rfi-step-done' : 'rfi-step-pending'}`}>Recibido (inicio)</span>
        <span className="rfi-arrow">→</span>
        <span className={`rfi-step ${j.cierre ? 'rfi-step-done' : 'rfi-step-pending'}`}>Enviado / atendido (cierre)</span>
      </div>
      <table className="rfi-journey-subtable">
        <thead>
          <tr>
            <th>FECHA</th><th># TRANSMITTAL</th><th>TIPO FLUJO</th><th>ESTADO TRANSMITTAL</th>
            <th>DESCRIPCIÓN</th><th>ESTATUS DE DOCUMENTO</th><th>ROL</th><th>CARPETA</th>
          </tr>
        </thead>
        <tbody>
          {j.docs.map((d) => {
            const rol = d === j.inicio ? 'Inicio' : d === j.cierre ? 'Cierre' : 'Remisión';
            return (
              <tr key={d.id} className={onRowClick ? 'doc-row-clickable' : ''} onClick={() => onRowClick?.(d)}>
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
    </>
  );
}

// REVISIÓN mode detail: one line per revision; the highest revision governs.
function RevisionDetail({ journey: j, onRowClick, onedriveBaseUrl, folderUrl }) {
  return (
    <>
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
              <tr key={d.id} className={onRowClick ? 'doc-row-clickable' : ''} onClick={() => onRowClick?.(d)}>
                <td className="code-cell">{d.rev || '—'}</td>
                <td>{fmt(d.fecha)}</td>
                <td>{d.status_contratista || revEstadoText(d)}</td>
                <td title={d.descripcion}>{d.descripcion || '—'}</td>
                <td className="transmittal-cell">{d.transmittal || '—'}</td>
                <td>
                  <span className={`pill ${manda ? 'pill-ok' : 'pill-soft'}`}>{manda ? 'Manda' : 'Histórico'}</span>
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
    </>
  );
}
