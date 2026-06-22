import { useState, useEffect, useCallback, useRef } from 'react';
import { getClaim, updateClaim, addDocToClaim, removeDocFromClaim } from '../api/claims';
import { updateDocument } from '../api/documents';
import { CLAIM_LINE_FIELDS } from '../lib/claimLineFields';
import ClaimTimeline from './ClaimTimeline';

const DETAIL_POS_KEY = 'claimDetail.pos';
const readPos = () => { try { const r = localStorage.getItem(DETAIL_POS_KEY); return r ? JSON.parse(r) : null; } catch { return null; } };
const writePos = (v) => { try { localStorage.setItem(DETAIL_POS_KEY, JSON.stringify(v)); } catch {} };

function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ClaimDetail({ claim, allDocuments, onClose, onChanged, floating = false }) {
  const [data, setData] = useState(null);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lineData, setLineData] = useState({});
  const dragging = useRef(false);
  const [pos, setPos] = useState(() => {
    if (!floating) return { x: 0, y: 0 };
    const saved = readPos();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      return { x: Math.min(saved.x, vw - 60), y: Math.min(saved.y, vh - 40) };
    }
    return { x: Math.max(8, Math.round((vw - 680) / 2)), y: 60 };
  });

  useEffect(() => { if (floating) writePos(pos); }, [floating, pos]);

  const load = useCallback(async () => {
    try {
      const fresh = await getClaim(claim.id);
      setData(fresh);
      setLineData(Object.fromEntries((fresh.documents || []).map((d) => [d.id, { ...(d.claim_data || {}) }])));
    } catch (e) { setError(e.message); }
  }, [claim.id]);

  useEffect(() => { load(); }, [load]);

  const isClosed = String(data?.status || claim.status || '').trim().toUpperCase() === 'CERRADO';
  const assignedIds = new Set((data?.documents || []).map((d) => d.id));
  const available = allDocuments.filter((d) => !assignedIds.has(d.id));

  const addDoc = async () => {
    if (!pick) return;
    setBusy(true); setError('');
    try { await addDocToClaim(claim.id, Number(pick)); setPick(''); await load(); onChanged?.(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const removeDoc = async (id) => {
    setBusy(true); setError('');
    try { await removeDocFromClaim(claim.id, id); await load(); onChanged?.(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  // Close / reopen the claim. A closed claim won't accept more documents.
  const toggleClosed = async () => {
    const src = data || claim;
    const nextStatus = isClosed ? 'Abierto' : 'Cerrado';
    if (!isClosed && !window.confirm('¿Cerrar este claim? No se podrán agregar más documentos hasta reabrirlo.')) return;
    setBusy(true); setError('');
    try {
      await updateClaim(claim.id, {
        code: src.code,
        title: src.title,
        type: src.type,
        n_contrato: src.n_contrato,
        status: nextStatus,
        description: src.description,
      });
      await load();
      onChanged?.();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const setField = (id, key, value) =>
    setLineData((s) => ({ ...s, [id]: { ...s[id], [key]: value } }));

  // Persist a line's complementary fields only when something actually changed.
  const saveLine = async (d) => {
    const next = lineData[d.id] || {};
    const prev = d.claim_data || {};
    if (JSON.stringify(next) === JSON.stringify(prev)) return;
    setBusy(true); setError('');
    try { await updateDocument(d.id, { claim_data: next }); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const docs = data?.documents || [];
  const [view, setView] = useState('timeline'); // 'timeline' | 'table'

  const startDrag = (e) => {
    if (e.target.closest('button, input, select, textarea')) return;
    dragging.current = true;
    const startX = e.clientX - pos.x;
    const startY = e.clientY - pos.y;
    const onMove = (ev) => {
      if (!dragging.current) return;
      setPos({
        x: Math.min(window.innerWidth - 60, Math.max(0, ev.clientX - startX)),
        y: Math.min(window.innerHeight - 40, Math.max(0, ev.clientY - startY)),
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

  const inner = (
    <>
      {error && <div className="form-error">{error}</div>}
      <h3 className="section-title">Documentos / cartas de soporte ({docs.length})</h3>
      {docs.length === 0 ? (
        <div className="empty-state"><p>Aún no hay documentos en este claim</p></div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>DOCUMENTO NRO</th><th>DESCRIPCIÓN</th><th>FECHA</th>
                <th>STATUS G</th><th className="center">Atraso</th>
                {CLAIM_LINE_FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td className="code-cell">{d.documento_nro}</td>
                  <td>{d.descripcion}</td>
                  <td>{fmtDate(d.fecha)}</td>
                  <td>
                    {d.is_pending
                      ? <span className="pill pill-warn">{d.status_g || 'PENDIENTE'}</span>
                      : <span className="pill pill-ok">{d.status_g}</span>}
                  </td>
                  <td className="center">{d.is_pending && d.dias_atraso > 0 ? `${d.dias_atraso} d` : '—'}</td>
                  {CLAIM_LINE_FIELDS.map((f) => (
                    <td key={f.key}>
                      <input
                        className="note-input"
                        placeholder={f.label}
                        value={(lineData[d.id]?.[f.key]) ?? ''}
                        disabled={busy}
                        onChange={(e) => setField(d.id, f.key, e.target.value)}
                        onBlur={() => saveLine(d)}
                      />
                    </td>
                  ))}
                  <td>
                    <button className="btn btn-small btn-delete" disabled={busy} onClick={() => removeDoc(d.id)}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isClosed && (
        <>
          <h3 className="section-title">Agregar documento existente</h3>
          <div className="assign-row">
            <select className="search-input" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">— Selecciona un documento —</option>
              {available.map((d) => (
                <option key={d.id} value={d.id}>
                  {(d.documento_nro || `#${d.id}`)} — {(d.descripcion || '').slice(0, 60)}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" disabled={!pick || busy} onClick={addDoc}>Agregar</button>
          </div>
        </>
      )}

      <div className="form-actions">
        <button
          className={`btn ${isClosed ? 'btn-secondary' : 'btn-primary'}`}
          disabled={busy}
          onClick={toggleClosed}
        >
          {isClosed ? 'Reabrir claim' : 'Cerrar claim'}
        </button>
        {!floating && <button className="btn btn-secondary" onClick={onClose}>Salir</button>}
      </div>
    </>
  );

  if (floating) {
    return (
      <div
        className="claim-detail-float"
        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      >
        <div className="claim-dock-bar" onPointerDown={startDrag} style={{ cursor: 'grab' }}>
          <span className="claim-dock-bar-title">
            <span className="claim-dock-grip" aria-hidden="true">⠿</span>
            {data?.code ? `${data.code} — ` : ''}{data?.title || claim.title}
            {data?.status && (
              <span className="badge" style={{ marginLeft: '0.5rem', fontSize: '0.72rem', background: '#e2e8f0', color: '#475569', borderRadius: 10, padding: '0.1rem 0.5rem' }}>
                {data.status}
              </span>
            )}
            {isClosed && <span className="pill pill-danger" style={{ marginLeft: '0.3rem', fontSize: '0.7rem' }}>Cerrado</span>}
          </span>
          <span className="claim-dock-ctls">
            <button type="button" className="dock-ctl" onClick={onClose} title="Cerrar detalle">✕</button>
          </span>
        </div>
        <div className="claim-detail-float-body">
          <p className="import-help" style={{ marginBottom: '0.5rem' }}>
            {data?.type} · Contrato {data?.n_contrato || '—'}
          </p>
          {inner}
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>{data?.code ? `${data.code} — ` : ''}{data?.title || claim.title}</h2>
        <p className="import-help">
          {data?.type} · Contrato {data?.n_contrato || '—'} · Estado {data?.status}
          {isClosed && <span className="pill pill-danger" style={{ marginLeft: '0.5rem' }}>Cerrado — no acepta más documentos</span>}
        </p>
        {data?.description && <p className="ficha-desc">{data.description}</p>}

        {error && <div className="form-error">{error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h3 className="section-title" style={{ margin: 0 }}>Documentos de soporte ({docs.length})</h3>
          <div className="view-toggle">
            <button className={`btn btn-small ${view === 'timeline' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setView('timeline')}>Cronología</button>
            <button className={`btn btn-small ${view === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setView('table')}>Tabla</button>
          </div>
        </div>

        {view === 'timeline' && <ClaimTimeline documents={docs} />}

        {view === 'table' && (
          docs.length === 0 ? (
            <div className="empty-state"><p>Aún no hay documentos en este claim</p></div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>DOCUMENTO NRO</th><th>DESCRIPCIÓN</th><th>FECHA</th>
                    <th>STATUS G</th><th className="center">Atraso</th>
                    {CLAIM_LINE_FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.id}>
                      <td className="code-cell">{d.documento_nro}</td>
                      <td>{d.descripcion}</td>
                      <td>{fmtDate(d.fecha)}</td>
                      <td>
                        {d.is_pending
                          ? <span className="pill pill-warn">{d.status_g || 'PENDIENTE'}</span>
                          : <span className="pill pill-ok">{d.status_g}</span>}
                      </td>
                      <td className="center">{d.is_pending && d.dias_atraso > 0 ? `${d.dias_atraso} d` : '—'}</td>
                      {CLAIM_LINE_FIELDS.map((f) => (
                        <td key={f.key}>
                          <input
                            className="note-input"
                            placeholder={f.label}
                            value={(lineData[d.id]?.[f.key]) ?? ''}
                            disabled={busy}
                            onChange={(e) => setField(d.id, f.key, e.target.value)}
                            onBlur={() => saveLine(d)}
                          />
                        </td>
                      ))}
                      <td>
                        <button className="btn btn-small btn-delete" disabled={busy} onClick={() => removeDoc(d.id)}>
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {!isClosed && (
          <>
            <h3 className="section-title">Agregar documento existente</h3>
            <div className="assign-row">
              <select className="search-input" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">— Selecciona un documento —</option>
                {available.map((d) => (
                  <option key={d.id} value={d.id}>
                    {(d.documento_nro || `#${d.id}`)} — {(d.descripcion || '').slice(0, 60)}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" disabled={!pick || busy} onClick={addDoc}>Agregar</button>
            </div>
          </>
        )}

        <div className="form-actions">
          <button
            className={`btn ${isClosed ? 'btn-secondary' : 'btn-primary'}`}
            disabled={busy}
            onClick={toggleClosed}
          >
            {isClosed ? 'Reabrir claim' : 'Cerrar claim'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Salir</button>
        </div>
      </div>
    </div>
  );
}
