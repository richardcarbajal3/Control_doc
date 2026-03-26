import { useState, useEffect } from 'react';

const STATUSES = ['Borrador', 'En Revisión', 'Vigente', 'Obsoleto'];

export default function DocumentForm({ document, onSave, onCancel }) {
  const [form, setForm] = useState({
    code: '',
    title: '',
    version: '1.0',
    status: 'Borrador',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (document) {
      setForm({
        code: document.code,
        title: document.title,
        version: document.version,
        status: document.status,
      });
    }
  }, [document]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.code.trim() || !form.title.trim()) {
      setError('El código y el título son obligatorios');
      return;
    }

    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{document ? 'Editar Documento' : 'Nuevo Documento'}</h2>
        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="code">Código</label>
            <input
              id="code"
              name="code"
              type="text"
              value={form.code}
              onChange={handleChange}
              placeholder="DOC-001"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="title">Título</label>
            <input
              id="title"
              name="title"
              type="text"
              value={form.title}
              onChange={handleChange}
              placeholder="Nombre del documento"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="version">Versión</label>
              <input
                id="version"
                name="version"
                type="text"
                value={form.version}
                onChange={handleChange}
                placeholder="1.0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="status">Estado</label>
              <select id="status" name="status" value={form.status} onChange={handleChange}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {document ? 'Guardar Cambios' : 'Crear Documento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
