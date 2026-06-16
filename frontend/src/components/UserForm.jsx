import { useState, useEffect } from 'react';

export default function UserForm({ user, isSuperadmin, onSave, onCancel }) {
  const [form, setForm] = useState({ email: '', full_name: '', role: 'member', password: '', is_active: true });
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) setForm({
      email: user.email || '', full_name: user.full_name || '',
      role: user.role || 'member', password: '', is_active: user.is_active,
    });
  }, [user]);

  const change = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!user && !form.email.trim()) { setError('El correo es obligatorio'); return; }
    try {
      const payload = user
        ? { full_name: form.full_name, role: form.role, is_active: form.is_active, ...(form.password ? { password: form.password } : {}) }
        : form;
      await onSave(payload);
    } catch (err) { setError(err.message); }
  };

  const roles = isSuperadmin ? ['member', 'admin', 'superadmin'] : ['member', 'admin'];

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{user ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
        <form onSubmit={submit}>
          {error && <div className="form-error">{error}</div>}
          <div className="form-group">
            <label htmlFor="email">Correo corporativo</label>
            <input id="email" name="email" type="email" value={form.email} onChange={change} disabled={!!user} required />
          </div>
          <div className="form-group">
            <label htmlFor="full_name">Nombre</label>
            <input id="full_name" name="full_name" value={form.full_name} onChange={change} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="role">Rol</label>
              <select id="role" name="role" value={form.role} onChange={change}>
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="password">{user ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
              <input id="password" name="password" type="password" value={form.password} onChange={change}
                autoComplete="new-password" placeholder={user ? 'dejar en blanco para no cambiar' : ''} />
            </div>
          </div>
          {user && (
            <label className="import-check">
              <input type="checkbox" name="is_active" checked={form.is_active} onChange={change} />
              Cuenta activa
            </label>
          )}
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="btn btn-primary">{user ? 'Guardar' : 'Crear'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
