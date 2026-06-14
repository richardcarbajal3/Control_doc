import { useState } from 'react';

const TIPOS = ['Contratista', 'Subcontratista', 'Mandante', 'Consultora'];
const ESTADOS = ['Activa', 'Inactiva'];

export default function CompanyForm({ company, onSave, onCancel }) {
  const [form, setForm] = useState({
    ruc: company?.ruc || '',
    razon_social: company?.razon_social || '',
    nombre_comercial: company?.nombre_comercial || '',
    tipo: company?.tipo || 'Contratista',
    pais: company?.pais || 'Perú',
    email_contacto: company?.email_contacto || '',
    telefono: company?.telefono || '',
    estado: company?.estado || 'Activa',
  });
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{company ? 'Editar Empresa' : 'Nueva Empresa'}</h2>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>RUC *</label>
              <input value={form.ruc} onChange={set('ruc')} required />
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select value={form.tipo} onChange={set('tipo')}>
                {TIPOS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Razón Social *</label>
            <input value={form.razon_social} onChange={set('razon_social')} required />
          </div>
          <div className="form-group">
            <label>Nombre Comercial</label>
            <input value={form.nombre_comercial} onChange={set('nombre_comercial')} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>País</label>
              <input value={form.pais} onChange={set('pais')} />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input value={form.telefono} onChange={set('telefono')} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email de Contacto</label>
              <input type="email" value={form.email_contacto} onChange={set('email_contacto')} />
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select value={form.estado} onChange={set('estado')}>
                {ESTADOS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
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
