import { useState, useEffect } from 'react';

export default function OrgForm({ org, onSave, onCancel }) {
  const [form, setForm] = useState({ name: '', plan: '', status: 'active' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (org) setForm({ name: org.name || '', plan: org.plan || '', status: org.status || 'active' });
  }, [org]);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    try { await onSave(form); } catch (err) { setError(err.message); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{org ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
        <form onSubmit={submit}>
          {error && <div className="form-error">{error}</div>}
          <div className="form-group">
            <label htmlFor="name">Nombre del cliente</label>
            <input id="name" name="name" value={form.name} onChange={change} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="plan">Plan</label>
              <input id="plan" name="plan" value={form.plan} onChange={change} placeholder="Pro / Básico…" />
            </div>
            <div className="form-group">
              <label htmlFor="status">Estado</label>
              <select id="status" name="status" value={form.status} onChange={change}>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="btn btn-primary">{org ? 'Guardar' : 'Crear'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
