// Documentos que SÍ requieren seguimiento en la vista Planos & Procedimientos.
//
// Como los códigos aún no están del todo uniformes, en vez de buscar tipos
// específicos incluimos TODO excepto los documentos "informativo" (y sus
// variaciones), que son solo para información y no requieren seguimiento.
// Los RFI tienen su propia vista y se excluyen aquí.
import { isRfiDoc } from './isRfi';

// "informativo", "informativa", "información", "informacion", "for information"…
const INFORMATIVO_RE = /INFORMAT|INFORMAC/;

export function isPlanoDoc(doc) {
  if (!doc) return false;
  if (isRfiDoc(doc)) return false;
  // El carácter "informativo" se marca en el tipo o estatus del documento.
  const hay = `${doc.tipo_doc || ''} ${doc.status_contratista || ''}`.toUpperCase();
  if (INFORMATIVO_RE.test(hay)) return false;
  return true;
}
