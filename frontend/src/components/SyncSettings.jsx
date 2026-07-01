import { useEffect, useState } from 'react';
import { getSyncConfig, updateSyncConfig, triggerSync, triggerContractsSync } from '../api/sync';
import { getOrganizations } from '../api/organizations';

// Muestra el resultado de una corrida de sincronización en lenguaje claro.
function ResultBanner({ result }) {
  if (!result) return null;
  if (result.skipped) {
    return <div className="field-hint" style={{ marginTop: '0.5rem' }}>Omitida: {result.reason}</div>;
  }
  if (result.ok === false) {
    return <div className="form-error" style={{ marginTop: '0.5rem' }}>Error: {result.error}</div>;
  }
  const when = result.at ? new Date(result.at).toLocaleString('es-PE') : '';
  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: '6px', padding: '0.6rem 0.9rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
      <strong>Última sincronización</strong> {when && <span style={{ color: 'var(--text-secondary)' }}>· {when}</span>}<br />
      {result.inserted} nuevos · {result.updated} actualizados · {result.skipped} omitidos
      {Array.isArray(result.errors) && result.errors.length > 0 && (
        <div style={{ marginTop: '0.4rem', color: 'var(--text-secondary)' }}>
          {result.errors.length} fila(s) con problemas (revisa el Excel): {result.errors.slice(0, 2).map((e) => `fila ${e.row}`).join(', ')}…
        </div>
      )}
    </div>
  );
}

// Banner de la sync de contratos. Su resultado es más simple: guarda el .xlsx.
function ContractsResultBanner({ result }) {
  if (!result) return null;
  if (result.skipped) {
    return <div className="field-hint" style={{ marginTop: '0.5rem' }}>Omitida: {result.reason}</div>;
  }
  if (result.ok === false) {
    return <div className="form-error" style={{ marginTop: '0.5rem' }}>Error: {result.error}</div>;
  }
  const when = result.at ? new Date(result.at).toLocaleString('es-PE') : '';
  const kb = result.size ? Math.round(result.size / 1024) : null;
  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: '6px', padding: '0.6rem 0.9rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
      <strong>Contratos sincronizados</strong> {when && <span style={{ color: 'var(--text-secondary)' }}>· {when}</span>}<br />
      Archivo descargado correctamente{kb != null ? ` · ${kb} KB` : ''}. Ábrelo en 📊 Análisis.
    </div>
  );
}

