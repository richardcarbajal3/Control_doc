import { useState } from 'react';

const TIPOS = ['Obra', 'Suministro', 'Servicios', 'Consultoría'];
const ESTADOS = ['Borrador', 'Vigente', 'En Liquidación', 'Cerrado', 'Rescindido'];
const MONEDAS = ['PEN', 'USD', 'EUR'];

export default function ContractForm({ contract, projects, companies, onSave, onCancel }) {
  const [form, setForm] = useState({
    code: contract?.code || '',
    titulo: contract?.titulo || '',
    tipo: contract?.tipo || 'Obra',
    project_id: contract?.project_id || '',
    contratista_id: contract?.contratista_id || '',
    mandante_id: contract?.mandante_id || '',
    monto_original: contract?.monto_original || '',
    moneda: contract?.moneda || 'PEN',
    fecha_firma: contract?.fecha_firma ? contract.fecha_firma.slice(0, 10) : '',
    fecha_inicio: contract?.fecha_inicio ? contract.fecha_inicio.slice(0, 10) : '',
    fecha_fin: contract?.fecha_fin ? contract.fecha_fin.slice(0, 10) : '',
    fecha_fin_real: contract?.fecha_fin_real ? contract.fecha_fin_real.slice(0, 10) : '',
    estado: contract?.estado || 'Borrador',
    descripcion: contract?.descripcion || '',
  });
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onSave({
        ...form,
        project_id: form.project_id || null,
        contratista_id: form.contratista_id || null,
        mandante_id: form.mandante_id || null,
        monto_original: form.monto_original !== '' ? form.monto_original : null,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <h2>{contract ? 'Editar Contrato' : 'Nuevo Contrato'}</h2>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Código *</label>
              <input value={form.code} onChange={set('code')} required />
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select value={form.tipo} onChange={set('tipo')}>
                {TIPOS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Título *</label>
            <input value={form.titulo} onChange={set('titulo')} required />
          </div>
          <div className="form-group">
            <label>Proyecto</label>
            <select value={form.project_id} onChange={set('project_id')}>
              <option value="">— Sin proyecto —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Contratista</label>
              <select value={form.contratista_id} onChange={set('contratista_id')}>
                <option value="">— Sin contratista —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Mandante</label>
              <select value={form.mandante_id} onChange={set('mandante_id')}>
                <option value="">— Sin mandante —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Monto Original</label>
              <input type="number" step="0.01" value={form.monto_original} onChange={set('monto_original')} />
            </div>
            <div className="form-group">
              <label>Moneda</label>
              <select value={form.moneda} onChange={set('moneda')}>
                {MONEDAS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Fecha Firma</label>
              <input type="date" value={form.fecha_firma} onChange={set('fecha_firma')} />
            </div>
            <div className="form-group">
              <label>Fecha Inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Fecha Fin Contractual</label>
              <input type="date" value={form.fecha_fin} onChange={set('fecha_fin')} />
            </div>
            <div className="form-group">
              <label>Fecha Fin Real</label>
              <input type="date" value={form.fecha_fin_real} onChange={set('fecha_fin_real')} />
            </div>
          </div>
          <div className="form-group">
            <label>Estado</label>
            <select value={form.estado} onChange={set('estado')}>
              {ESTADOS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Descripción / Alcance</label>
            <textarea value={form.descripcion} onChange={set('descripcion')} rows={3} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
