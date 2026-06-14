const STATUS_COLORS = {
  'Pendiente': 'badge-amber',
  'Respondida': 'badge-green',
  'Archivada': 'badge-gray',
  'Vencida': 'badge-red',
};

const DIR_COLORS = {
  'Entrante': 'badge-blue',
  'Saliente': 'badge-purple',
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('es-PE') : '—';

export default function CorrespondenceList({ items, onEdit, onDelete }) {
  if (items.length === 0) {
    return <div className="empty-state">No hay correspondencia registrada.</div>;
  }
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Asunto</th>
            <th>Tipo</th>
            <th>Dirección</th>
            <th>Proyecto</th>
            <th>Remitente</th>
            <th>Destinatario</th>
            <th>Emisión</th>
            <th>Vencimiento</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>{c.code}</td>
              <td>{c.subject}</td>
              <td>{c.correspondence_type}</td>
              <td>
                <span className={`badge ${DIR_COLORS[c.direction] || 'badge-gray'}`}>
                  {c.direction}
                </span>
              </td>
              <td>{c.project_name || '—'}</td>
              <td>{c.sender_name || '—'}</td>
              <td>{c.receiver_name || '—'}</td>
              <td>{fmt(c.issue_date)}</td>
              <td>{fmt(c.due_date)}</td>
              <td>
                <span className={`badge ${STATUS_COLORS[c.status] || 'badge-gray'}`}>
                  {c.status}
                </span>
              </td>
              <td className="actions">
                <button className="btn btn-small btn-edit" onClick={() => onEdit(c)}>Editar</button>
                <button className="btn btn-small btn-delete" onClick={() => onDelete(c)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
