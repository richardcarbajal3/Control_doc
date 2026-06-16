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

// Side-by-side board to link documents to claims by dragging. Left pane lists
// documents (draggable); right pane lists claims as drop targets. Dropping a
// document on a claim sets its claim_id; each claim can be expanded to see and
// detach its documents. Claim status (incl. "Cerrado") is shown as a badge.
export default function ClaimLinkBoard({ documents, claims, onAssign, onUnassign, busy }) {
  const [dragId, setDragId] = useState(null);
  const [overClaim, setOverClaim] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [filter, setFilter] = useState('all'); // all | unlinked
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

  const leftDocs = filter === 'unlinked' ? documents.filter((d) => d.claim_id == null) : documents;

  const handleDrop = (claim) => {
    setOverClaim(null);
    if (dragId == null) return;
    const doc = documents.find((d) => d.id === dragId);
    setDragId(null);
    if (!doc || doc.claim_id === claim.id) return;
    if (isClosed(claim)) {
      setMsg(`"${claim.code || claim.title}" está cerrado y no acepta más documentos.`);
      return;
    }
    setMsg('');
    onAssign(doc.id, claim.id);
  };

  const label = (d) => d.documento_nro || d.descripcion || d.transmittal || `#${d.id}`;

  return (
    <div className="claim-board">
      <div className="claim-board-pane">
        <div className="claim-board-head">
          <span className="section-title">Documentos ({leftDocs.length})</span>
          <select className="mini-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="unlinked">Sin claim</option>
          </select>
        </div>
        <p className="import-help">Arrastra un documento hacia un claim de la derecha →</p>
        <div className="drag-list">
          {leftDocs.length === 0 && <div className="empty-state"><p>Sin documentos</p></div>}
          {leftDocs.map((d) => {
            const claim = claims.find((c) => c.id === d.claim_id);
            return (
              <div
                key={d.id}
                className={`doc-drag-card ${dragId === d.id ? 'dragging' : ''}`}
                draggable
                onDragStart={() => setDragId(d.id)}
                onDragEnd={() => setDragId(null)}
              >
                <div className="doc-drag-main">
                  <span className="doc-drag-code">{label(d)}</span>
                  {d.descripcion && <span className="doc-drag-desc">{d.descripcion.slice(0, 60)}</span>}
                </div>
                <div className="doc-drag-meta">
                  {d.is_pending
                    ? <span className="pill pill-warn">{d.status_g || 'PENDIENTE'}</span>
                    : <span className="pill pill-ok">{d.status_g || 'ATENDIDO'}</span>}
                  {claim && (
                    <span className="doc-linked">
                      🔗 {claim.code || claim.title?.slice(0, 18)}
                      <button className="chip-x" disabled={busy} title="Quitar del claim"
                        onClick={() => onUnassign(d.id)}>✕</button>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="claim-board-pane">
        <div className="claim-board-head">
          <span className="section-title">Claims ({claims.length})</span>
        </div>
        <p className="import-help">Suelta aquí para vincular. Haz clic en un claim para ver sus documentos.</p>
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
                className={`claim-drop-card ${overClaim === c.id ? 'drag-over' : ''} ${closed ? 'claim-closed' : ''}`}
                onDragOver={(e) => { if (!closed) { e.preventDefault(); setOverClaim(c.id); } }}
                onDragLeave={() => setOverClaim((id) => (id === c.id ? null : id))}
                onDrop={() => handleDrop(c)}
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
                              {label(d)}
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
      </div>
    </div>
  );
}
