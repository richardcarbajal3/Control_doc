import { useState } from 'react';
import { resetPassword } from '../api/auth';
import PasswordInput from './PasswordInput';

// Pantalla a la que llega el usuario desde el enlace del correo
// (…/reset-password?token=XXX). Pide la nueva contraseña dos veces.
export default function ResetPassword({ token, onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return; }
    setBusy(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <h1>Control Doc</h1>
        <p className="login-sub">Nueva contraseña</p>

        {!token ? (
          <>
            <div className="form-error">El enlace no es válido. Solicita uno nuevo desde "¿Olvidaste tu contraseña?".</div>
            <button type="button" className="btn btn-secondary btn-block" onClick={onDone}>Volver</button>
          </>
        ) : done ? (
          <>
            <div className="form-info">Tu contraseña se actualizó. Ya puedes iniciar sesión.</div>
            <button type="button" className="btn btn-primary btn-block" onClick={onDone}>Ir a iniciar sesión</button>
          </>
        ) : (
          <>
            {error && <div className="form-error">{error}</div>}
            <div className="form-group">
              <label htmlFor="new_password">Nueva contraseña</label>
              <PasswordInput
                id="new_password" required minLength={6} autoComplete="new-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirm_password">Repite la contraseña</label>
              <PasswordInput
                id="confirm_password" required minLength={6} autoComplete="new-password"
                value={confirm} onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar contraseña'}
            </button>
            <p className="login-toggle">
              <button type="button" className="link-btn" onClick={onDone}>Cancelar</button>
            </p>
          </>
        )}
      </form>
    </div>
  );
}
