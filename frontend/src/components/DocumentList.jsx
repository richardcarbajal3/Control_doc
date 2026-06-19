import { IMPORT_CONFIGS } from '../lib/importConfig';
import { buildOnedriveUrl } from '../lib/onedriveUrl';

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

export default function DocumentList({ documents, onEdit, onDelete, draggable = false, highlightClaimIds = [], onRowClick, onedriveBaseUrl }) {
  if (documents.length === 0) {
    return (
      <div className="empty-state">
        <p>No se encontraron documentos</p>
      </div>
    );
  }

  // When draggable, each row can be dropped onto a claim in the side panel.
  const onRowDragStart = (e, doc) => {
    e.dataTransfer.setData('text/plain', String(doc.id));
    e.dataTransfer.effectAllowed = 'link';
  };

  return (
    <div className="table-container doc-table-scroll">
      <table className="doc-table">
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
            <tr
              key={doc.id}
              className={[
                draggable ? 'doc-row-draggable' : '',
                onRowClick ? 'doc-row-clickable' : '',
                Array.isArray(doc.claim_ids) && doc.claim_ids.some((id) => highlightClaimIds.includes(id)) ? 'doc-row-highlight' : '',
              ].filter(Boolean).join(' ')}
              draggable={draggable || undefined}
              onDragStart={draggable ? (e) => onRowDragStart(e, doc) : undefined}
              onClick={onRowClick ? () => onRowClick(doc) : undefined}
            >
              {FIELDS.map((f) => {
                const text = formatValue(f, doc[f.key]);
                const cls = [
                  f.key === 'n_contrato' || f.key === 'documento_nro' ? 'code-cell' : '',
                  f.type === 'textarea' ? 'cell-truncate' : '',
                ].filter(Boolean).join(' ');
                return (
                  <td key={f.key} className={cls} title={text}>
                    {text}
                  </td>
                );
              })}
              <td className="actions-cell">
                {onedriveBaseUrl && doc.n_contrato && (
                  <a
                    href={doc.transmittal
                      ? buildOnedriveUrl(onedriveBaseUrl, doc.n_contrato, doc.status, doc.transmittal)
                      : buildOnedriveUrl(onedriveBaseUrl, doc.n_contrato)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-small btn-secondary"
                    title={doc.transmittal ? `Abrir carpeta: ${doc.transmittal}` : `Abrir carpeta contrato: ${doc.n_contrato}`}
                    onClick={(e) => e.stopPropagation()}
                  >📁</a>
                )}
                <button className="btn btn-small btn-edit" onClick={(e) => { e.stopPropagation(); onEdit(doc); }}>
                  Editar
                </button>
                <button className="btn btn-small btn-delete" onClick={(e) => { e.stopPropagation(); onDelete(doc); }}>
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
