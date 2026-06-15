import { useState, useEffect } from 'react';
import { getDocumentsReport } from '../api/reports';

function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function PresentationReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getDocumentsReport()
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const exportPendientes = () => {
    if (!data) return;
    const headers = ['DOCUMENTO NRO', 'DESCRIPCIÓN', 'RESPONSABLE', 'N° CONTRATO', 'FECHA', 'STATUS G', 'DÍAS ATRASO'];
    const esc = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.map(esc).join(',')];
    data.pendientes.forEach((p) => lines.push([
      p.documento_nro, p.descripcion, p.responsable, p.n_contrato,
      (p.fecha || '').slice(0, 10), p.status_g, p.dias_atraso ?? 0,
    ].map(esc).join(',')));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pendientes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="loading">Cargando reporte...</div>;
  if (error) return <div className="form-error">{error}</div>;
  if (!data) return null;

  const t = data.totals;

  return (
    <div className="presentation">
      <div className="kpi-row">
        <div className="kpi-card"><span className="kpi-value">{t.total}</span><span className="kpi-label">Documentos</span></div>
        <div className="kpi-card kpi-warn"><span className="kpi-value">{t.pendientes}</span><span className="kpi-label">Pendientes</span></div>
        <div className="kpi-card kpi-danger"><span className="kpi-value">{t.atrasados}</span><span className="kpi-label">Atrasados (&gt; {data.sla_days} d)</span></div>
        <div className="kpi-card kpi-ok"><span className="kpi-value">{t.atendidos}</span><span className="kpi-label">Atendidos</span></div>
        <div className="kpi-card"><span className="kpi-value">{t.max_atraso}</span><span className="kpi-label">Máx. días atraso</span></div>
      </div>

      <div className="report-grid">
        <div>
          <h3 className="section-title">Pendientes por responsable</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Responsable</th><th className="center">Pendientes</th><th className="center">Atrasados</th><th className="center">Máx. atraso</th></tr>
              </thead>
              <tbody>
                {data.byResponsable.length === 0 ? (
                  <tr><td colSpan={4} className="center">Sin pendientes 🎉</td></tr>
                ) : data.byResponsable.map((r, i) => (
                  <tr key={i}>
                    <td>{r.responsable}</td>
                    <td className="center">{r.pendientes}</td>
                    <td className="center">{Number(r.atrasados) > 0 ? <span className="pill pill-warn">{r.atrasados}</span> : '0'}</td>
                    <td className="center">{r.max_atraso} d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="section-title">Por estado (STATUS G)</h3>
          <div className="table-container">
            <table>
              <thead><tr><th>STATUS G</th><th className="center">Cantidad</th></tr></thead>
              <tbody>
                {data.byStatusG.map((s, i) => (
                  <tr key={i}><td>{s.status_g}</td><td className="center">{s.count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="section-head">
            <h3 className="section-title">Pendientes por días de atraso</h3>
            <button className="btn btn-secondary btn-small" onClick={exportPendientes} disabled={data.pendientes.length === 0}>⬇ CSV</button>
          </div>
          <div className="table-container report-scroll">
            <table>
              <thead>
                <tr><th>DOCUMENTO NRO</th><th>DESCRIPCIÓN</th><th>RESPONSABLE</th><th>FECHA</th><th className="center">DÍAS ATRASO</th></tr>
              </thead>
              <tbody>
                {data.pendientes.length === 0 ? (
                  <tr><td colSpan={5} className="center">Sin pendientes 🎉</td></tr>
                ) : data.pendientes.map((p) => (
                  <tr key={p.id}>
                    <td className="code-cell">{p.documento_nro}</td>
                    <td>{p.descripcion}</td>
                    <td>{p.responsable}</td>
                    <td>{fmtDate(p.fecha)}</td>
                    <td className="center">
                      {p.dias_atraso > 0
                        ? <span className="pill pill-danger">{p.dias_atraso} d</span>
                        : <span className="pill pill-ok">en plazo</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
