const BASE = `${import.meta.env.VITE_API_URL || ''}/api/classification-rules`;

async function check(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }
  return res.json();
}

export const getRules = () => check(fetch(BASE));

export const createRule = (data) =>
  check(fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }));

export const updateRule = (id, data) =>
  check(fetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }));

export const deleteRule = (id) =>
  check(fetch(`${BASE}/${id}`, { method: 'DELETE' }));
