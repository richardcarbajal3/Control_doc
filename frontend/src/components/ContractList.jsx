const STATUS_COLORS = {
  'Draft':         'badge-gray',
  'Active':        'badge-green',
  'In Settlement': 'badge-amber',
  'Closed':        'badge-red',
  'Terminated':    'badge-red',
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('es-PE') : '—';

const fmtAmount = (amount, currency) =>
  amount != null
    ? `${currency} ${Number(amount).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
    : '—';

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
              <td>{c.title}</td>
              <td>{c.type}</td>
              <td>{c.project_name || '—'}</td>
              <td>{c.contratista_name || '—'}</td>
              <td>{c.mandante_name || '—'}</td>
              <td>{fmtAmount(c.amount, c.currency)}</td>
              <td>{fmt(c.start_date)}</td>
              <td>{fmt(c.end_date)}</td>
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
