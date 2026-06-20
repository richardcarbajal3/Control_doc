// Visual timeline of documents within a claim, ordered by fecha.
const fmt = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
};

const TYPE_ICONS = {
  'Carta': '✉',
  'RFI': '❓',
  'Minuta': '📋',
  'OC': '💰',
  'Transmittal': '📁',
  'Informe': '📄',
};

const PENDING_UPPER = (s) => (s || '').toUpperCase().trim() !== 'ATENDIDO';

export default function ClaimTimeline({ documents = [] }) {
  const sorted = [...documents].sort((a, b) => {
    const da = a.fecha ? new Date(a.fecha) : new Date(0);
    const db = b.fecha ? new Date(b.fecha) : new Date(0);
    return da - db;
  });

  if (!sorted.length) {
    return <div className="empty-state"><p>Sin documentos en la cronología</p></div>;
  }

  return (
    <div className="claim-timeline">
      {sorted.map((doc, i) => {
        const pending = PENDING_UPPER(doc.status_g);
        return (
          <div key={doc.id} className={`timeline-item ${i === sorted.length - 1 ? 'timeline-last' : ''}`}>
            <div className="timeline-dot" />
            <div className="timeline-content">
              <div className="timeline-date">{fmt(doc.fecha)}</div>
              <div className="timeline-title">
                <span className="timeline-icon">{TYPE_ICONS[doc.tipo_doc] || '📄'}</span>
                <span className="code-cell">{doc.documento_nro || `#${doc.id}`}</span>
                {doc.tipo_doc && <span className="pill pill-info" style={{ marginLeft: '0.4rem', fontSize: '0.7rem' }}>{doc.tipo_doc}</span>}
              </div>
              {doc.descripcion && (
                <div className="timeline-desc">{doc.descripcion}</div>
              )}
              {doc.claim_note && (
                <div className="timeline-note">{doc.claim_note}</div>
              )}
              <div className="timeline-status">
                {pending
                  ? <span className="pill pill-warn">{doc.status_g || 'PENDIENTE'}{doc.dias_atraso > 0 ? ` · ${doc.dias_atraso}d` : ''}</span>
                  : <span className="pill pill-ok">{doc.status_g || 'ATENDIDO'}</span>
                }
                {doc.responsable && <span className="timeline-resp">{doc.responsable}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
