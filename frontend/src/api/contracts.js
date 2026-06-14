const BASE = `${import.meta.env.VITE_API_URL || ''}/api/contracts`;

export const getContracts = async (search = '') => {
  const url = search ? `${BASE}?search=${encodeURIComponent(search)}` : BASE;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error al obtener contratos');
  return res.json();
};

export const createContract = async (data) => {
  const res = await fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error al crear contrato'); }
  return res.json();
};

export const updateContract = async (id, data) => {
  const res = await fetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error al actualizar contrato'); }
  return res.json();
};

export const deleteContract = async (id) => {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error al eliminar contrato'); }
  return res.json();
};
