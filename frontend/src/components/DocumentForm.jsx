import { useState, useEffect } from 'react';
import { IMPORT_CONFIGS } from '../lib/importConfig';

const FIELDS = IMPORT_CONFIGS.documents.fields;

const emptyForm = () => ({ ...Object.fromEntries(FIELDS.map((f) => [f.key, ''])), parent_id: '' });

export default function DocumentForm({ document, documents = [], onSave, onCancel }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  useEffect(() => {
    if (document) {
      const next = emptyForm();
      FIELDS.forEach((f) => {
        let v = document[f.key];
        if (f.type === 'date' && v) v = String(v).slice(0, 10); // ISO -> yyyy-mm-dd
        next[f.key] = v == null ? '' : v;
      });
      next.parent_id = document.parent_id == null ? '' : String(document.parent_id);
      setForm(next);
    }
  }, [document]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

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
      <div className="modal modal-wide">
        <h2>{document ? 'Editar Documento' : 'Nuevo Documento'}</h2>
        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-grid">
            {FIELDS.map((f) => (
              <div
                className={`form-group ${f.type === 'textarea' ? 'form-group-full' : ''}`}
                key={f.key}
              >
                <label htmlFor={f.key}>{f.label}</label>
                {f.type === 'textarea' ? (
                  <textarea id={f.key} name={f.key} rows={2} value={form[f.key]} onChange={handleChange} />
                ) : (
                  <input
                    id={f.key}
                    name={f.key}
                    type={f.type === 'date' ? 'date' : 'text'}
                    value={form[f.key]}
                    onChange={handleChange}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="parent_id">Responde a (documento)</label>
              <select id="parent_id" name="parent_id" value={form.parent_id} onChange={handleChange}>
                <option value="">— Ninguno —</option>
                {documents
                  .filter((d) => !document || d.id !== document.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {(d.documento_nro || `#${d.id}`)}{d.descripcion ? ` — ${d.descripcion.slice(0, 40)}` : ''}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <p className="import-help">
            Los claims se gestionan desde cada Claim (pestaña Claims → abrir → “Agregar documento”).
            Un mismo documento puede estar en varios claims, como soporte o referencia.
          </p>

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
