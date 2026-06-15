import { useState } from 'react';
import { parseMatrix } from '../lib/parseTable';
import { bulkImport } from '../api/bulk';

// SAP-style paste grid: fixed columns (the module's fields). Paste rows from
// Excel and they fill the grid positionally. Columns pasted beyond the fixed
// set are kept as "extra" and saved into extra_data.
export default function PasteGrid({ resource, config, onClose, onDone }) {
  const fields = config.fields;
  const fixedCount = fields.length;

  const [hasHeader, setHasHeader] = useState(true);
  const [rows, setRows] = useState([]);            // array of arrays of strings
  const [extraHeaders, setExtraHeaders] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const totalCols = fixedCount + extraHeaders.length;

  const ingest = (text) => {
    const matrix = parseMatrix(text);
    if (matrix.length === 0) return;
    let header = null;
    let body = matrix;
    if (hasHeader && matrix.length > 1) { header = matrix[0]; body = matrix.slice(1); }

    const maxCols = Math.max(fixedCount, ...matrix.map((r) => r.length));
    const eh = [];
    for (let c = fixedCount; c < maxCols; c++) {
      const name = header && header[c] && header[c].trim() ? header[c].trim() : `Extra ${c - fixedCount + 1}`;
      eh.push(name);
    }
    const norm = body
      .map((r) => Array.from({ length: maxCols }, (_, c) => (r[c] ?? '').trim()))
      .filter((r) => r.some((c) => c !== ''));

    setExtraHeaders(eh);
    setRows(norm);
    setResult(null);
    setError('');
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    ingest(text);
  };

  const setCell = (ri, ci, val) =>
    setRows((rs) => rs.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? val : c)) : r)));
  const addRow = () => setRows((rs) => [...rs, Array(totalCols).fill('')]);
  const removeRow = (ri) => setRows((rs) => rs.filter((_, i) => i !== ri));
  const clearAll = () => { setRows([]); setExtraHeaders([]); setResult(null); setError(''); };

  const buildPayload = () =>
    rows.map((r) => {
      const obj = {};
      fields.forEach((f, i) => {
        const v = (r[i] ?? '').trim();
        if (v !== '') obj[f.key] = v;
      });
      const extra = {};
      extraHeaders.forEach((h, i) => {
        const v = (r[fixedCount + i] ?? '').trim();
        if (v !== '') extra[h] = v;
      });
      if (Object.keys(extra).length) obj.extra_data = extra;
      return obj;
    });

  const doImport = async () => {
    setImporting(true);
    setError('');
    setResult(null);
    try {
      const res = await bulkImport(resource, buildPayload());
      setResult(res);
      if (res.inserted > 0) onDone?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-import" onClick={(e) => e.stopPropagation()}>
        <h2>Pegar desde Excel — {config.label}</h2>
        <p className="import-help">
          Copia las filas en Excel (en el orden de las columnas de abajo) y pega con{' '}
          <kbd>Ctrl</kbd>+<kbd>V</kbd>. Las columnas que sobren se guardan igual como datos extra.
        </p>
        <label className="import-check">
          <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
          Mi selección incluye la fila de encabezados
        </label>

        <div className="order-guide">
          <span className="order-guide-title">Pega tus columnas en este orden:</span>
          <ol className="order-guide-list">
            {fields.map((f) => (
              <li key={f.key}>
                {f.label}
                {f.required && <span className="req">*</span>}
              </li>
            ))}
          </ol>
        </div>

        <div className="paste-zone" tabIndex={0} onPaste={handlePaste}>
          {rows.length === 0 ? (
            <span className="paste-placeholder">Haz clic aquí y pega (Ctrl+V)…</span>
          ) : (
            <span className="paste-info">
              {rows.length} fila(s) · {totalCols} columna(s)
              {extraHeaders.length ? ` · ${extraHeaders.length} extra` : ''} — pega de nuevo para reemplazar
            </span>
          )}
        </div>

        {rows.length > 0 && (
          <>
            <div className="grid-scroll">
              <table className="paste-table">
                <thead>
                  <tr>
                    <th className="rownum">#</th>
                    {fields.map((f) => (
                      <th key={f.key}>
                        {f.label}
                        {f.required && <span className="req">*</span>}
                      </th>
                    ))}
                    {extraHeaders.map((h, i) => (
                      <th key={`e${i}`} className="extra-col">
                        {h} <span className="extra-tag">extra</span>
                      </th>
                    ))}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, ri) => (
                    <tr key={ri}>
                      <td className="rownum">{ri + 1}</td>
                      {Array.from({ length: totalCols }).map((_, ci) => (
                        <td key={ci} className={ci >= fixedCount ? 'extra-col' : ''}>
                          <input value={r[ci] ?? ''} onChange={(e) => setCell(ri, ci, e.target.value)} />
                        </td>
                      ))}
                      <td>
                        <button className="btn btn-small btn-delete" onClick={() => removeRow(ri)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid-tools">
              <button className="btn btn-secondary btn-small" onClick={addRow}>+ Fila</button>
              <button className="btn btn-secondary btn-small" onClick={clearAll}>Limpiar</button>
            </div>
          </>
        )}

        {error && <div className="form-error">{error}</div>}
        {result && (
          <div className={`import-result ${result.failed ? 'has-errors' : 'ok'}`}>
            <strong>✓ {result.inserted} creado(s)</strong>
            {result.failed ? ` · ✗ ${result.failed} con error` : ''}
            {result.errors?.length > 0 && (
              <ul>
                {result.errors.slice(0, 10).map((er, i) => (
                  <li key={i}>Fila {er.row}: {er.error}</li>
                ))}
                {result.errors.length > 10 && <li>… y {result.errors.length - 10} más</li>}
              </ul>
            )}
          </div>
        )}

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary" onClick={doImport} disabled={importing || rows.length === 0}>
            {importing ? 'Importando…' : `Importar ${rows.length} fila(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
