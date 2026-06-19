import { useState } from 'react';
import { login, register, requestPasswordReset } from '../api/auth';
import PasswordInput from './PasswordInput';

export default function Login({ onLoggedIn }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';

  const switchMode = (next) => { setError(''); setInfo(''); setMode(next); };

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    try {
      if (isForgot) {
        const res = await requestPasswordReset(email.trim());
        setInfo(res.message || 'Si el correo existe, te enviamos un enlace para restablecer tu contraseña.');
      } else {
        const user = isRegister
          ? await register(email.trim(), password, fullName.trim())
          : await login(email.trim(), password);
        onLoggedIn(user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const title = isForgot ? 'Recupera tu contraseña' : isRegister ? 'Crea tu cuenta' : 'Ingresa con tu correo';

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <h1>Control Doc</h1>
        <p className="login-sub">{title}</p>
        {error && <div className="form-error">{error}</div>}
        {info && <div className="form-info">{info}</div>}

        {isForgot ? (
          <p className="login-help">
            Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña.
          </p>
        ) : null}

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
        {!isForgot && (
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <PasswordInput
              id="password" required minLength={6}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
            {!isRegister && (
              <button
                type="button"
                className="link-btn login-forgot"
                onClick={() => switchMode('forgot')}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </div>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Procesando…' : isForgot ? 'Enviar enlace' : isRegister ? 'Registrarme' : 'Ingresar'}
        </button>

        {isForgot ? (
          <p className="login-toggle">
            <button type="button" className="link-btn" onClick={() => switchMode('login')}>
              Volver a iniciar sesión
            </button>
          </p>
        ) : (
          <p className="login-toggle">
            {isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
            <button type="button" className="link-btn" onClick={() => switchMode(isRegister ? 'login' : 'register')}>
              {isRegister ? 'Inicia sesión' : 'Regístrate'}
            </button>
          </p>
        )}
      </form>
    </div>
  );
}
