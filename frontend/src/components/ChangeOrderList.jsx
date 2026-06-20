const STATUS_CLASSES = {
  'Borrador': 'pill-info',
  'En negociación': 'pill-warn',
  'Aprobada': 'pill-ok',
  'Rechazada': 'pill-danger',
};

const fmtMonto = (v, cur) => {
  if (v == null || v === '') return '—';
  return `${cur || 'USD'} ${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
};

export default function ChangeOrderList({ changeOrders, onEdit, onDelete, onOpen }) {
  if (!changeOrders.length) {
    return <div className="empty-state"><p>No hay órdenes de cambio</p></div>;
  }

  return (
    <div className="doc-table-scroll">
      <table className="doc-table">
        <thead>
          <tr>
            <th>CÓDIGO</th>
            <th>TÍTULO</th>
            <th>N° CONTRATO</th>
            <th>MONTO SOLICITADO</th>
            <th>MONTO APROBADO</th>
            <th>ESTADO</th>
            <th>DOCS</th>
            <th>ACCIONES</th>
          </tr>
        </thead>
        <tbody>
          {changeOrders.map((co) => (
            <tr key={co.id} className="doc-row-clickable" onClick={() => onOpen?.(co)}>
              <td className="code-cell">{co.code || '—'}</td>
              <td>{co.title}</td>
              <td className="code-cell">{co.n_contrato || '—'}</td>
              <td>{fmtMonto(co.monto_solicitado, co.currency)}</td>
              <td>{fmtMonto(co.monto_aprobado, co.currency)}</td>
              <td>
                <span className={`pill ${STATUS_CLASSES[co.status] || 'pill-info'}`}>{co.status}</span>
              </td>
              <td style={{ textAlign: 'center' }}>{co.doc_count || 0}</td>
              <td className="actions-cell">
                <button className="btn btn-small btn-edit"
                  onClick={(e) => { e.stopPropagation(); onEdit(co); }}>
                  Editar
                </button>
                <button className="btn btn-small btn-delete"
                  onClick={(e) => { e.stopPropagation(); onDelete(co); }}>
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
