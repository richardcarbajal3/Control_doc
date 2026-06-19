import { setToken, clearToken } from './http';

const BASE = `${import.meta.env.VITE_API_URL || ''}/api/auth`;

export async function login(email, password) {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
  setToken(data.token);
  return data.user;
}

export async function register(email, password, full_name) {
  const res = await fetch(`${BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, full_name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al registrarse');
  setToken(data.token);
  return data.user;
}

// Pide un enlace de recuperación. Por seguridad el backend responde siempre
// OK (no revela si el correo existe); devolvemos el mensaje genérico.
export async function requestPasswordReset(email) {
  const res = await fetch(`${BASE}/forgot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'No se pudo enviar el correo');
  return data;
}

// Establece una nueva contraseña usando el token recibido por correo.
export async function resetPassword(token, password) {
  const res = await fetch(`${BASE}/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'No se pudo restablecer la contraseña');
  return data;
}

export async function getMe() {
  const res = await fetch(`${BASE}/me`);
  if (!res.ok) throw new Error('Sesión inválida');
  return res.json();
}

export function logout() {
  clearToken();
}
