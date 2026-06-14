const STATUS_COLORS = {
  'Borrador':    'badge-gray',
  'En Revisión': 'badge-amber',
  'Vigente':     'badge-green',
  'Obsoleto':    'badge-red',
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export default function DocumentList({ documents, onEdit, onDelete }) {
  if (documents.length === 0) {
    return <div className="empty-state"><p>No se encontraron documentos</p></div>;
  }

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Título</th>
            <th>Tipo</th>
            <th>Versión</th>
            <th>Estado</th>
            <th>Proyecto</th>
            <th>Contrato</th>
            <th>Actualizado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id}>
              <td className="code-cell">{doc.code}</td>
              <td>{doc.title}</td>
              <td>{doc.tipo || '—'}</td>
              <td className="center">{doc.version}</td>
              <td>
                <span className={`badge ${STATUS_COLORS[doc.status] || 'badge-gray'}`}>
                  {doc.status}
                </span>
              </td>
              <td>{doc.project_name || '—'}</td>
              <td>{doc.contract_titulo || '—'}</td>
              <td className="center">{fmt(doc.updated_at)}</td>
              <td className="actions">
                <button className="btn btn-small btn-edit" onClick={() => onEdit(doc)}>Editar</button>
                <button className="btn btn-small btn-delete" onClick={() => onDelete(doc)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
