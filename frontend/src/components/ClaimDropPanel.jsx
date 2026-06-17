import { useMemo, useState } from 'react';
import { CLAIM_STATUS_COLORS, CLAIM_TYPES } from '../lib/claimOptions';
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
export default function ClaimDropPanel({ documents, claims, onAssign, onUnassign, onCreateClaim, defaultContract = '', selectedClaimIds = [], onSelectClaim, viewMode = 'highlight', onViewMode, relatedCount = 0, unrelatedCount = 0, busy }) {
  const [over, setOver] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [msg, setMsg] = useState('');
  const [creating, setCreating] = useState(false);
  const [newClaim, setNewClaim] = useState({ title: '', type: 'Otro' });
  const [saving, setSaving] = useState(false);

  const isClosed = (c) => String(c.status || '').trim().toUpperCase() === 'CERRADO';

  const submitNewClaim = async (e) => {
    e.preventDefault();
    if (!newClaim.title.trim() || !onCreateClaim) return;
    setSaving(true); setMsg('');
    try {
      await onCreateClaim({ title: newClaim.title.trim(), type: newClaim.type, n_contrato: defaultContract || null });
      setNewClaim({ title: '', type: 'Otro' });
      setCreating(false);
    } catch (err) { setMsg(err.message); }
    finally { setSaving(false); }
  };

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
        {onCreateClaim && (
          <button className="btn btn-small btn-primary" onClick={() => setCreating((v) => !v)}>
            {creating ? '✕' : '+ Caso'}
          </button>
        )}
      </div>

      {creating && (
        <form className="claim-create" onSubmit={submitNewClaim}>
          <input
            className="note-input"
            autoFocus
            placeholder="Título del caso/claim…"
            value={newClaim.title}
            onChange={(e) => setNewClaim((s) => ({ ...s, title: e.target.value }))}
          />
          <select
            className="note-input"
            value={newClaim.type}
            onChange={(e) => setNewClaim((s) => ({ ...s, type: e.target.value }))}
          >
            {CLAIM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="claim-create-meta">
            Contrato: <strong>{defaultContract || '— (sin filtrar)'}</strong>
          </div>
          <button className="btn btn-small btn-primary" type="submit" disabled={saving || !newClaim.title.trim()}>
            {saving ? 'Creando…' : 'Crear caso'}
          </button>
        </form>
      )}

      {onViewMode && (
        <div className="claim-view-modes">
          <button
            className={viewMode === 'highlight' ? 'active' : ''}
            onClick={() => onViewMode('highlight')}
            title="Mostrar todos los documentos"
          >
            Todos
          </button>
          <button
            className={viewMode === 'related' ? 'active' : ''}
            onClick={() => onViewMode('related')}
            title="Mostrar solo documentos ya vinculados a un claim"
          >
            Relacionados ({relatedCount})
          </button>
          <button
            className={viewMode === 'unrelated' ? 'active' : ''}
            onClick={() => onViewMode('unrelated')}
            title="Mostrar solo documentos sin claim"
          >
            No relacionados ({unrelatedCount})
          </button>
        </div>
      )}

      <p className="import-help">
        Arrastra una fila sobre un claim para vincular.
        {viewMode === 'highlight' && ' Clic en uno o varios claims para resaltar sus documentos.'}
        {viewMode === 'related' && (selectedClaimIds.length
          ? ` Mostrando documentos de ${selectedClaimIds.length} caso(s). Clic en un caso para agregar/quitar.`
          : ' Clic en uno o varios claims para enfocar solo sus documentos.')}
        {viewMode === 'unrelated' && ' Vista: solo documentos sin claim.'}
      </p>
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
              className={`claim-drop-card ${over === c.id ? 'drag-over' : ''} ${closed ? 'claim-closed' : ''} ${selectedClaimIds.includes(c.id) ? 'claim-selected' : ''}`}
              onDragOver={(e) => { if (!closed) { e.preventDefault(); setOver(c.id); } }}
              onDragLeave={() => setOver((id) => (id === c.id ? null : id))}
              onDrop={(e) => handleDrop(e, c)}
            >
              <div
                className="claim-drop-head"
                onClick={() => { onSelectClaim?.(c.id); setExpanded((s) => ({ ...s, [c.id]: !s[c.id] })); }}
              >
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
