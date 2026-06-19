import { useState } from 'react';
import { updateSettings } from '../api/settings';

// Parses a SharePoint sharing link and returns the base Documents URL.
// Input:  https://tenant-my.sharepoint.com/:f:/g/personal/user/TOKEN?e=xxx
// Output: https://tenant-my.sharepoint.com/personal/user/Documents
function parseSharePointLink(url) {
  try {
    const m = url.match(/^(https:\/\/[^/]+)\/:[^/]+:\/g\/(personal\/[^/]+)\//);
    if (!m) return null;
    return `${m[1]}/${m[2]}/Documents`;
  } catch {
    return null;
  }
}

export default function OrgSettings({ currentValue, onSaved, onCancel }) {
  // currentValue is stored as the full base URL (base/folder) or null
  const [shareLink, setShareLink] = useState('');
  const [folderName, setFolderName] = useState('Control doc');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    let baseUrl;
    if (shareLink.trim()) {
      const docsBase = parseSharePointLink(shareLink.trim());
      if (!docsBase) {
        setError('No se pudo interpretar el enlace. Asegúrate de pegar el enlace de compartir de OneDrive (empieza con https://...sharepoint.com/:f:/g/...)');
        return;
      }
      baseUrl = `${docsBase}/${folderName.trim()}`;
    } else {
      setError('Pega el enlace de OneDrive');
      return;
    }

    setSaving(true);
    try {
      await updateSettings({ onedrive_base_url: baseUrl });
      onSaved(baseUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const preview = (() => {
    if (!shareLink.trim()) return null;
    const docsBase = parseSharePointLink(shareLink.trim());
    if (!docsBase) return null;
    return `${docsBase}/${folderName.trim()}/CT-001`;
  })();

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <h2>Configuración OneDrive</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
          Pega el enlace que te da OneDrive al compartir la carpeta raíz. El sistema construirá
          automáticamente el link de cada contrato usando el código del contrato.
        </p>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Enlace de OneDrive (compartir carpeta)</label>
            <input
              type="text"
              placeholder="https://shouxinpe-my.sharepoint.com/:f:/g/personal/usuario/TOKEN?e=xxx"
              value={shareLink}
              onChange={(e) => setShareLink(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
            />
            <span className="field-hint">El enlace que te da el botón "Compartir" de OneDrive</span>
          </div>
          <div className="form-group">
            <label>Nombre de la carpeta raíz en OneDrive</label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Control doc"
            />
            <span className="field-hint">La carpeta dentro de Documentos que contiene las carpetas de contratos</span>
          </div>
          {preview && (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.82rem' }}>
              <strong>Vista previa del link para contrato CT-001:</strong><br />
              <code style={{ wordBreak: 'break-all', color: 'var(--accent)' }}>{preview}</code>
            </div>
          )}
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
