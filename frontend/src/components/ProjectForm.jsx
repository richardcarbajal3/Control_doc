import { useState } from 'react';

const TIPOS = ['Minería', 'Construcción', 'EPC', 'Mixto'];
const ESTADOS = ['Planificación', 'En Ejecución', 'Cerrado', 'Suspendido'];

export default function ProjectForm({ project, companies, onSave, onCancel }) {
  const [form, setForm] = useState({
    code: project?.code || '',
    name: project?.name || '',
    descripcion: project?.descripcion || '',
    tipo: project?.tipo || 'Construcción',
    ubicacion: project?.ubicacion || '',
    fecha_inicio: project?.fecha_inicio ? project.fecha_inicio.slice(0, 10) : '',
    fecha_fin: project?.fecha_fin ? project.fecha_fin.slice(0, 10) : '',
    estado: project?.estado || 'Planificación',
    company_id: project?.company_id || '',
  });
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onSave({ ...form, company_id: form.company_id || null });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{project ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h2>
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
            <label>Nombre *</label>
            <input value={form.name} onChange={set('name')} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Ubicación</label>
              <input value={form.ubicacion} onChange={set('ubicacion')} />
            </div>
            <div className="form-group">
              <label>Empresa Mandante</label>
              <select value={form.company_id} onChange={set('company_id')}>
                <option value="">— Sin empresa —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Fecha Inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} />
            </div>
            <div className="form-group">
              <label>Fecha Fin</label>
              <input type="date" value={form.fecha_fin} onChange={set('fecha_fin')} />
            </div>
          </div>
          <div className="form-group">
            <label>Estado</label>
            <select value={form.estado} onChange={set('estado')}>
              {ESTADOS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Descripción</label>
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
