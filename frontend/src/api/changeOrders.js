const BASE = `${import.meta.env.VITE_API_URL || ''}/api/change-orders`;

async function req(url, opts = {}) {
  const token = localStorage.getItem('cd_token');
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Error ${res.status}`); }
  return res.json();
}

export const getChangeOrders = (search = '') =>
  req(`${BASE}${search ? `?search=${encodeURIComponent(search)}` : ''}`);

export const getChangeOrder = (id) => req(`${BASE}/${id}`);

export const createChangeOrder = (data) =>
  req(BASE, { method: 'POST', body: JSON.stringify(data) });

export const updateChangeOrder = (id, data) =>
  req(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteChangeOrder = (id) =>
  req(`${BASE}/${id}`, { method: 'DELETE' });

export const addDocToChangeOrder = (id, document_id) =>
  req(`${BASE}/${id}/documents`, { method: 'POST', body: JSON.stringify({ document_id }) });

export const removeDocFromChangeOrder = (id, docId) =>
  req(`${BASE}/${id}/documents/${docId}`, { method: 'DELETE' });
