import { useState } from 'react';

const TYPES      = ['Obra', 'Suministro', 'Servicios', 'Consultoría'];
const STATUSES   = ['Draft', 'Active', 'In Settlement', 'Closed', 'Terminated'];
const CURRENCIES = ['PEN', 'USD', 'EUR'];

export default function ContractForm({ contract, projects, companies, onSave, onCancel }) {
  const [form, setForm] = useState({
    code:           contract?.code        || '',
    title:          contract?.title       || '',
    type:           contract?.type        || 'Obra',
    project_id:     contract?.project_id  || '',
    contratista_id: contract?.contratista_id || '',
    mandante_id:    contract?.mandante_id    || '',
    amount:         contract?.amount      || '',
    currency:       contract?.currency    || 'PEN',
    start_date:     contract?.start_date  ? contract.start_date.slice(0, 10) : '',
    end_date:       contract?.end_date    ? contract.end_date.slice(0, 10)   : '',
    status:         contract?.status      || 'Draft',
    description:    contract?.description || '',
  });
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.contratista_id && form.mandante_id && form.contratista_id === form.mandante_id)
      return setError('El contratista y el mandante no pueden ser la misma empresa');
    if (form.start_date && form.end_date && form.start_date > form.end_date)
      return setError('La fecha de inicio no puede ser posterior a la fecha de fin');
    try {
      await onSave({
        ...form,
        project_id:     form.project_id     || null,
        contratista_id: form.contratista_id || null,
        mandante_id:    form.mandante_id    || null,
        amount:         form.amount !== ''  ? form.amount : null,
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
              <input value={form.code} onChange={set('code')} placeholder="CT-001" required />
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select value={form.type} onChange={set('type')}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Título *</label>
            <input value={form.title} onChange={set('title')} placeholder="Nombre del contrato" required />
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
              <select value={form.contratista_id} onChange={set('contratista_id')}>
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
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Fecha Inicio</label>
              <input type="date" value={form.start_date} onChange={set('start_date')} />
            </div>
            <div className="form-group">
              <label>Fecha Fin</label>
              <input type="date" value={form.end_date} onChange={set('end_date')} />
            </div>
          </div>

          <div className="form-group">
            <label>Estado</label>
            <select value={form.status} onChange={set('status')}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
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
