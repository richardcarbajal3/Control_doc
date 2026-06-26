const BASE = `${import.meta.env.VITE_API_URL || ''}/api/sync`;

export const getSyncConfig = async () => {
  const res = await fetch(`${BASE}/config`);
  if (!res.ok) throw new Error('Error al obtener configuración de sincronización');
  return res.json();
};

export const updateSyncConfig = async (data) => {
  const res = await fetch(`${BASE}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Error al guardar'); }
  return res.json();
};

// Dispara una sincronización inmediata (se salta el intervalo de 15 min).
export const triggerSync = async () => {
  const res = await fetch(BASE, { method: 'POST' });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'Error al sincronizar');
  return out;
};

// Descarga el Excel de Análisis configurado en SharePoint (Contratos, Pago, SAP,
// Av&Provision, …). Devuelve un ArrayBuffer listo para el parser del módulo, o
// null si todavía no hay un enlace configurado (404).
export const fetchAnalysisFile = async () => {
  const res = await fetch(`${BASE}/analysis/file`);
  // 404 = sin enlace configurado; 409 = sincronización desactivada. En ambos
  // casos simplemente no hay archivo que cargar (sin error visible).
  if (res.status === 404 || res.status === 409) return null;
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Error al descargar el Excel de Análisis');
  }
  return res.arrayBuffer();
};
