import { useState, useEffect } from 'react';

const STATUSES = ['Borrador', 'En Revisión', 'Vigente', 'Obsoleto'];

const EMPTY_FORM = {
  code: '',
  title: '',
  version: '1.0',
  status: 'Borrador',
  discipline: '',
  type: '',
  responsible: '',
  issue_date: '',
  notes: '',
};

function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function DocumentForm({ document, onSave, onCancel }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  useEffect(() => {
    if (document) {
      setForm({
        code: document.code ?? '',
        title: document.title ?? '',
        version: document.version ?? '1.0',
        status: document.status ?? 'Borrador',
        discipline: document.discipline ?? '',
        type: document.type ?? '',
        responsible: document.responsible ?? '',
        issue_date: toDateInput(document.issue_date),
        notes: document.notes ?? '',
      });
    } else {
      setForm(EMPTY_FORM);
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
      await onSave({
        ...form,
        issue_date: form.issue_date || null,
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
            <div className="form-group">
              <label htmlFor="issue_date">Fecha Emisión</label>
              <input
                id="issue_date"
                name="issue_date"
                type="date"
                value={form.issue_date}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="discipline">Disciplina</label>
              <input
                id="discipline"
                name="discipline"
                type="text"
                value={form.discipline}
                onChange={handleChange}
                placeholder="Civil, Eléctrica, …"
              />
            </div>
            <div className="form-group">
              <label htmlFor="type">Tipo</label>
              <input
                id="type"
                name="type"
                type="text"
                value={form.type}
                onChange={handleChange}
                placeholder="Plano, Memoria, …"
              />
            </div>
            <div className="form-group">
              <label htmlFor="responsible">Responsable</label>
              <input
                id="responsible"
                name="responsible"
                type="text"
                value={form.responsible}
                onChange={handleChange}
                placeholder="Juan Pérez"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notas</label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={form.notes}
              onChange={handleChange}
              placeholder="Observaciones, referencias, etc."
            />
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
