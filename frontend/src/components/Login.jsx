import { useState } from 'react';
import { login } from '../api/auth';

export default function Login({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const user = await login(email.trim(), password);
      onLoggedIn(user);
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
        <p className="login-sub">Ingresa con tu correo corporativo</p>
        {error && <div className="form-error">{error}</div>}
        <div className="form-group">
          <label htmlFor="email">Correo</label>
          <input
            id="email" type="email" autoComplete="username" required
            placeholder="usuario@empresa.com.pe"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password" type="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
