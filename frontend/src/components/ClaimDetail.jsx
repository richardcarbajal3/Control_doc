import { useState, useEffect, useCallback } from 'react';
import { getClaim, attachDocument, detachDocument } from '../api/claims';

function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ClaimDetail({ claim, allDocuments, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [pick, setPick] = useState('');
  const [relacion, setRelacion] = useState('soporte');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setData(await getClaim(claim.id)); }
    catch (e) { setError(e.message); }
  }, [claim.id]);

  useEffect(() => { load(); }, [load]);

  const assignedIds = new Set((data?.documents || []).map((d) => d.id));
  const available = allDocuments.filter((d) => !assignedIds.has(d.id));

  const addDoc = async () => {
    if (!pick) return;
    setBusy(true); setError('');
    try { await attachDocument(claim.id, Number(pick), relacion); setPick(''); await load(); onChanged?.(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const removeDoc = async (id) => {
    setBusy(true); setError('');
    try { await detachDocument(claim.id, id); await load(); onChanged?.(); }
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
                  <th>RELACIÓN</th><th>STATUS G</th><th className="center">Atraso</th><th></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td className="code-cell">{d.documento_nro}</td>
                    <td>{d.descripcion}</td>
                    <td>{fmtDate(d.fecha)}</td>
                    <td>
                      {d.relacion === 'referencia'
                        ? <span className="pill">Referencia</span>
                        : <span className="pill pill-ok">Soporte</span>}
                    </td>
                    <td>
                      {d.is_pending
                        ? <span className="pill pill-warn">{d.status_g || 'PENDIENTE'}</span>
                        : <span className="pill pill-ok">{d.status_g}</span>}
                    </td>
                    <td className="center">{d.is_pending && d.dias_atraso > 0 ? `${d.dias_atraso} d` : '—'}</td>
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

        <h3 className="section-title">Agregar documento existente</h3>
        <p className="import-help">
          Un mismo documento puede usarse en varios claims: como <strong>soporte</strong> del
          reclamo o como <strong>referencia</strong> (p. ej. una carta que notifica un procedimiento).
        </p>
        <div className="assign-row">
          <select className="search-input" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">— Selecciona un documento —</option>
            {available.map((d) => (
              <option key={d.id} value={d.id}>
                {(d.documento_nro || `#${d.id}`)} — {(d.descripcion || '').slice(0, 60)}
              </option>
            ))}
          </select>
          <select className="search-input" value={relacion} onChange={(e) => setRelacion(e.target.value)}>
            <option value="soporte">Soporte</option>
            <option value="referencia">Referencia</option>
          </select>
          <button className="btn btn-primary" disabled={!pick || busy} onClick={addDoc}>Agregar</button>
        </div>

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
