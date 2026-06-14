const BASE = `${import.meta.env.VITE_API_URL || ''}/api/correspondence`;

export const getCorrespondence = async (search = '') => {
  const url = search ? `${BASE}?search=${encodeURIComponent(search)}` : BASE;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error al obtener correspondencia');
  return res.json();
};

export const createCorrespondence = async (data) => {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error al crear correspondencia'); }
  return res.json();
};

export const updateCorrespondence = async (id, data) => {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error al actualizar correspondencia'); }
  return res.json();
};

export const deleteCorrespondence = async (id) => {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error al eliminar correspondencia'); }
  return res.json();
};
