const ESTADO_COLORS = {
  'Borrador': 'badge-gray',
  'Vigente': 'badge-green',
  'En Liquidación': 'badge-amber',
  'Cerrado': 'badge-red',
  'Rescindido': 'badge-red',
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('es-PE') : '—';
const fmtMonto = (m, moneda) => m != null ? `${moneda} ${Number(m).toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : '—';

export default function ContractList({ contracts, onEdit, onDelete }) {
  if (contracts.length === 0) {
    return <div className="empty-state">No hay contratos registrados.</div>;
  }
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Título</th>
            <th>Tipo</th>
            <th>Proyecto</th>
            <th>Contratista</th>
            <th>Mandante</th>
            <th>Monto</th>
            <th>Inicio</th>
            <th>Fin</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c) => (
            <tr key={c.id}>
              <td>{c.code}</td>
              <td>{c.titulo}</td>
              <td>{c.tipo}</td>
              <td>{c.project_name || '—'}</td>
              <td>{c.contratista_name || '—'}</td>
              <td>{c.mandante_name || '—'}</td>
              <td>{fmtMonto(c.monto_original, c.moneda)}</td>
              <td>{fmt(c.fecha_inicio)}</td>
              <td>{fmt(c.fecha_fin)}</td>
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
