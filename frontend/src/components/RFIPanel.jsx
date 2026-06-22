import { useState } from 'react';
import { updateDocument } from '../api/documents';
import { createClaimFromRfi } from '../api/claims';

const fmt = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
};

function rfiStatus(doc) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const vence = doc.fecha_vencimiento ? new Date(doc.fecha_vencimiento) : null;
  const respondido = doc.fecha_respuesta ? new Date(doc.fecha_respuesta) : null;

  if (respondido) {
    if (vence && respondido > vence) return { label: 'Respondido con retraso', cls: 'pill-warn', late: true };
    return { label: 'Respondido', cls: 'pill-ok', late: false };
  }
  if (vence && hoy > vence) return { label: 'Vencido sin respuesta', cls: 'pill-danger', late: true };
  if (vence) {
    const diff = Math.ceil((vence - hoy) / 86400000);
    if (diff <= 3) return { label: `Vence en ${diff}d`, cls: 'pill-warn', late: false };
  }
  return { label: 'Pendiente', cls: 'pill-info', late: false };
}

export default function RFIPanel({ doc, allDocuments = [], onClose, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({
    pregunta: doc.pregunta || '',
    fecha_vencimiento: doc.fecha_vencimiento ? doc.fecha_vencimiento.slice(0, 10) : '',
    fecha_respuesta: doc.fecha_respuesta ? doc.fecha_respuesta.slice(0, 10) : '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);

  const status = rfiStatus({ ...doc, ...fields });

  // Transmittal siblings = related documents
  const siblings = doc.transmittal
    ? allDocuments.filter((d) => d.transmittal === doc.transmittal && d.id !== doc.id)
    : [];
  // Parent document (the one this RFI answers or references)
  const parent = doc.parent_id ? allDocuments.find((d) => d.id === doc.parent_id) : null;

  const save = async () => {
    setBusy(true); setError('');
    try {
      await updateDocument(doc.id, {
        pregunta: fields.pregunta || null,
        fecha_vencimiento: fields.fecha_vencimiento || null,
        fecha_respuesta: fields.fecha_respuesta || null,
      });
      setEditing(false);
      onChanged?.();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const createClaim = async () => {
    if (!window.confirm('¿Crear un Claim pre-cargado desde este RFI?')) return;
    setClaimBusy(true); setError('');
    try {
      const claim = await createClaimFromRfi(doc.id);
      onChanged?.();
      onClose?.();
      alert(`Claim creado: ${claim.code || ''} ${claim.title}\nId: ${claim.id}\nVe a la pestaña Claims para verlo.`);
    } catch (e) { setError(e.message); }
    finally { setClaimBusy(false); }
  };

  const field = (label, value) => (
    <div className="ficha-field">
      <span className="ficha-label">{label}</span>
      <span className="ficha-value">{value || '—'}</span>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>{doc.documento_nro || `RFI #${doc.id}`}</h2>
        <p className="import-help">
          RFI · Contrato {doc.n_contrato || '—'} · {doc.empresa || ''}
        </p>

        {error && <div className="form-error">{error}</div>}

        {/* Status badge */}
        <div style={{ marginBottom: '1rem' }}>
          <span className={`pill ${status.cls}`}>{status.label}</span>
        </div>

        {/* Question + dates */}
        {editing ? (
          <div className="form-section">
            <div className="form-group">
              <label>Pregunta / consulta</label>
              <textarea
                rows={4}
                className="search-input"
                style={{ width: '100%', resize: 'vertical' }}
                value={fields.pregunta}
                onChange={(e) => setFields((s) => ({ ...s, pregunta: e.target.value }))}
              />
            </div>
            <div className="ficha-grid">
              <div className="form-group">
                <label>Fecha de emisión</label>
                <span className="ficha-value">{fmt(doc.fecha) || '—'}</span>
              </div>
              <div className="form-group">
                <label>Fecha vencimiento</label>
                <input type="date" className="search-input" value={fields.fecha_vencimiento}
                  onChange={(e) => setFields((s) => ({ ...s, fecha_vencimiento: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Fecha respuesta</label>
                <input type="date" className="search-input" value={fields.fecha_respuesta}
                  onChange={(e) => setFields((s) => ({ ...s, fecha_respuesta: e.target.value }))} />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: '0.5rem' }}>
              <button className="btn btn-primary" disabled={busy} onClick={save}>Guardar</button>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="ficha-grid">
            <div className="ficha-field" style={{ gridColumn: '1 / -1' }}>
              <span className="ficha-label">Pregunta / consulta</span>
              <span className="ficha-value" style={{ whiteSpace: 'pre-wrap' }}>
                {doc.pregunta || fields.pregunta || '—'}
              </span>
            </div>
            {field('Emitido', fmt(doc.fecha))}
            {field('Vence', fmt(fields.fecha_vencimiento || doc.fecha_vencimiento))}
            {field('Respondido', fmt(fields.fecha_respuesta || doc.fecha_respuesta))}
            {field('Transmittal', doc.transmittal)}
            {field('Tipo', doc.tipo_doc)}
            {field('Responsable', doc.responsable)}
          </div>
        )}

        {/* Flow diagram */}
        <div className="rfi-flow">
          <span className={`rfi-step ${doc.fecha ? 'rfi-step-done' : 'rfi-step-pending'}`}>RFI emitido</span>
          <span className="rfi-arrow">→</span>
          <span className={`rfi-step ${fields.fecha_respuesta || doc.fecha_respuesta ? 'rfi-step-done' : (status.late ? 'rfi-step-late' : 'rfi-step-pending')}`}>
            Respuesta recibida
          </span>
          <span className="rfi-arrow">→</span>
          <span className={`rfi-step ${fields.fecha_respuesta || doc.fecha_respuesta ? 'rfi-step-done' : 'rfi-step-pending'}`}>
            Cierre
          </span>
        </div>

        {/* Related documents */}
        {(parent || siblings.length > 0) && (
          <>
            <h3 className="section-title">Documentos relacionados</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>DOCUMENTO NRO</th><th>DESCRIPCIÓN</th><th>TIPO</th><th>FECHA</th><th>REL.</th></tr>
                </thead>
                <tbody>
                  {parent && (
                    <tr>
                      <td className="code-cell">{parent.documento_nro || `#${parent.id}`}</td>
                      <td>{parent.descripcion || '—'}</td>
                      <td>{parent.tipo_doc || '—'}</td>
                      <td>{fmt(parent.fecha)}</td>
                      <td><span className="pill pill-info">Origen</span></td>
                    </tr>
                  )}
                  {siblings.map((d) => (
                    <tr key={d.id}>
                      <td className="code-cell">{d.documento_nro || `#${d.id}`}</td>
                      <td>{d.descripcion || '—'}</td>
                      <td>{d.tipo_doc || '—'}</td>
                      <td>{fmt(d.fecha)}</td>
                      <td><span className="pill pill-ok">Transmittal</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="form-actions" style={{ marginTop: '1.5rem' }}>
          {!editing && (
            <button className="btn btn-secondary" onClick={() => setEditing(true)}>Editar RFI</button>
          )}
          {status.late && (
            <button className="btn btn-primary" disabled={claimBusy} onClick={createClaim}>
              {claimBusy ? 'Creando…' : '⚖ Crear Claim desde RFI'}
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
