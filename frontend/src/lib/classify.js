// Applies classification rules to documents, deriving a virtual `familia` field.
// Rules are evaluated in two passes: first 'codigo' rules (against documento_nro),
// then 'descripcion' rules (against descripcion). Within each pass, lower priority
// number wins. First match wins.

export function classifyDoc(doc, rules) {
  const run = (source, field) => {
    const sorted = rules
      .filter((r) => r.source === source)
      .sort((a, b) => a.priority - b.priority);
    const text = (doc[field] || '').toUpperCase();
    for (const r of sorted) {
      if (text.includes(r.pattern.toUpperCase())) return r.familia;
    }
    return null;
  };

  return run('codigo', 'documento_nro') || run('descripcion', 'descripcion') || null;
}

export function applyClassification(docs, rules) {
  if (!rules || !rules.length) return docs;
  return docs.map((d) => ({ ...d, familia: classifyDoc(d, rules) || 'Sin clasificar' }));
}
