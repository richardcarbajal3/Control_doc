import { useState, useEffect } from 'react';
import { getRules, createRule, updateRule, deleteRule } from '../api/classificationRules';

const EMPTY_FORM = { pattern: '', familia: '', priority: 10 };

export default function ClassificationRules({ onClose, onChange }) {
  const [rules, setRules] = useState([]);
  const [tab, setTab] = useState('codigo');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setRules(await getRules());
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const tabRules = rules
    .filter((r) => r.source === tab)
    .sort((a, b) => a.priority - b.priority || a.id - b.id);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.pattern.trim() || !form.familia.trim()) return;
    setBusy(true);
    setError('');
    try {
      await createRule({ source: tab, pattern: form.pattern.trim(), familia: form.familia.trim(), priority: Number(form.priority) || 10 });
      setForm(EMPTY_FORM);
      setAdding(false);
      await load();
      onChange?.();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      await updateRule(editing.id, { pattern: editing.pattern, familia: editing.familia, priority: Number(editing.priority) || 10 });
      setEditing(null);
      await load();
      onChange?.();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta regla?')) return;
    setError('');
    try {
      await deleteRule(id);
      await load();
      onChange?.();
    } catch (err) { setError(err.message); }
  };

  const patternLabel = tab === 'codigo' ? 'Patrón en N° Documento' : 'Palabra en Descripción';
  const patternHint = tab === 'codigo' ? 'ej: dwg, AB, PRO-' : 'ej: acta, carta, plano';

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <h2>Clasificación de Documentos</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          La app primero busca en <strong>Códigos</strong> (N° de documento). Si no hay coincidencia,
          busca en <strong>Palabras clave</strong> (descripción). Menor número de prioridad = se evalúa primero.
        </p>
        {error && <div className="form-error">{error}</div>}

        <div className="tabs" style={{ marginBottom: '1rem' }}>
          <button
            className={`tab-btn ${tab === 'codigo' ? 'tab-btn-active' : ''}`}
            onClick={() => { setTab('codigo'); setAdding(false); setEditing(null); setError(''); }}
          >
            Hoja 1 — Códigos (N° Documento)
          </button>
          <button
            className={`tab-btn ${tab === 'descripcion' ? 'tab-btn-active' : ''}`}
            onClick={() => { setTab('descripcion'); setAdding(false); setEditing(null); setError(''); }}
          >
            Hoja 2 — Palabras clave (Descripción)
          </button>
        </div>

        <div className="doc-table-scroll">
          <table className="doc-table" style={{ marginBottom: '1rem' }}>
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Prioridad</th>
                <th>{patternLabel}</th>
                <th style={{ width: '160px' }}>Familia</th>
                <th style={{ width: '130px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tabRules.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1.5rem' }}>
                    Sin reglas. Agrega la primera con el botón de abajo.
                  </td>
                </tr>
              )}
              {tabRules.map((r) =>
                editing?.id === r.id ? (
                  <tr key={r.id}>
                    <td>
                      <input
                        type="number"
                        value={editing.priority}
                        onChange={(e) => setEditing({ ...editing, priority: e.target.value })}
                        style={{ width: '60px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editing.pattern}
                        onChange={(e) => setEditing({ ...editing, pattern: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editing.familia}
                        onChange={(e) => setEditing({ ...editing, familia: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </td>
                    <td className="actions-cell">
                      <button className="btn btn-small btn-primary" onClick={handleUpdate} disabled={busy}>Guardar</button>
                      <button className="btn btn-small btn-secondary" onClick={() => setEditing(null)}>Cancelar</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id}>
                    <td style={{ textAlign: 'center' }}>{r.priority}</td>
                    <td><code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>{r.pattern}</code></td>
                    <td>
                      <span className="chip" style={{ background: 'var(--accent)', color: '#fff' }}>{r.familia}</span>
                    </td>
                    <td className="actions-cell">
                      <button className="btn btn-small btn-edit" onClick={() => { setEditing({ ...r }); setAdding(false); }}>Editar</button>
                      <button className="btn btn-small btn-delete" onClick={() => handleDelete(r.id)}>Eliminar</button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        {adding ? (
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Prioridad</label>
              <input
                type="number"
                value={form.priority}
                min={1}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                style={{ width: '72px' }}
              />
            </div>
            <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '160px' }}>
              <label>{patternLabel}</label>
              <input
                type="text"
                placeholder={patternHint}
                value={form.pattern}
                onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                autoFocus
              />
            </div>
            <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '140px' }}>
              <label>Familia</label>
              <input
                type="text"
                placeholder="ej: Plano"
                value={form.familia}
                onChange={(e) => setForm({ ...form, familia: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '1px' }}>
              <button type="submit" className="btn btn-primary" disabled={busy}>Agregar</button>
              <button type="button" className="btn btn-secondary" onClick={() => { setAdding(false); setForm(EMPTY_FORM); }}>Cancelar</button>
            </div>
          </form>
        ) : (
          <button
            className="btn btn-secondary"
            onClick={() => { setAdding(true); setEditing(null); }}
            style={{ marginBottom: '1rem' }}
          >
            + Agregar regla
          </button>
        )}

        <div className="form-actions">
          <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
