import { buildOnedriveUrl } from '../lib/onedriveUrl';

// Status values follow CONTRACT_MODEL_V1 (English). Labels stay in Spanish for UX.
const STATUS_META = {
  'Draft':         { label: 'Borrador',        cls: 'badge-gray' },
  'Active':        { label: 'Vigente',         cls: 'badge-green' },
  'In Settlement': { label: 'En Liquidación',  cls: 'badge-amber' },
  'Closed':        { label: 'Cerrado',         cls: 'badge-red' },
  'Terminated':    { label: 'Rescindido',      cls: 'badge-red' },
};
const TYPE_LABELS = {
  'Work': 'Obra',
  'Service': 'Servicio',
  'Supply': 'Suministro',
  'Maintenance': 'Mantenimiento',
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('es-PE') : '—';
const fmtMonto = (m, currency) => m != null ? `${currency} ${Number(m).toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : '—';

export default function ContractList({ contracts, onEdit, onDelete, onManageRoles, onedriveBaseUrl }) {
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
          {contracts.map((c) => {
            const status = STATUS_META[c.status] || { label: c.status, cls: 'badge-gray' };
            return (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>{c.title}</td>
                <td>{TYPE_LABELS[c.type] || c.type}</td>
                <td>{c.project_name || '—'}</td>
                <td>{c.contractor_name || '—'}</td>
                <td>{c.mandante_name || '—'}</td>
                <td>{fmtMonto(c.amount, c.currency)}</td>
                <td>{fmt(c.start_date)}</td>
                <td>{fmt(c.end_date)}</td>
                <td><span className={`badge ${status.cls}`}>{status.label}</span></td>
                <td className="actions">
                  {onedriveBaseUrl && (
                    <a
                      href={buildOnedriveUrl(onedriveBaseUrl, c.code)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-small btn-secondary"
                      title={`Abrir carpeta OneDrive: ${c.code}`}
                    >📁</a>
                  )}
                  {onManageRoles && (
                    <button className="btn btn-small btn-secondary" onClick={() => onManageRoles(c)}>Roles</button>
                  )}
                  <button className="btn btn-small btn-edit" onClick={() => onEdit(c)}>Editar</button>
                  <button className="btn btn-small btn-delete" onClick={() => onDelete(c)}>Eliminar</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
