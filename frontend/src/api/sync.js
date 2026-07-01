const BASE = `${import.meta.env.VITE_API_URL || ''}/api/sync`;

export const getSyncConfig = async () => {
  const res = await fetch(`${BASE}/config`);
  if (!res.ok) throw new Error('Error al obtener configuración de sincronización');
  return res.json();
};

export const updateSyncConfig = async (data) => {
  const res = await fetch(`${BASE}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Error al guardar'); }
  return res.json();
};

// Dispara una sincronización inmediata (se salta el intervalo de 15 min).
export const triggerSync = async () => {
  const res = await fetch(BASE, { method: 'POST' });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'Error al sincronizar');
  return out;
};

// Dispara la sincronización del Excel de contratos (descarga y guarda el .xlsx).
export const triggerContractsSync = async () => {
  const res = await fetch(`${BASE}/contracts`, { method: 'POST' });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'Error al sincronizar contratos');
  return out;
};

// Descarga el .xlsx de contratos guardado por la sync (base64). null si no hay.
export const getContractsFile = async () => {
  const res = await fetch(`${BASE}/contracts-file`);
  if (res.status === 204) return null;
  if (!res.ok) throw new Error('Error al obtener el archivo de contratos');
  return res.json();
};
