const BASE = `${import.meta.env.VITE_API_URL || ''}/api/organizations`;

export async function getOrganizations() {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error('Error al obtener organizaciones');
  return res.json();
}

export async function createOrganization(data) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const out = await res.json();
  if (!res.ok) throw new Error(out.error || 'Error al crear organización');
  return out;
}

export async function updateOrganization(id, data) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const out = await res.json();
  if (!res.ok) throw new Error(out.error || 'Error al actualizar organización');
  return out;
}

export async function deleteOrganization(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  const out = await res.json();
  if (!res.ok) throw new Error(out.error || 'Error al eliminar organización');
  return out;
}

export async function assignOrgAdmin(id, data) {
  const res = await fetch(`${BASE}/${id}/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const out = await res.json();
  if (!res.ok) throw new Error(out.error || 'Error al asignar admin');
  return out;
}
