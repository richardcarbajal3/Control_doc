// A document is an RFI when its document code (documento_nro) contains the
// substring "RFI" (case-insensitive). The tipo_doc field is checked as a
// secondary fallback for records explicitly tagged that way.
export function isRfiDoc(doc) {
  if (!doc) return false;
  const code = (doc.documento_nro || '').toUpperCase();
  if (code.includes('RFI')) return true;
  const tipo = (doc.tipo_doc || '').toUpperCase().trim();
  return tipo === 'RFI';
}
