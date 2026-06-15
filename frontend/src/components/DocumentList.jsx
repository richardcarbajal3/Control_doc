import { IMPORT_CONFIGS } from '../lib/importConfig';

const FIELDS = IMPORT_CONFIGS.documents.fields;

function formatValue(field, value) {
  if (value == null || value === '') return '';
  if (field.type === 'date') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' });
    }
  }
  return String(value);
}

export default function DocumentList({ documents, onEdit, onDelete }) {
  if (documents.length === 0) {
    return (
      <div className="empty-state">
        <p>No se encontraron documentos</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {FIELDS.map((f) => (
              <th key={f.key}>{f.label}</th>
            ))}
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id}>
              {FIELDS.map((f) => (
                <td key={f.key} className={f.key === 'n_contrato' || f.key === 'documento_nro' ? 'code-cell' : ''}>
                  {formatValue(f, doc[f.key])}
                </td>
              ))}
              <td className="actions-cell">
                <button className="btn btn-small btn-edit" onClick={() => onEdit(doc)}>
                  Editar
                </button>
                <button className="btn btn-small btn-delete" onClick={() => onDelete(doc)}>
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
