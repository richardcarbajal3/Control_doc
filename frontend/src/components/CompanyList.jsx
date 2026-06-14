const ESTADO_COLORS = { 'Activa': 'badge-green', 'Inactiva': 'badge-red' };

export default function CompanyList({ companies, onEdit, onDelete }) {
  if (companies.length === 0) {
    return <div className="empty-state">No hay empresas registradas.</div>;
  }
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>RUC</th>
            <th>Razón Social</th>
            <th>Nombre Comercial</th>
            <th>Tipo</th>
            <th>País</th>
            <th>Email</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c.id}>
              <td>{c.ruc}</td>
              <td>{c.razon_social}</td>
              <td>{c.nombre_comercial || '—'}</td>
              <td>{c.tipo}</td>
              <td>{c.pais}</td>
              <td>{c.email_contacto || '—'}</td>
              <td><span className={`badge ${ESTADO_COLORS[c.estado] || 'badge-gray'}`}>{c.estado}</span></td>
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
