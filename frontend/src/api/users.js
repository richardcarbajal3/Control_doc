const BASE = `${import.meta.env.VITE_API_URL || ''}/api/users`;

export async function getUsers() {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error('Error al obtener usuarios');
  return res.json();
}

export async function createUser(data) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const out = await res.json();
  if (!res.ok) throw new Error(out.error || 'Error al crear usuario');
  return out;
}

export async function updateUser(id, data) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const out = await res.json();
  if (!res.ok) throw new Error(out.error || 'Error al actualizar usuario');
  return out;
}

export async function deleteUser(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  const out = await res.json();
  if (!res.ok) throw new Error(out.error || 'Error al eliminar usuario');
  return out;
}

export async function getContractMembers(contractId) {
  const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/contracts/${contractId}/members`);
  if (!res.ok) throw new Error('Error al obtener miembros');
  return res.json();
}

export async function assignMember(contractId, data) {
  const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/contracts/${contractId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const out = await res.json();
  if (!res.ok) throw new Error(out.error || 'Error al asignar miembro');
  return out;
}

export async function removeMember(contractId, userId) {
  const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/contracts/${contractId}/members/${userId}`, {
    method: 'DELETE',
  });
  const out = await res.json();
  if (!res.ok) throw new Error(out.error || 'Error al remover miembro');
  return out;
}
