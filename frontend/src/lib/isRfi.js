// A document is an RFI when its document code (documento_nro) contains the
// substring "RFI" (case-insensitive). The tipo_doc field is checked as a
// secondary fallback for records explicitly tagged that way.
export function isRfiDoc(doc) {
  if (!doc) return false;
  if ((doc.documento_nro || '').toUpperCase().includes('RFI')) return true;
  if ((doc.descripcion || '').toUpperCase().includes('RFI')) return true;
  return (doc.tipo_doc || '').toUpperCase().trim() === 'RFI';
}
