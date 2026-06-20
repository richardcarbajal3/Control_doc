import { useState, useEffect, useCallback } from 'react';
import { getChangeOrder, addDocToChangeOrder, removeDocFromChangeOrder } from '../api/changeOrders';

const fmt = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtMonto = (v, cur) => {
  if (v == null || v === '') return '—';
  return `${cur || 'USD'} ${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
};

const STATUS_CLASSES = {
  'Borrador': 'pill-info',
  'En negociación': 'pill-warn',
  'Aprobada': 'pill-ok',
  'Rechazada': 'pill-danger',
};

export default function ChangeOrderDetail({ co, allDocuments = [], onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setData(await getChangeOrder(co.id)); } catch (e) { setError(e.message); }
  }, [co.id]);

  useEffect(() => { load(); }, [load]);

  const assignedIds = new Set((data?.documents || []).map((d) => d.id));
  const available = allDocuments.filter((d) => !assignedIds.has(d.id));

  const addDoc = async () => {
    if (!pick) return;
    setBusy(true); setError('');
    try { await addDocToChangeOrder(co.id, Number(pick)); setPick(''); await load(); onChanged?.(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const removeDoc = async (docId) => {
    setBusy(true); setError('');
    try { await removeDocFromChangeOrder(co.id, docId); await load(); onChanged?.(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const cur = data?.currency || co.currency || 'USD';
  const statusCls = STATUS_CLASSES[data?.status || co.status] || 'pill-info';
  const docs = data?.documents || [];

  const field = (label, value) => (
    <div className="ficha-field">
      <span className="ficha-label">{label}</span>
      <span className="ficha-value">{value || '—'}</span>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>{data?.code ? `${data.code} — ` : ''}{data?.title || co.title}</h2>
        <p className="import-help">Orden de Cambio · Contrato {data?.n_contrato || co.n_contrato || '—'}</p>

        <div style={{ marginBottom: '1rem' }}>
          <span className={`pill ${statusCls}`}>{data?.status || co.status}</span>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="ficha-grid">
          {field('Descripción', data?.description || co.description)}
          {field('N° Contrato', data?.n_contrato || co.n_contrato)}
          <div className="ficha-field">
            <span className="ficha-label">Monto solicitado</span>
            <span className="ficha-value" style={{ fontWeight: 600 }}>
              {fmtMonto(data?.monto_solicitado ?? co.monto_solicitado, cur)}
            </span>
          </div>
          <div className="ficha-field">
            <span className="ficha-label">Monto aprobado</span>
            <span className="ficha-value" style={{ fontWeight: 600, color: 'var(--color-ok, #16a34a)' }}>
              {fmtMonto(data?.monto_aprobado ?? co.monto_aprobado, cur)}
            </span>
          </div>
        </div>

        {/* Delta */}
        {(data?.monto_solicitado != null && data?.monto_aprobado != null) && (
          <p className="import-help" style={{ marginTop: 0 }}>
            Diferencia: {fmtMonto(
              (Number(data.monto_aprobado) - Number(data.monto_solicitado)).toFixed(2),
              cur
            )}
          </p>
        )}

        <h3 className="section-title">Documentos de soporte ({docs.length})</h3>
        {docs.length === 0 ? (
          <div className="empty-state"><p>Sin documentos vinculados</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>DOCUMENTO NRO</th><th>DESCRIPCIÓN</th><th>TIPO</th><th>FECHA</th><th></th></tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td className="code-cell">{d.documento_nro || `#${d.id}`}</td>
                    <td>{d.descripcion || '—'}</td>
                    <td>{d.tipo_doc || '—'}</td>
                    <td>{fmt(d.fecha)}</td>
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

        <h3 className="section-title">Agregar documento de soporte</h3>
        <div className="assign-row">
          <select className="search-input" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">— Selecciona un documento —</option>
            {available.map((d) => (
              <option key={d.id} value={d.id}>
                {d.documento_nro || `#${d.id}`} — {(d.descripcion || '').slice(0, 60)}
              </option>
            ))}
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
