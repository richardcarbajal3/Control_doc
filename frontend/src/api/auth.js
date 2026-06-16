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

export async function getMe() {
  const res = await fetch(`${BASE}/me`);
  if (!res.ok) throw new Error('Sesión inválida');
  return res.json();
}

export function logout() {
  clearToken();
}
