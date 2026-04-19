const STATUS_COLORS = {
  'Borrador': '#6b7280',
  'En Revisión': '#f59e0b',
  'Vigente': '#10b981',
  'Obsoleto': '#ef4444',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-PE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function DocumentList({ documents, onEdit, onDelete }) {
  if (documents.length === 0) {
    return (
      <div className="empty-state">
        <p>No se encontraron documentos</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Título</th>
            <th>Versión</th>
            <th>Estado</th>
            <th>Disciplina</th>
            <th>Tipo</th>
            <th>Responsable</th>
            <th>Fecha Emisión</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id}>
              <td className="code-cell">{doc.code}</td>
              <td title={doc.notes || ''}>{doc.title}</td>
              <td className="center">{doc.version}</td>
              <td>
                <span
                  className="badge"
                  style={{ backgroundColor: STATUS_COLORS[doc.status] || '#6b7280' }}
                >
                  {doc.status}
                </span>
              </td>
              <td>{doc.discipline || '—'}</td>
              <td>{doc.type || '—'}</td>
              <td>{doc.responsible || '—'}</td>
              <td className="center">{formatDate(doc.issue_date)}</td>
              <td className="actions-cell">
                <button className="btn btn-small btn-edit" onClick={() => onEdit(doc)}>
                  Editar
                </button>
                <button className="btn btn-small btn-delete" onClick={() => onDelete(doc)}>
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
