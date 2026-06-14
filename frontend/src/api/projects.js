const BASE = `${import.meta.env.VITE_API_URL || ''}/api/projects`;

export const getProjects = async (search = '') => {
  const url = search ? `${BASE}?search=${encodeURIComponent(search)}` : BASE;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error al obtener proyectos');
  return res.json();
};

export const createProject = async (data) => {
  const res = await fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error al crear proyecto'); }
  return res.json();
};

export const updateProject = async (id, data) => {
  const res = await fetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error al actualizar proyecto'); }
  return res.json();
};

export const deleteProject = async (id) => {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error al eliminar proyecto'); }
  return res.json();
};
