import { useState, useEffect, useMemo } from 'react';
import { getDocuments } from '../api/documents';
import { getCompanies } from '../api/companies';
import { getProjects } from '../api/projects';
import { getContracts } from '../api/contracts';
import { IMPORT_CONFIGS } from '../lib/importConfig';

const SOURCES = [
  { key: 'documents', label: 'Documentos', fetch: getDocuments },
  { key: 'contracts', label: 'Contratos', fetch: getContracts },
  { key: 'companies', label: 'Empresas', fetch: getCompanies },
  { key: 'projects', label: 'Proyectos', fetch: getProjects },
];

// Internal/derived columns we don't want as their own report columns.
const HIDDEN = new Set(['extra_data']);

function formatCell(v) {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  // ISO timestamps -> short date
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  return s;
}

export default function ReportView() {
  const [source, setSource] = useState('documents');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const src = SOURCES.find((s) => s.key === source);
    src.fetch('')
      .then((data) => { if (alive) setRows(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [source]);

  // Build columns: the module's fixed fields (ordered, labeled) when defined,
  // otherwise auto-derived from the rows; plus a column per extra_data key.
  const { baseCols, extraCols, flatRows } = useMemo(() => {
    const cfg = IMPORT_CONFIGS[source];
    let base;
    if (cfg) {
      base = cfg.fields.map((f) => ({ key: f.key, label: f.label }));
    } else {
      const seen = new Set();
      base = [];
      rows.forEach((r) => {
        Object.keys(r).forEach((k) => {
          if (!HIDDEN.has(k) && !seen.has(k)) { seen.add(k); base.push({ key: k, label: k }); }
        });
      });
    }
    const extra = [];
    const extraSeen = new Set();
    rows.forEach((r) => {
      const ed = r.extra_data;
      if (ed && typeof ed === 'object') {
        Object.keys(ed).forEach((k) => {
          if (!extraSeen.has(k)) { extraSeen.add(k); extra.push(k); }
        });
      }
    });
    const flat = rows.map((r) => {
      const out = {};
      base.forEach((c) => { out[c.key] = formatCell(r[c.key]); });
      extra.forEach((c) => { out[`x:${c}`] = formatCell(r.extra_data?.[c]); });
      return out;
    });
    return { baseCols: base, extraCols: extra, flatRows: flat };
  }, [rows, source]);

  const allKeys = useMemo(
    () => [...baseCols.map((c) => c.key), ...extraCols.map((c) => `x:${c}`)],
    [baseCols, extraCols]
  );

  const filtered = useMemo(() => {
    if (!filter.trim()) return flatRows;
    const f = filter.toLowerCase();
    return flatRows.filter((r) => allKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(f)));
  }, [flatRows, filter, allKeys]);

  const downloadCsv = () => {
    const headers = [...baseCols.map((c) => c.label), ...extraCols];
    const esc = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.map(esc).join(',')];
    filtered.forEach((r) => lines.push(allKeys.map((k) => esc(r[k])).join(',')));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_${source}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="report">
      <div className="report-controls">
        <div className="report-tabs">
          {SOURCES.map((s) => (
            <button
              key={s.key}
              className={`chip ${source === s.key ? 'chip-active' : ''}`}
              onClick={() => { setSource(s.key); setFilter(''); }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <input
          className="search-input"
          placeholder="Filtrar en todo el reporte…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button className="btn btn-secondary" onClick={downloadCsv} disabled={filtered.length === 0}>
          ⬇ CSV
        </button>
      </div>

      <div className="report-summary">
        {loading ? 'Cargando…' : `${filtered.length} registro(s)`}
        {!loading && extraCols.length > 0 && ` · ${extraCols.length} columna(s) extra`}
      </div>

      {loading ? (
        <div className="loading">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><p>No hay datos para mostrar</p></div>
      ) : (
        <div className="table-container report-scroll">
          <table>
            <thead>
              <tr>
                {baseCols.map((c) => <th key={c.key}>{c.label}</th>)}
                {extraCols.map((c) => <th key={`x${c}`} className="extra-col">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i}>
                  {baseCols.map((c) => <td key={c.key}>{r[c.key]}</td>)}
                  {extraCols.map((c) => <td key={`x${c}`} className="extra-col">{r[`x:${c}`]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
