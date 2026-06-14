const ESTADO_COLORS = {
  'Planificación': 'badge-gray',
  'En Ejecución': 'badge-green',
  'Cerrado': 'badge-red',
  'Suspendido': 'badge-amber',
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('es-PE') : '—';

export default function ProjectList({ projects, onEdit, onDelete }) {
  if (projects.length === 0) {
    return <div className="empty-state">No hay proyectos registrados.</div>;
  }
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Ubicación</th>
            <th>Empresa Mandante</th>
            <th>Inicio</th>
            <th>Fin</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id}>
              <td>{p.code}</td>
              <td>{p.name}</td>
              <td>{p.tipo}</td>
              <td>{p.ubicacion || '—'}</td>
              <td>{p.company_name || '—'}</td>
              <td>{fmt(p.fecha_inicio)}</td>
              <td>{fmt(p.fecha_fin)}</td>
              <td><span className={`badge ${ESTADO_COLORS[p.estado] || 'badge-gray'}`}>{p.estado}</span></td>
              <td className="actions">
                <button className="btn btn-small btn-edit" onClick={() => onEdit(p)}>Editar</button>
                <button className="btn btn-small btn-delete" onClick={() => onDelete(p)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
