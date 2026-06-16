const STATUS_COLORS = { active: '#10b981', suspended: '#ef4444' };

export default function OrgList({ organizations, onEdit, onDelete, onAssignAdmin }) {
  if (organizations.length === 0) {
    return <div className="empty-state"><p>No hay organizaciones (clientes). Crea la primera.</p></div>;
  }
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Cliente</th><th>Plan</th><th>Estado</th>
            <th className="center">Usuarios</th><th className="center">Admins</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {organizations.map((o) => (
            <tr key={o.id}>
              <td className="code-cell">{o.name}</td>
              <td>{o.plan || '—'}</td>
              <td>
                <span className="badge" style={{ backgroundColor: STATUS_COLORS[o.status] || '#6b7280' }}>
                  {o.status}
                </span>
              </td>
              <td className="center">{o.member_count}</td>
              <td className="center">
                {Number(o.admin_count) > 0
                  ? <span className="pill pill-ok">{o.admin_count}</span>
                  : <span className="pill pill-warn">0</span>}
              </td>
              <td className="actions-cell">
                <button className="btn btn-small btn-primary" onClick={() => onAssignAdmin(o)}>Asignar admin</button>
                <button className="btn btn-small btn-edit" onClick={() => onEdit(o)}>Editar</button>
                <button className="btn btn-small btn-delete" onClick={() => onDelete(o)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
