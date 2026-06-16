import { useMemo, useState } from 'react';
import { CLAIM_STATUS_COLORS } from '../lib/claimOptions';
import { CLAIM_LINE_FIELDS } from '../lib/claimLineFields';

// Compact "Campo 1: x · Campo 2: y" summary of a document's claim_data.
function lineSummary(d) {
  const data = d.claim_data || {};
  return CLAIM_LINE_FIELDS
    .filter((f) => data[f.key] != null && data[f.key] !== '')
    .map((f) => `${f.label}: ${data[f.key]}`)
    .join(' · ');
}

const docLabel = (d) => d.documento_nro || d.descripcion || d.transmittal || `#${d.id}`;

// Claims dock shown beside the documents register. Each claim is a drop target:
// drag a table row here to link it (sets claim_id). A Cerrado claim rejects new
// documents. Expand a claim to see/detach its documents.
export default function ClaimDropPanel({ documents, claims, onAssign, onUnassign, busy }) {
  const [over, setOver] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [msg, setMsg] = useState('');

  const isClosed = (c) => String(c.status || '').trim().toUpperCase() === 'CERRADO';

  const docsByClaim = useMemo(() => {
    const m = new Map();
    for (const d of documents) {
      if (d.claim_id != null) {
        if (!m.has(d.claim_id)) m.set(d.claim_id, []);
        m.get(d.claim_id).push(d);
      }
    }
    return m;
  }, [documents]);

  const handleDrop = (e, claim) => {
    e.preventDefault();
    setOver(null);
    const id = Number(e.dataTransfer.getData('text/plain'));
    if (!id) return;
    const doc = documents.find((d) => d.id === id);
    if (!doc || doc.claim_id === claim.id) return;
    if (isClosed(claim)) {
      setMsg(`"${claim.code || claim.title}" está cerrado y no acepta más documentos.`);
      return;
    }
    setMsg('');
    onAssign(id, claim.id);
  };

  return (
    <aside className="claims-dock">
      <div className="claim-board-head">
        <span className="section-title">Claims ({claims.length})</span>
      </div>
      <p className="import-help">Arrastra una fila de la tabla y suéltala sobre un claim.</p>
      {msg && <div className="form-error">{msg}</div>}
      <div className="drop-list">
        {claims.length === 0 && <div className="empty-state"><p>Sin claims</p></div>}
        {claims.map((c) => {
          const linked = docsByClaim.get(c.id) || [];
          const isOpen = !!expanded[c.id];
          const closed = isClosed(c);
          return (
            <div
              key={c.id}
              className={`claim-drop-card ${over === c.id ? 'drag-over' : ''} ${closed ? 'claim-closed' : ''}`}
              onDragOver={(e) => { if (!closed) { e.preventDefault(); setOver(c.id); } }}
              onDragLeave={() => setOver((id) => (id === c.id ? null : id))}
              onDrop={(e) => handleDrop(e, c)}
            >
              <div className="claim-drop-head" onClick={() => setExpanded((s) => ({ ...s, [c.id]: !s[c.id] }))}>
                <span className="claim-drop-title">
                  <span className="caret">{isOpen ? '▾' : '▸'}</span>
                  {c.code ? `${c.code} — ` : ''}{c.title}
                </span>
                <span className="claim-drop-tags">
                  <span className="badge" style={{ backgroundColor: CLAIM_STATUS_COLORS[c.status] || '#6b7280' }}>
                    {c.status}
                  </span>
                  <span className="count-pill">{linked.length} doc</span>
                </span>
              </div>
              {isOpen && (
                <div className="claim-drop-docs">
                  {linked.length === 0
                    ? <div className="claim-drop-empty">Arrastra documentos aquí</div>
                    : linked.map((d) => (
                        <div key={d.id} className="claim-doc-row">
                          <span className="claim-doc-label">
                            {docLabel(d)}
                            {lineSummary(d) && <span className="claim-doc-note">— {lineSummary(d)}</span>}
                          </span>
                          <button className="chip-x" disabled={busy} onClick={() => onUnassign(d.id)}>✕</button>
                        </div>
                      ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
