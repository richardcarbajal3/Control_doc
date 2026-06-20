import { useState } from 'react';

const STATUS_OPTIONS = ['Borrador', 'En negociación', 'Aprobada', 'Rechazada'];
const CURRENCY_OPTIONS = ['USD', 'PEN', 'EUR'];

export default function ChangeOrderForm({ co, onSave, onCancel }) {
  const [form, setForm] = useState({
    code: co?.code || '',
    n_contrato: co?.n_contrato || '',
    title: co?.title || '',
    description: co?.description || '',
    monto_solicitado: co?.monto_solicitado || '',
    monto_aprobado: co?.monto_aprobado || '',
    currency: co?.currency || 'USD',
    status: co?.status || 'Borrador',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError('El título es requerido');
    setBusy(true); setError('');
    try { await onSave(form); }
    catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{co ? 'Editar Orden de Cambio' : 'Nueva Orden de Cambio'}</h2>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="form-group">
              <label>Código OC</label>
              <input className="search-input" value={form.code} onChange={set('code')} placeholder="OC-001" />
            </div>
            <div className="form-group">
              <label>N° Contrato</label>
              <input className="search-input" value={form.n_contrato} onChange={set('n_contrato')} />
            </div>
          </div>
          <div className="form-group">
            <label>Título *</label>
            <input className="search-input" value={form.title} onChange={set('title')} required />
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <textarea className="search-input" rows={3} value={form.description} onChange={set('description')}
              style={{ resize: 'vertical', width: '100%' }} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Moneda</label>
              <select className="search-input" value={form.currency} onChange={set('currency')}>
                {CURRENCY_OPTIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Monto solicitado</label>
              <input type="number" step="0.01" className="search-input" value={form.monto_solicitado}
                onChange={set('monto_solicitado')} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label>Monto aprobado</label>
              <input type="number" step="0.01" className="search-input" value={form.monto_aprobado}
                onChange={set('monto_aprobado')} placeholder="0.00" />
            </div>
          </div>
          <div className="form-group">
            <label>Estado</label>
            <select className="search-input" value={form.status} onChange={set('status')}>
              {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
