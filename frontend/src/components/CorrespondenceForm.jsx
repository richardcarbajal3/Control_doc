import { useState } from 'react';

const TYPES = ['Carta', 'Nota Interna', 'Solicitud', 'Respuesta', 'Informe'];
const DIRECTIONS = ['Saliente', 'Entrante'];
const STATUSES = ['Pendiente', 'Respondida', 'Archivada', 'Vencida'];

export default function CorrespondenceForm({ item, projects, contracts, companies, onSave, onCancel }) {
  const [form, setForm] = useState({
    code: item?.code || '',
    subject: item?.subject || '',
    correspondence_type: item?.correspondence_type || 'Carta',
    direction: item?.direction || 'Saliente',
    project_id: item?.project_id || '',
    contract_id: item?.contract_id || '',
    sender_company_id: item?.sender_company_id || '',
    receiver_company_id: item?.receiver_company_id || '',
    issue_date: item?.issue_date ? item.issue_date.slice(0, 10) : '',
    due_date: item?.due_date ? item.due_date.slice(0, 10) : '',
    status: item?.status || 'Pendiente',
    description: item?.description || '',
  });
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.project_id) return setError('El proyecto es requerido');
    if (!form.sender_company_id) return setError('La empresa remitente es requerida');
    if (!form.receiver_company_id) return setError('La empresa destinataria es requerida');
    if (form.sender_company_id === form.receiver_company_id)
      return setError('La empresa remitente y la destinataria no pueden ser la misma');
    if (form.due_date && form.issue_date && form.due_date < form.issue_date)
      return setError('La fecha de vencimiento no puede ser anterior a la fecha de emisión');

    try {
      await onSave({
        ...form,
        project_id: form.project_id || null,
        contract_id: form.contract_id || null,
        sender_company_id: form.sender_company_id || null,
        receiver_company_id: form.receiver_company_id || null,
        due_date: form.due_date || null,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <h2>{item ? 'Editar Correspondencia' : 'Nueva Correspondencia'}</h2>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Código *</label>
              <input value={form.code} onChange={set('code')} required />
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select value={form.correspondence_type} onChange={set('correspondence_type')}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Dirección</label>
              <select value={form.direction} onChange={set('direction')}>
                {DIRECTIONS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Asunto *</label>
            <input value={form.subject} onChange={set('subject')} required />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Proyecto *</label>
              <select value={form.project_id} onChange={set('project_id')} required>
                <option value="">— Seleccionar proyecto —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Contrato</label>
              <select value={form.contract_id} onChange={set('contract_id')}>
                <option value="">— Sin contrato —</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.titulo}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Remitente *</label>
              <select value={form.sender_company_id} onChange={set('sender_company_id')} required>
                <option value="">— Seleccionar empresa —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.razon_social}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Destinatario *</label>
              <select value={form.receiver_company_id} onChange={set('receiver_company_id')} required>
                <option value="">— Seleccionar empresa —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.razon_social}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Fecha de Emisión *</label>
              <input type="date" value={form.issue_date} onChange={set('issue_date')} required />
            </div>
            <div className="form-group">
              <label>Fecha de Vencimiento</label>
              <input type="date" value={form.due_date} onChange={set('due_date')} />
            </div>
          </div>

          <div className="form-group">
            <label>Estado</label>
            <select value={form.status} onChange={set('status')}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Descripción</label>
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
