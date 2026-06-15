import { CLAIM_STATUS_COLORS } from '../lib/claimOptions';

export default function ClaimList({ claims, onEdit, onDelete, onOpen }) {
  if (claims.length === 0) {
    return (
      <div className="empty-state">
        <p>No hay claims registrados</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Título</th>
            <th>Tipo</th>
            <th>N° Contrato</th>
            <th>Estado</th>
            <th className="center">Docs</th>
            <th className="center">Pendientes</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((c) => (
            <tr key={c.id}>
              <td className="code-cell">{c.code || `#${c.id}`}</td>
              <td>
                <button className="link-btn" onClick={() => onOpen(c)}>{c.title}</button>
              </td>
              <td>{c.type}</td>
              <td>{c.n_contrato}</td>
              <td>
                <span className="badge" style={{ backgroundColor: CLAIM_STATUS_COLORS[c.status] || '#6b7280' }}>
                  {c.status}
                </span>
              </td>
              <td className="center">{c.doc_count}</td>
              <td className="center">
                {Number(c.pendientes) > 0
                  ? <span className="pill pill-warn">{c.pendientes}</span>
                  : <span className="pill pill-ok">0</span>}
              </td>
              <td className="actions-cell">
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
