// A document is a "Plano o Procedimiento" — a revision-controlled deliverable —
// when its type, code or description references a plano (drawing) or a
// procedimiento (procedure). RFIs are excluded: they have their own journey.
import { isRfiDoc } from './isRfi';

export function isPlanoDoc(doc) {
  if (!doc) return false;
  if (isRfiDoc(doc)) return false;
  const hay = `${doc.tipo_doc || ''} ${doc.documento_nro || ''} ${doc.descripcion || ''}`.toUpperCase();
  return /PLANO|PROCEDIM/.test(hay);
}
