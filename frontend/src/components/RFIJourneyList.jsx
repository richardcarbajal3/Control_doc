import { useState } from 'react';
import { groupRfiJourneys } from '../lib/rfiJourney';

const fmt = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
};

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
export default function RFIJourneyList({ documents, onRowClick }) {
  const journeys = groupRfiJourneys(documents);
  const [expanded, setExpanded] = useState(() => new Set());

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

  return (
    <div className="doc-table-scroll">
      <table className="doc-table rfi-journey-table">
        <colgroup>
          <col style={{ width: '28px' }} />
          <col style={{ width: '90px' }} />
          <col style={{ width: '150px' }} />
          <col />
          <col style={{ width: '120px' }} />
          <col style={{ width: '120px' }} />
          <col style={{ width: '92px' }} />
          <col style={{ width: '56px' }} />
          <col style={{ width: '90px' }} />
        </colgroup>
        <thead>
          <tr>
            <th />
            <th title="Número de RFI">RFI</th>
            <th title="Documento raíz (mismo en cada remisión)">DOCUMENTO</th>
            <th>DESCRIPCIÓN</th>
            <th title="Recibido — apertura del RFI">INICIO (RECIBIDO)</th>
            <th title="Enviado — cierre / atención">CIERRE (ENVIADO)</th>
            <th title="Estado del recorrido">ESTADO</th>
            <th title="Días entre inicio y cierre">DÍAS</th>
            <th title="Remisiones del mismo documento">REMISIONES</th>
          </tr>
        </thead>
        <tbody>
          {journeys.map((j) => {
            const isOpen = expanded.has(j.key);
            return (
              <FragmentRow
                key={j.key}
                journey={j}
                isOpen={isOpen}
                onToggle={() => toggle(j.key)}
                onRowClick={onRowClick}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow({ journey: j, isOpen, onToggle, onRowClick }) {
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
        <td className="code-cell">{j.rfiNumber ? `RFI ${j.rfiNumber}` : '—'}</td>
        <td className="code-cell" title={j.root}>{j.root || '—'}</td>
        <td title={j.descripcion}>{j.descripcion || '—'}</td>
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
      </tr>
      {isOpen && (
        <tr className="rfi-journey-detail-row">
          <td colSpan={9}>
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
                    <th>DESCRIPCIÓN</th><th>ESTATUS DE DOCUMENTO</th><th>ROL</th>
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
