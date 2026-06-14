import { useState, useEffect } from 'react';

const STATUSES = ['Borrador', 'En Revisión', 'Vigente', 'Obsoleto'];
const TIPOS = ['Documento', 'Plano', 'Especificación', 'Contrato', 'Carta', 'Informe', 'Certificado'];

export default function DocumentForm({ document, projects, contracts, correspondence, onSave, onCancel }) {
  const [form, setForm] = useState({
    code: '',
    title: '',
    tipo: 'Documento',
    version: '1.0',
    status: 'Borrador',
    project_id: '',
    contract_id: '',
    correspondence_id: '',
    descripcion: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (document) {
      setForm({
        code: document.code || '',
        title: document.title || '',
        tipo: document.tipo || 'Documento',
        version: document.version || '1.0',
        status: document.status || 'Borrador',
        project_id: document.project_id || '',
        contract_id: document.contract_id || '',
        correspondence_id: document.correspondence_id || '',
        descripcion: document.descripcion || '',
      });
    }
  }, [document]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.code.trim() || !form.title.trim()) {
      return setError('El código y el título son obligatorios');
    }
    try {
      await onSave({
        ...form,
        project_id: form.project_id || null,
        contract_id: form.contract_id || null,
        correspondence_id: form.correspondence_id || null,
        descripcion: form.descripcion || null,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <h2>{document ? 'Editar Documento' : 'Nuevo Documento'}</h2>
        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="code">Código *</label>
              <input
                id="code" name="code" type="text"
                value={form.code} onChange={handleChange}
                placeholder="DOC-001" required
              />
            </div>
            <div className="form-group">
              <label htmlFor="tipo">Tipo</label>
              <select id="tipo" name="tipo" value={form.tipo} onChange={handleChange}>
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="title">Título *</label>
            <input
              id="title" name="title" type="text"
              value={form.title} onChange={handleChange}
              placeholder="Nombre del documento" required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="version">Versión</label>
              <input
                id="version" name="version" type="text"
                value={form.version} onChange={handleChange}
                placeholder="1.0"
              />
            </div>
            <div className="form-group">
              <label htmlFor="status">Estado</label>
              <select id="status" name="status" value={form.status} onChange={handleChange}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="form-section-label">Vinculación (opcional)</div>

          <div className="form-group">
            <label htmlFor="project_id">Proyecto</label>
            <select id="project_id" name="project_id" value={form.project_id} onChange={handleChange}>
              <option value="">— Sin proyecto —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="contract_id">Contrato</label>
              <select id="contract_id" name="contract_id" value={form.contract_id} onChange={handleChange}>
                <option value="">— Sin contrato —</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.titulo}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="correspondence_id">Correspondencia</label>
              <select id="correspondence_id" name="correspondence_id" value={form.correspondence_id} onChange={handleChange}>
                <option value="">— Sin correspondencia —</option>
                {correspondence.map((co) => (
                  <option key={co.id} value={co.id}>{co.code} — {co.subject}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="descripcion">Descripción</label>
            <textarea
              id="descripcion" name="descripcion"
              value={form.descripcion} onChange={handleChange}
              rows={3} placeholder="Descripción del contenido del documento"
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="btn btn-primary">
              {document ? 'Guardar Cambios' : 'Crear Documento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
