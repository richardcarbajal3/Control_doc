const BASE = `${import.meta.env.VITE_API_URL || ''}/api/claims`;

export async function getClaims(search = '') {
  const url = search ? `${BASE}?search=${encodeURIComponent(search)}` : BASE;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error al obtener claims');
  return res.json();
}

export async function getClaim(id) {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error('Error al obtener claim');
  return res.json();
}

export async function createClaim(data) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error al crear claim'); }
  return res.json();
}

export async function updateClaim(id, data) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error al actualizar claim'); }
  return res.json();
}

export async function deleteClaim(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error al eliminar claim'); }
  return res.json();
}
