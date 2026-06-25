// Planos & Procedimientos journey grouping.
//
// Revision-controlled deliverables (drawings and procedures) are tracked much
// like RFIs, but the keys differ:
//   · documento_nro → la base (root) que agrupa todas las revisiones
//   · rev           → 2.ª llave: cada revisión es su propia línea de seguimiento
//   · status_contratista (ESTATUS DE DOCUMENTO) → 3.ª llave: el estado de
//     aprobación del documento para esa revisión
//
// Cuando se emite una nueva revisión el número de documento sigue agrupando las
// filas, pero el recorrido pasa a tener 2 (o más) líneas. La revisión que
// *manda* es la mayor. El orden de menor → mayor es: primero letras
// (A < B < C …) y luego números (0 < 1 < 2 … de 0 hacia arriba).

import { isPlanoDoc } from './isPlano';

const norm = (s) => (s == null ? '' : String(s)).toUpperCase().trim();

// Root key: el número de documento ata todas las revisiones; si falta cae a la
// referencia y finalmente al id.
export function planoRootKey(doc) {
  return norm(doc.documento_nro) || norm(doc.referencia) || `#${doc.id}`;
}

// Ordena una revisión de modo que las letras quedan por debajo de los números:
//   (vacío) < A < B < … < Z < 0 < 1 < 2 … (los números crecen sin límite)
// Las letras mapean a 1..n; los números mapean a 1000 + valor para que siempre
// superen a las letras.
export function revRank(rev) {
  const r = norm(rev);
  if (r === '') return -1;
  if (/^\d+$/.test(r)) return 1000 + parseInt(r, 10);
  let rank = 0;
  for (const ch of r) {
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90) rank = rank * 26 + (c - 64); // A=1, B=2 …
  }
  return rank > 0 ? rank : 0;
}

// Estado de aprobación de una sola revisión, según ESTATUS DE DOCUMENTO.
//   APROBADO           → aprobado (cerrado / verde)
//   CON OBSERVACIONES  → aprobado con comentarios
//   ANULADO            → anulado
//   cualquier otro / — → pendiente (aún no aprobado)
export function planoRevEstado(doc) {
  const s = norm(doc?.status_contratista);
  if (s === 'APROBADO') return 'aprobado';
  if (s.includes('OBSERV') || s.includes('COMENTARIO')) return 'observaciones';
  if (s === 'ANULADO') return 'anulado';
  return 'pendiente';
}

function fechaTime(d) {
  if (!d || !d.fecha) return Number.NEGATIVE_INFINITY;
  const t = new Date(d.fecha).getTime();
  return isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

// Construye un recorrido a partir de las revisiones que comparten una base.
function buildJourney(key, docs) {
  // Revisiones de menor → mayor; los empates se rompen por fecha.
  const sorted = [...docs].sort((a, b) => {
    const dr = revRank(a.rev) - revRank(b.rev);
    return dr !== 0 ? dr : fechaTime(a) - fechaTime(b);
  });

  const primera = sorted[0];
  const controla = sorted[sorted.length - 1]; // la revisión mayor manda
  const estado = planoRevEstado(controla);

  return {
    key,
    root: controla.documento_nro || primera.documento_nro || '',
    descripcion: controla.descripcion || primera.descripcion || '',
    n_contrato: controla.n_contrato || primera.n_contrato || '',
    empresa: controla.empresa || primera.empresa || '',
    responsable: controla.responsable || primera.responsable || '',
    docs: sorted,
    primera,
    controla,
    revisiones: sorted.length,
    estado,
  };
}

// Agrupa los documentos de planos/procedimientos en recorridos (uno por base).
// Orden: pendientes primero, luego con observaciones, aprobados y anulados;
// dentro de cada grupo, por revisión que controla más reciente.
export function groupPlanoJourneys(documents) {
  const groups = new Map();
  for (const doc of documents) {
    if (!isPlanoDoc(doc)) continue;
    const key = planoRootKey(doc);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }

  const journeys = [...groups.entries()].map(([key, docs]) => buildJourney(key, docs));

  const order = { pendiente: 0, observaciones: 1, aprobado: 2, anulado: 3 };
  return journeys.sort((a, b) => {
    const oa = order[a.estado] ?? 9;
    const ob = order[b.estado] ?? 9;
    if (oa !== ob) return oa - ob;
    return fechaTime(b.controla) - fechaTime(a.controla);
  });
}
