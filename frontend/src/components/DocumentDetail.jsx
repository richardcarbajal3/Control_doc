import { CLAIM_LINE_FIELDS } from '../lib/claimLineFields';

const fmt = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' });
};

// Read-only "ficha del transmittal": the transmittal header data plus every
// document that shares the same transmittal number, with each document's status.
export default function DocumentDetail({ doc, allDocuments = [], claims = [], onClose }) {
  const sameTransmittal = doc.transmittal
    ? allDocuments.filter((d) => d.transmittal === doc.transmittal)
    : [doc];
  const docsInTransmittal = sameTransmittal.length ? sameTransmittal : [doc];

  const claimIds = Array.isArray(doc.claim_ids) ? doc.claim_ids : (doc.claim_id != null ? [doc.claim_id] : []);
  const linkedClaims = claimIds.map((id) => claims.find((c) => c.id === id)).filter(Boolean);
  const cData = doc.claim_data || {};

  const field = (label, value) => (
    <div className="ficha-field">
      <span className="ficha-label">{label}</span>
      <span className="ficha-value">{value || '—'}</span>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>Transmittal {doc.transmittal || doc.documento_nro || `#${doc.id}`}</h2>

        <div className="ficha-grid">
          {field('# Transmittal', doc.transmittal)}
          {field('Fecha', fmt(doc.fecha))}
          <div className="ficha-field">
            <span className="ficha-label">Estado (transmittal)</span>
            <span className="ficha-value">
              {doc.is_pending
                ? <span className="pill pill-warn">PENDIENTE{doc.dias_atraso > 0 ? ` · ${doc.dias_atraso} d` : ''}</span>
                : <span className="pill pill-ok">{doc.status_g || 'ATENDIDO'}</span>}
            </span>
          </div>
          {field('Envío (STATUS)', doc.status)}
          {field('N° Contrato', doc.n_contrato)}
          {field('Empresa', doc.empresa)}
          {field('Contrato', doc.contrato)}
          {field('Referencia', doc.referencia)}
          {field('Responsable', doc.responsable)}
        </div>

        {doc.descripcion_contrato && (
          <p className="ficha-desc"><strong>Descripción contrato:</strong> {doc.descripcion_contrato}</p>
        )}

        <h3 className="section-title">Documentos del transmittal ({docsInTransmittal.length})</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>DOCUMENTO NRO</th><th>REV</th><th>DESCRIPCIÓN</th>
                <th>TIPO</th><th>STATUS DE CONTRATISTA</th>
              </tr>
            </thead>
            <tbody>
              {docsInTransmittal.map((d) => (
                <tr key={d.id} className={d.id === doc.id ? 'doc-row-highlight' : ''}>
                  <td className="code-cell">{d.documento_nro || '—'}</td>
                  <td>{d.rev || '—'}</td>
                  <td>{d.descripcion || '—'}</td>
                  <td>{d.tipo_doc || '—'}</td>
                  <td>{d.status_contratista || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {linkedClaims.length > 0 && (
          <>
            <h3 className="section-title">Claims / casos vinculados ({linkedClaims.length})</h3>
            <p className="ficha-desc">
              {linkedClaims.map((c) => (
                <span key={c.id} className="pill pill-ok" style={{ marginRight: '0.4rem' }}>
                  {c.code ? `${c.code} — ` : ''}{c.title}{c.status ? ` · ${c.status}` : ''}
                </span>
              ))}
            </p>
            {CLAIM_LINE_FIELDS.some((f) => cData[f.key]) && (
              <div className="ficha-grid">
                {CLAIM_LINE_FIELDS.map((f) => cData[f.key] ? field(f.label, cData[f.key]) : null)}
              </div>
            )}
          </>
        )}

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
