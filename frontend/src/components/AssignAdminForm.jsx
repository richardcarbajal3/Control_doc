import { useState } from 'react';

export default function AssignAdminForm({ org, onSave, onCancel }) {
  const [form, setForm] = useState({ email: '', full_name: '', password: '' });
  const [error, setError] = useState('');

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email.trim()) { setError('El correo es obligatorio'); return; }
    try { await onSave(form); } catch (err) { setError(err.message); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Asignar admin — {org.name}</h2>
        <p className="import-help">
          Este usuario será el administrador del cliente: gestiona a los demás
          usuarios de su organización (sin importar el dominio).
        </p>
        <form onSubmit={submit}>
          {error && <div className="form-error">{error}</div>}
          <div className="form-group">
            <label htmlFor="email">Correo</label>
            <input id="email" name="email" type="email" value={form.email} onChange={change} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="full_name">Nombre</label>
              <input id="full_name" name="full_name" value={form.full_name} onChange={change} />
            </div>
            <div className="form-group">
              <label htmlFor="password">Contraseña inicial</label>
              <input id="password" name="password" type="password" value={form.password} onChange={change}
                autoComplete="new-password" placeholder="opcional si ya tiene cuenta" />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Asignar admin</button>
          </div>
        </form>
      </div>
    </div>
  );
}
