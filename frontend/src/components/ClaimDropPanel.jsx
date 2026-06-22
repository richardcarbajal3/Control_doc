import { useEffect, useMemo, useRef, useState } from 'react';
import { CLAIM_STATUS_COLORS, CLAIM_TYPES } from '../lib/claimOptions';
import { CLAIM_LINE_FIELDS } from '../lib/claimLineFields';

const OC_STATUS_COLORS = {
  'Borrador': '#94a3b8',
  'En negociación': '#f59e0b',
  'Aprobada': '#22c55e',
  'Rechazada': '#ef4444',
};

const POS_KEY = 'claimDock.pos';
const SIZE_KEY = 'claimDock.size';
const HELP_KEY = 'claimDock.help';

const readStored = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const writeStored = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
};

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
export default function ClaimDropPanel({ documents, claims, changeOrders = [], dockMode = 'claims', onDockMode, onAssign, onUnassign, onCreateClaim, onCreateChangeOrder, defaultContract = '', selectedClaimIds = [], onSelectClaim, viewMode = 'highlight', onViewMode, relatedCount = 0, unrelatedCount = 0, busy, floating = false, onToggleFloat, minimized = false, onToggleMinimize, onOpenDetail }) {
  const [over, setOver] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [msg, setMsg] = useState('');
  const [creating, setCreating] = useState(false);
  const [newClaim, setNewClaim] = useState({ title: '', type: 'Otro' });
  const [newCo, setNewCo] = useState({ title: '', status: 'Borrador' });
  const [saving, setSaving] = useState(false);
  const [pos, setPos] = useState(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const saved = readStored(POS_KEY);
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      // Keep it on-screen in case the viewport shrank since last session.
      return { x: Math.min(saved.x, vw - 60), y: Math.min(saved.y, vh - 40) };
    }
    return { x: Math.max(8, vw - 372), y: 88 };
  });
  const [size, setSize] = useState(() => readStored(SIZE_KEY) || null);
  const [showHelp, setShowHelp] = useState(() => readStored(HELP_KEY) === true);
  const dragging = useRef(false);
  const panelRef = useRef(null);

  useEffect(() => { writeStored(HELP_KEY, showHelp); }, [showHelp]);

  // Persist position whenever it settles.
  useEffect(() => { writeStored(POS_KEY, pos); }, [pos]);

  // Persist size when the user resizes the floating panel (ignore while
  // minimized, since then it collapses to just the title bar).
  useEffect(() => {
    if (!floating || minimized) return;
    const el = panelRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (!el.offsetWidth) return;
      const next = { w: el.offsetWidth, h: el.offsetHeight };
      setSize((prev) => (prev && prev.w === next.w && prev.h === next.h ? prev : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [floating, minimized]);

  useEffect(() => { if (size) writeStored(SIZE_KEY, size); }, [size]);

  const isClosed = (c) => String(c.status || '').trim().toUpperCase() === 'CERRADO';

  // Move the floating panel by dragging its title bar. Uses pointer events
  // (not HTML5 draggable) so it never collides with the row drag-to-link.
  const startDrag = (e) => {
    if (!floating || e.target.closest('.dock-ctl')) return;
    dragging.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...pos };
    const onMove = (ev) => {
      if (!dragging.current) return;
      const maxX = window.innerWidth - 60;
      const maxY = window.innerHeight - 40;
      setPos({
        x: Math.min(maxX, Math.max(0, orig.x + (ev.clientX - startX))),
        y: Math.min(maxY, Math.max(0, orig.y + (ev.clientY - startY))),
      });
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

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

  const submitNewCo = async (e) => {
    e.preventDefault();
    if (!newCo.title.trim() || !onCreateChangeOrder) return;
    setSaving(true); setMsg('');
    try {
      await onCreateChangeOrder({ title: newCo.title.trim(), status: newCo.status, n_contrato: defaultContract || null });
      setNewCo({ title: '', status: 'Borrador' });
      setCreating(false);
    } catch (err) { setMsg(err.message); }
    finally { setSaving(false); }
  };

  const docsByClaim = useMemo(() => {
    const m = new Map();
    for (const d of documents) {
      const ids = Array.isArray(d.claim_ids) ? d.claim_ids : [];
      for (const cid of ids) {
        if (!m.has(cid)) m.set(cid, []);
        m.get(cid).push(d);
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
    if (!doc || (Array.isArray(doc.claim_ids) && doc.claim_ids.includes(claim.id))) return;
    if (isClosed(claim)) {
      setMsg(`"${claim.code || claim.title}" está cerrado y no acepta más documentos.`);
      return;
    }
    setMsg('');
    onAssign(id, claim.id);
  };

  return (
    <aside
      ref={panelRef}
      className={`claims-dock ${floating ? 'claims-dock--floating' : ''} ${minimized ? 'claims-dock--min' : ''}`}
      style={floating ? {
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        ...(size && !minimized ? { width: `${size.w}px`, height: `${size.h}px` } : {}),
      } : undefined}
    >
      <div
        className="claim-dock-bar"
        onPointerDown={startDrag}
        style={floating ? { cursor: 'grab' } : undefined}
      >
        <span className="claim-dock-bar-title">
          {floating && <span className="claim-dock-grip" aria-hidden="true">⠿</span>}
          <span className="dock-mode-switch">
            <button
              className={`dock-mode-btn ${dockMode === 'claims' ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); onDockMode?.('claims'); setCreating(false); setExpanded({}); }}
            >Claims</button>
            <button
              className={`dock-mode-btn ${dockMode === 'change-orders' ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); onDockMode?.('change-orders'); setCreating(false); setExpanded({}); }}
            >OC</button>
          </span>
          <span className="dock-count">({dockMode === 'claims' ? claims.length : changeOrders.length})</span>
        </span>
        <span className="claim-dock-ctls">
          <button
            type="button"
            className={`dock-ctl ${showHelp ? 'dock-ctl-on' : ''}`}
            onClick={() => setShowHelp((v) => !v)}
            title={showHelp ? 'Ocultar ayuda' : 'Mostrar ayuda'}
          >
            ?
          </button>
          {onToggleFloat && (
            <button
              type="button"
              className="dock-ctl"
              onClick={onToggleFloat}
              title={floating ? 'Acoplar a la derecha' : 'Soltar como ventana flotante'}
            >
              {floating ? '⤓' : '⤢'}
            </button>
          )}
          {onToggleMinimize && (
            <button
              type="button"
              className="dock-ctl"
              onClick={onToggleMinimize}
              title={minimized ? 'Restaurar' : 'Minimizar'}
            >
              {minimized ? '▢' : '—'}
            </button>
          )}
        </span>
      </div>
      <div className="claim-dock-body">
      <div className="claim-board-head">
        <span className="section-title">Vincular documentos</span>
        {(dockMode === 'claims' ? onCreateClaim : onCreateChangeOrder) && (
          <button className="btn btn-small btn-primary" onClick={() => setCreating((v) => !v)}>
            {creating ? '✕' : dockMode === 'claims' ? '+ Claim' : '+ OC'}
          </button>
        )}
      </div>

      {creating && dockMode === 'claims' && (
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
            {saving ? 'Creando…' : 'Crear claim'}
          </button>
        </form>
      )}

      {creating && dockMode === 'change-orders' && (
        <form className="claim-create" onSubmit={submitNewCo}>
          <input
            className="note-input"
            autoFocus
            placeholder="Título de la Orden de Cambio…"
            value={newCo.title}
            onChange={(e) => setNewCo((s) => ({ ...s, title: e.target.value }))}
          />
          <div className="claim-create-meta">
            Contrato: <strong>{defaultContract || '— (sin filtrar)'}</strong>
          </div>
          <button className="btn btn-small btn-primary" type="submit" disabled={saving || !newCo.title.trim()}>
            {saving ? 'Creando…' : 'Crear OC'}
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

      {showHelp && (
        <p className="import-help">
          Arrastra una fila sobre un claim para vincular.
          {viewMode === 'highlight' && ' Clic en uno o varios claims para resaltar sus documentos.'}
          {viewMode === 'related' && (selectedClaimIds.length
            ? ` Mostrando documentos de ${selectedClaimIds.length} caso(s). Clic en un caso para agregar/quitar.`
            : ' Clic en uno o varios claims para enfocar solo sus documentos.')}
          {viewMode === 'unrelated' && ' Vista: solo documentos sin claim.'}
        </p>
      )}
      {msg && <div className="form-error">{msg}</div>}
      <div className="drop-list">
        {/* ── CLAIMS MODE ─────────────────────────────────────────── */}
        {dockMode === 'claims' && (
          <>
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
                      {onOpenDetail && (
                        <button type="button" className="dock-ctl dock-ctl-detail" title="Abrir claim"
                          onClick={(e) => { e.stopPropagation(); onOpenDetail(c); }}>↗</button>
                      )}
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
                              <button className="chip-x" disabled={busy} onClick={() => onUnassign(d.id, c.id)}>✕</button>
                            </div>
                          ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ── CHANGE ORDERS MODE ──────────────────────────────────── */}
        {dockMode === 'change-orders' && (
          <>
            {changeOrders.length === 0 && <div className="empty-state"><p>Sin órdenes de cambio</p></div>}
            {changeOrders.map((co) => {
              const isOpen = !!expanded[`co-${co.id}`];
              return (
                <div
                  key={co.id}
                  className={`claim-drop-card ${over === `co-${co.id}` ? 'drag-over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setOver(`co-${co.id}`); }}
                  onDragLeave={() => setOver((id) => (id === `co-${co.id}` ? null : id))}
                  onDrop={(e) => {
                    e.preventDefault(); setOver(null);
                    const docId = Number(e.dataTransfer.getData('text/plain'));
                    if (docId) { setMsg(''); onAssign(docId, co.id); }
                  }}
                >
                  <div className="claim-drop-head"
                    onClick={() => setExpanded((s) => ({ ...s, [`co-${co.id}`]: !s[`co-${co.id}`] }))}
                  >
                    <span className="claim-drop-title">
                      <span className="caret">{isOpen ? '▾' : '▸'}</span>
                      {co.code ? `${co.code} — ` : ''}{co.title}
                    </span>
                    <span className="claim-drop-tags">
                      <span className="badge" style={{ backgroundColor: OC_STATUS_COLORS[co.status] || '#6b7280' }}>
                        {co.status}
                      </span>
                      <span className="count-pill">{co.doc_count || 0} doc</span>
                      {onOpenDetail && (
                        <button type="button" className="dock-ctl dock-ctl-detail" title="Abrir OC"
                          onClick={(e) => { e.stopPropagation(); onOpenDetail(co); }}>↗</button>
                      )}
                    </span>
                  </div>
                  {isOpen && (
                    <div className="claim-drop-docs">
                      <div className="claim-drop-empty">Arrastra documentos aquí · {co.doc_count || 0} vinculados</div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
      </div>
    </aside>
  );
}
