// Bulk import (paste from Excel). resource is one of:
// 'documents' | 'companies' | 'projects' | 'contracts'.
export async function bulkImport(resource, rows) {
  const base = `${import.meta.env.VITE_API_URL || ''}/api/${resource}`;
  const res = await fetch(`${base}/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al importar');
  return data; // { inserted, failed, errors: [{ row, error }] }
}
