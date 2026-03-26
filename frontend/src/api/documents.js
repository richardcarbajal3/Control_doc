const API_URL = `${import.meta.env.VITE_API_URL || ''}/api/documents`;

export async function getDocuments(search = '') {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  const res = await fetch(`${API_URL}${params}`);
  if (!res.ok) throw new Error('Error al obtener documentos');
  return res.json();
}

export async function getDocument(id) {
  const res = await fetch(`${API_URL}/${id}`);
  if (!res.ok) throw new Error('Error al obtener documento');
  return res.json();
}

export async function createDocument(data) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al crear documento');
  }
  return res.json();
}

export async function updateDocument(id, data) {
  const res = await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al actualizar documento');
  }
  return res.json();
}

export async function deleteDocument(id) {
  const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al eliminar documento');
  return res.json();
}
