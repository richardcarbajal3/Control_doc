import { useState } from 'react';

// Stored values follow CONTRACT_MODEL_V1 (English). Labels stay in Spanish for UX.
const TYPES = [
  { value: 'Work', label: 'Obra' },
  { value: 'Service', label: 'Servicio' },
  { value: 'Supply', label: 'Suministro' },
  { value: 'Maintenance', label: 'Mantenimiento' },
];
const STATUSES = [
  { value: 'Draft', label: 'Borrador' },
  { value: 'Active', label: 'Vigente' },
  { value: 'In Settlement', label: 'En Liquidación' },
  { value: 'Closed', label: 'Cerrado' },
  { value: 'Terminated', label: 'Rescindido' },
];
const CURRENCIES = ['PEN', 'USD', 'EUR'];

export default function ContractForm({ contract, projects, companies, onSave, onCancel }) {
  const [form, setForm] = useState({
    code: contract?.code || '',
    title: contract?.title || '',
    type: contract?.type || 'Work',
    project_id: contract?.project_id || '',
    contractor_id: contract?.contractor_id || '',
    mandante_id: contract?.mandante_id || '',
    amount: contract?.amount || '',
    currency: contract?.currency || 'PEN',
    start_date: contract?.start_date ? contract.start_date.slice(0, 10) : '',
    end_date: contract?.end_date ? contract.end_date.slice(0, 10) : '',
    actual_end_date: contract?.actual_end_date ? contract.actual_end_date.slice(0, 10) : '',
    status: contract?.status || 'Draft',
    description: contract?.description || '',
  });
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onSave({
        ...form,
        project_id: form.project_id || null,
        contractor_id: form.contractor_id || null,
        mandante_id: form.mandante_id || null,
        amount: form.amount !== '' ? form.amount : null,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <h2>{contract ? 'Editar Contrato' : 'Nuevo Contrato'}</h2>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Código *</label>
              <input value={form.code} onChange={set('code')} required />
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select value={form.type} onChange={set('type')}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Título *</label>
            <input value={form.title} onChange={set('title')} required />
          </div>
          <div className="form-group">
            <label>Proyecto</label>
            <select value={form.project_id} onChange={set('project_id')}>
              <option value="">— Sin proyecto —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Contratista</label>
              <select value={form.contractor_id} onChange={set('contractor_id')}>
                <option value="">— Sin contratista —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Mandante</label>
              <select value={form.mandante_id} onChange={set('mandante_id')}>
                <option value="">— Sin mandante —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Monto</label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={set('amount')} />
            </div>
            <div className="form-group">
              <label>Moneda</label>
              <select value={form.currency} onChange={set('currency')}>
                {CURRENCIES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Fecha Inicio</label>
              <input type="date" value={form.start_date} onChange={set('start_date')} />
            </div>
            <div className="form-group">
              <label>Fecha Fin Contractual</label>
              <input type="date" value={form.end_date} onChange={set('end_date')} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Fecha Fin Real</label>
              <input type="date" value={form.actual_end_date} onChange={set('actual_end_date')} />
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select value={form.status} onChange={set('status')}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Descripción / Alcance</label>
            <textarea value={form.description} onChange={set('description')} rows={3} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
