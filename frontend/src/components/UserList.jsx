const ROLE_LABELS = { superadmin: 'Superadmin', admin: 'Admin', member: 'Miembro' };
const ROLE_COLORS = { superadmin: '#7c3aed', admin: '#2563eb', member: '#6b7280' };

export default function UserList({ users, currentUser, onEdit, onDelete }) {
  if (users.length === 0) {
    return <div className="empty-state"><p>No hay usuarios</p></div>;
  }
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Correo</th><th>Nombre</th><th>Rol</th><th className="center">Estado</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="code-cell">{u.email}</td>
              <td>{u.full_name}</td>
              <td>
                <span className="badge" style={{ backgroundColor: ROLE_COLORS[u.role] || '#6b7280' }}>
                  {ROLE_LABELS[u.role] || u.role}
                </span>
              </td>
              <td className="center">
                {u.is_active
                  ? <span className="pill pill-ok">activo</span>
                  : <span className="pill pill-warn">inactivo</span>}
              </td>
              <td className="actions-cell">
                <button className="btn btn-small btn-edit" onClick={() => onEdit(u)}>Editar</button>
                {u.id !== currentUser.id && (
                  <button className="btn btn-small btn-delete" onClick={() => onDelete(u)}>Eliminar</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
