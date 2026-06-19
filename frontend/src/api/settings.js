const BASE = `${import.meta.env.VITE_API_URL || ''}/api/settings`;

export const getSettings = async () => {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error('Error al obtener configuración');
  return res.json();
};

export const updateSettings = async (data) => {
  const res = await fetch(BASE, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error al guardar configuración'); }
  return res.json();
};
