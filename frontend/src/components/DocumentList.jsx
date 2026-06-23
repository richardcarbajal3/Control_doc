import { IMPORT_CONFIGS } from '../lib/importConfig';
import { buildOnedriveUrl } from '../lib/onedriveUrl';
import { isRfiDoc } from '../lib/isRfi';
import { useColumnWidths } from '../lib/useColumnWidths';

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

function abbrevText(text, n) {
  if (!text || text.length <= n) return text;
  return text.slice(0, n) + '…';
}

// Computes RFI status badge for rows where tipo_doc === 'RFI'.
function rfiStatusBadge(doc) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const vence = doc.fecha_vencimiento ? new Date(doc.fecha_vencimiento) : null;
  const respondido = doc.fecha_respuesta ? new Date(doc.fecha_respuesta) : null;

  if (respondido) {
    if (vence && respondido > vence)
      return <span className="pill pill-warn rfi-badge" title="Respondido fuera de plazo">RFI · Resp. tarde</span>;
    return <span className="pill pill-ok rfi-badge" title="Respondido a tiempo">RFI · Respondido</span>;
  }
  if (vence && hoy > vence)
    return <span className="pill pill-danger rfi-badge" title="Vencido sin respuesta">RFI · Vencido</span>;
  if (vence) {
    const diff = Math.ceil((vence - hoy) / 86400000);
    if (diff <= 3)
      return <span className="pill pill-warn rfi-badge" title={`Vence en ${diff} día(s)`}>RFI · {diff}d</span>;
  }
  return <span className="pill pill-info rfi-badge" title="Pendiente de respuesta">RFI · Pendiente</span>;
}

export default function DocumentList({ documents, onEdit, onDelete, draggable = false, highlightClaimIds = [], onRowClick, onedriveBaseUrl }) {
  const { widths, onResizeStart, resetColumn } = useColumnWidths('docTableColWidths', FIELDS);

  if (documents.length === 0) {
    return (
      <div className="empty-state">
        <p>No se encontraron documentos</p>
      </div>
    );
  }

  const onRowDragStart = (e, doc) => {
    e.dataTransfer.setData('text/plain', String(doc.id));
    e.dataTransfer.effectAllowed = 'link';
  };

  return (
    <div className="doc-table-scroll">
      <table className="doc-table">
        <colgroup>
          {FIELDS.map((f) => {
            const w = widths[f.key] || f.colWidth;
            return <col key={f.key} style={w ? { width: `${w}px` } : {}} />;
          })}
          <col style={{ width: '155px' }} />
        </colgroup>
        <thead>
          <tr>
            {FIELDS.map((f) => (
              <th key={f.key} title={f.label} className="resizable-th">
                <span className="th-label">{f.label}</span>
                <span
                  className="col-resizer"
                  onMouseDown={onResizeStart(f.key)}
                  onDoubleClick={() => resetColumn(f.key)}
                  onClick={(e) => e.stopPropagation()}
                  title="Arrastra para ajustar el ancho · doble clic para restablecer"
                />
              </th>
            ))}
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const isRfi = isRfiDoc(doc);
            return (
              <tr
                key={doc.id}
                className={[
                  draggable ? 'doc-row-draggable' : '',
                  onRowClick ? 'doc-row-clickable' : '',
                  Array.isArray(doc.claim_ids) && doc.claim_ids.some((id) => highlightClaimIds.includes(id)) ? 'doc-row-highlight' : '',
                  isRfi ? 'doc-row-rfi' : '',
                ].filter(Boolean).join(' ')}
                draggable={draggable || undefined}
                onDragStart={draggable ? (e) => onRowDragStart(e, doc) : undefined}
                onClick={onRowClick ? () => onRowClick(doc) : undefined}
              >
                {FIELDS.map((f) => {
                  const text = formatValue(f, doc[f.key]);
                  const display = f.abbrev ? abbrevText(text, f.abbrev) : text;
                  const cls = [
                    f.key === 'n_contrato' || f.key === 'documento_nro' ? 'code-cell' : '',
                    f.key === 'transmittal' ? 'transmittal-cell' : '',
                    f.rtl ? 'cell-rtl' : '',
                  ].filter(Boolean).join(' ') || undefined;
                  return (
                    <td key={f.key} className={cls} title={text}>
                      {f.rtl ? <span dir="ltr">{display}</span> : display}
                    </td>
                  );
                })}
                <td className="actions-cell">
                  {isRfi && rfiStatusBadge(doc)}
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

