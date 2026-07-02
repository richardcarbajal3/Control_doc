import { useState } from 'react';
import { login, register } from '../api/auth';

export default function Login({ onLoggedIn }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const user = isRegister
        ? await register(email.trim(), password, fullName.trim())
        : await login(email.trim(), password);
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
        <h1>ProjectFlow</h1>
        <p className="login-sub">
          {isRegister ? 'Crea tu cuenta' : 'Ingresa con tu correo'}
        </p>
        {error && <div className="form-error">{error}</div>}

        {isRegister && (
          <div className="form-group">
            <label htmlFor="full_name">Nombre</label>
            <input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
        )}
        <div className="form-group">
          <label htmlFor="email">Correo</label>
          <input
            id="email" type="email" autoComplete="username" required
            placeholder="usuario@empresa.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password" type="password" required minLength={6}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Procesando…' : isRegister ? 'Registrarme' : 'Ingresar'}
        </button>

        <p className="login-toggle">
          {isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
          <button type="button" className="link-btn" onClick={() => { setError(''); setMode(isRegister ? 'login' : 'register'); }}>
            {isRegister ? 'Inicia sesión' : 'Regístrate'}
          </button>
        </p>
      </form>
    </div>
  );
}
