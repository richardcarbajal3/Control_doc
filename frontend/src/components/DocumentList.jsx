import { useRef, useEffect } from 'react';
import { IMPORT_CONFIGS } from '../lib/importConfig';
import { buildOnedriveUrl } from '../lib/onedriveUrl';

const FIELDS = IMPORT_CONFIGS.documents.fields;
const TABLE_MIN_WIDTH = 1450;

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

const colgroup = (
  <colgroup>
    {FIELDS.map((f) => (
      <col key={f.key} style={f.colWidth ? { width: `${f.colWidth}px` } : {}} />
    ))}
    <col style={{ width: '130px' }} />
  </colgroup>
);

export default function DocumentList({ documents, onEdit, onDelete, draggable = false, highlightClaimIds = [], onRowClick, onedriveBaseUrl }) {
  const headRef = useRef(null);
  const mirrorRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    const head = headRef.current;
    const mirror = mirrorRef.current;
    const body = bodyRef.current;
    if (!head || !mirror || !body) return;

    let busy = false;
    const sync = (x) => {
      if (busy) return;
      busy = true;
      head.scrollLeft = x;
      body.scrollLeft = x;
      mirror.scrollLeft = x;
      busy = false;
    };
    const onMirrorScroll = () => sync(mirror.scrollLeft);
    const onBodyScroll = () => sync(body.scrollLeft);

    mirror.addEventListener('scroll', onMirrorScroll);
    body.addEventListener('scroll', onBodyScroll);
    return () => {
      mirror.removeEventListener('scroll', onMirrorScroll);
      body.removeEventListener('scroll', onBodyScroll);
    };
  }, []);

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
    <div className="doc-table-outer">
      {/* Header — fijo, no scrollea verticalmente */}
      <div className="doc-thead-wrap" ref={headRef}>
        <table className="doc-table">
          {colgroup}
          <thead>
            <tr>
              {FIELDS.map((f) => (
                <th key={f.key} title={f.label}>{f.label}</th>
              ))}
              <th>Acciones</th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Barra de scroll horizontal — justo debajo de los títulos */}
      <div className="doc-h-mirror" ref={mirrorRef}>
        <div style={{ width: `${TABLE_MIN_WIDTH}px`, height: 1 }} />
      </div>

      {/* Cuerpo — scroll vertical, horizontal oculto (sincronizado con el mirror) */}
      <div className="doc-tbody-wrap" ref={bodyRef}>
        <table className="doc-table">
          {colgroup}
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
    </div>
  );
}
