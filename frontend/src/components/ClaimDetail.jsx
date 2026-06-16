import { useState, useEffect, useCallback } from 'react';
import { getClaim } from '../api/claims';
import { updateDocument } from '../api/documents';
import { CLAIM_LINE_FIELDS } from '../lib/claimLineFields';

function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ClaimDetail({ claim, allDocuments, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lineData, setLineData] = useState({}); // id -> { campo1, campo2, ... } draft

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
    try { await updateDocument(Number(pick), { claim_id: claim.id }); setPick(''); await load(); onChanged?.(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const removeDoc = async (id) => {
    setBusy(true); setError('');
    try { await updateDocument(id, { claim_id: null }); await load(); onChanged?.(); }
    catch (e) { setError(e.message); }
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>{data?.code ? `${data.code} — ` : ''}{data?.title || claim.title}</h2>
        <p className="import-help">
          {data?.type} · Contrato {data?.n_contrato || '—'} · Estado {data?.status}
          {isClosed && <span className="pill pill-danger" style={{ marginLeft: '0.5rem' }}>Cerrado — no acepta más documentos</span>}
        </p>

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
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
