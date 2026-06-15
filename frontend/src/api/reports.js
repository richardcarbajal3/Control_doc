const BASE = `${import.meta.env.VITE_API_URL || ''}/api/reports`;

export async function getDocumentsReport() {
  const res = await fetch(`${BASE}/documents`);
  if (!res.ok) throw new Error('Error al obtener el reporte');
  return res.json();
}
