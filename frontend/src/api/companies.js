const BASE = `${import.meta.env.VITE_API_URL || ''}/api/companies`;

export const getCompanies = async (search = '') => {
  const url = search ? `${BASE}?search=${encodeURIComponent(search)}` : BASE;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error al obtener empresas');
  return res.json();
};

export const createCompany = async (data) => {
  const res = await fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error al crear empresa'); }
  return res.json();
};

export const updateCompany = async (id, data) => {
  const res = await fetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error al actualizar empresa'); }
  return res.json();
};

export const deleteCompany = async (id) => {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error al eliminar empresa'); }
  return res.json();
};
