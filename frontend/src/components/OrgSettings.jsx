import { useState } from 'react';
import { updateSettings } from '../api/settings';

export default function OrgSettings({ currentValue, onSaved, onCancel }) {
  const [url, setUrl] = useState(currentValue || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateSettings({ onedrive_base_url: url.trim() || null });
      onSaved(url.trim() || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Configuración OneDrive</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Pega aquí la URL base de tu carpeta OneDrive (sin barra al final). El sistema
          construirá automáticamente el link de cada contrato agregando el código del contrato.
        </p>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.85rem', background: 'var(--bg-secondary)', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
          Ejemplo:<br />
          <code>https://shouxinpe-my.sharepoint.com/personal/rcarbajal_shouxin_com_pe/Documents/Control%20doc</code>
        </p>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>URL base de carpeta OneDrive</label>
            <input
              type="url"
              placeholder="https://empresa-my.sharepoint.com/personal/.../Documents/Control doc"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
