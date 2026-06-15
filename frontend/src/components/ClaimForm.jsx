import { useState, useEffect } from 'react';
import { CLAIM_TYPES, CLAIM_STATUSES } from '../lib/claimOptions';

export default function ClaimForm({ claim, onSave, onCancel }) {
  const [form, setForm] = useState({
    code: '', title: '', type: 'Otro', n_contrato: '', status: 'Abierto', description: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (claim) {
      setForm({
        code: claim.code || '',
        title: claim.title || '',
        type: claim.type || 'Otro',
        n_contrato: claim.n_contrato || '',
        status: claim.status || 'Abierto',
        description: claim.description || '',
      });
    }
  }, [claim]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    try { await onSave(form); } catch (err) { setError(err.message); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{claim ? 'Editar Claim' : 'Nuevo Claim'}</h2>
        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="code">Código</label>
              <input id="code" name="code" value={form.code} onChange={handleChange} placeholder="CLM-001" />
            </div>
            <div className="form-group">
              <label htmlFor="type">Tipo</label>
              <select id="type" name="type" value={form.type} onChange={handleChange}>
                {CLAIM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="title">Título</label>
            <input id="title" name="title" value={form.title} onChange={handleChange} required />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="n_contrato">N° Contrato</label>
              <input id="n_contrato" name="n_contrato" value={form.n_contrato} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="status">Estado</label>
              <select id="status" name="status" value={form.status} onChange={handleChange}>
                {CLAIM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Descripción</label>
            <textarea id="description" name="description" rows={3} value={form.description} onChange={handleChange} />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="btn btn-primary">{claim ? 'Guardar Cambios' : 'Crear Claim'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