export default function SyncSettings({ isOwner, onClose }) {
  const [cfg, setCfg] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [contractsSyncing, setContractsSyncing] = useState(false);
  const [contractsResult, setContractsResult] = useState(null);

  useEffect(() => {
    getSyncConfig()
      .then((c) => {
        setCfg(c);
        setResult(c.sync_last_run || null);
        setContractsResult(c.sync_contracts_last_run || null);
      })
      .catch((e) => setError(e.message));
    if (isOwner) getOrganizations().then(setOrgs).catch(() => {});
  }, [isOwner]);

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const saved = await updateSyncConfig({
        sync_share_url: cfg.sync_share_url,
        sync_sheet: cfg.sync_sheet,
        sync_org_id: cfg.sync_org_id,
        sync_enabled: cfg.sync_enabled,
        sync_contracts_share_url: cfg.sync_contracts_share_url,
        sync_contracts_enabled: cfg.sync_contracts_enabled,
      });
      setCfg(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async () => {
    setError(''); setSyncing(true); setResult(null);
    try {
      setResult(await triggerSync());
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncContractsNow = async () => {
    setError(''); setContractsSyncing(true); setContractsResult(null);
    try {
      setContractsResult(await triggerContractsSync());
    } catch (err) {
      setError(err.message);
    } finally {
      setContractsSyncing(false);
    }
  };

  if (!cfg) {
    return (
      <div className="modal-overlay">
        <div className="modal"><p>{error || 'Cargando…'}</p>
          <div className="form-actions"><button className="btn btn-secondary" onClick={onClose}>Cerrar</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <h2>Sincronización de documentos</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Pega el enlace del Excel en SharePoint. El sistema lo lee automáticamente cada 15 minutos
          (08:00–18:00, lun–sáb) y actualiza el registro de Documentos. También puedes forzar una
          sincronización ahora con el botón de abajo.
        </p>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Enlace del Excel en SharePoint (compartir archivo)</label>
            <input
              type="text"
              placeholder="https://...sharepoint.com/:x:/g/personal/.../IQ...?e=xxxx"
              value={cfg.sync_share_url || ''}
              onChange={(e) => set('sync_share_url', e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
            />
            <span className="field-hint">El enlace que da "Compartir" sobre el archivo .xlsx (no la carpeta)</span>
          </div>
          <div className="form-group">
            <label>Hoja a sincronizar</label>
            <input type="text" value={cfg.sync_sheet || 'Documentos'} onChange={(e) => set('sync_sheet', e.target.value)} />
            <span className="field-hint">Nombre exacto de la pestaña en el Excel</span>
          </div>
          {isOwner && (
            <div className="form-group">
              <label>Organización destino</label>
              <select value={cfg.sync_org_id || ''} onChange={(e) => set('sync_org_id', e.target.value || null)}>
                <option value="">— Global (solo owner) —</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <span className="field-hint">A qué cliente pertenecen los documentos sincronizados</span>
            </div>
          )}
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input id="sync_enabled" type="checkbox" checked={!!cfg.sync_enabled} onChange={(e) => set('sync_enabled', e.target.checked)} style={{ width: 'auto' }} />
            <label htmlFor="sync_enabled" style={{ margin: 0 }}>Sincronización automática activada (cada 15 min)</label>
          </div>

          <ResultBanner result={result} />

          {/* ---- Sincronización del Excel de CONTRATOS (módulo Análisis) ---- */}
          <hr style={{ border: 'none', borderTop: '1px solid var(--border, #ddd)', margin: '1.5rem 0 1rem' }} />
          <h3 style={{ margin: '0 0 0.25rem' }}>Sincronización de contratos (Análisis)</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Pega el enlace del Excel de contratos en SharePoint. El sistema lo descarga en el mismo
            horario (cada 15 min, 08:00–18:00, lun–sáb) y la pestaña 📊 Análisis lo carga sola,
            sin subirlo a mano. Se procesa con la llave CONTRATO+ADENDA (hojas Contratos, Pagos, SAP,
            Provisiones, Garantías…).
          </p>
          <div className="form-group">
            <label>Enlace del Excel de Contratos en SharePoint (compartir archivo)</label>
            <input
              type="text"
              placeholder="https://...sharepoint.com/:x:/g/personal/.../IQ...?e=xxxx"
              value={cfg.sync_contracts_share_url || ''}
              onChange={(e) => set('sync_contracts_share_url', e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
            />
            <span className="field-hint">El enlace que da "Compartir" sobre el archivo .xlsx de contratos (no la carpeta)</span>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input id="sync_contracts_enabled" type="checkbox" checked={!!cfg.sync_contracts_enabled} onChange={(e) => set('sync_contracts_enabled', e.target.checked)} style={{ width: 'auto' }} />
            <label htmlFor="sync_contracts_enabled" style={{ margin: 0 }}>Sincronización automática de contratos activada (cada 15 min)</label>
          </div>
          <button type="button" className="btn btn-secondary" onClick={handleSyncContractsNow} disabled={contractsSyncing || !cfg.sync_contracts_share_url}>
            {contractsSyncing ? 'Sincronizando contratos…' : '🔄 Sincronizar contratos ahora'}
          </button>
          <ContractsResultBanner result={contractsResult} />

          <div className="form-actions" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="btn btn-secondary" onClick={handleSyncNow} disabled={syncing || !cfg.sync_share_url}>
              {syncing ? 'Sincronizando…' : '🔄 Sincronizar ahora'}
            </button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
