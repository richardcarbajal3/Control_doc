import { useState, useEffect, useCallback } from 'react';
import { getContractMembers, assignMember, removeMember } from '../api/users';
import PasteGrid from './PasteGrid';

const CONTRACT_ROLES = [
  { value: 'control_documentario', label: 'Control Documentario (carga toda la data)' },
  { value: 'colaborador', label: 'Colaborador (carga sus expedientes / ve los demás)' },
  { value: 'lector', label: 'Lector (solo ver)' },
];

const MEMBERS_CONFIG = {
  label: 'Roles del contrato',
  fields: [
    { key: 'email', label: 'Correo', required: true },
    { key: 'role', label: 'Rol (control_documentario/colaborador/lector)' },
    { key: 'full_name', label: 'Nombre' },
  ],
};

export default function ContractMembers({ contract, onClose }) {
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('control_documentario');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPaste, setShowPaste] = useState(false);

  const load = useCallback(async () => {
    try { setMembers(await getContractMembers(contract.id)); }
    catch (e) { setError(e.message); }
  }, [contract.id]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!email.trim()) return;
    setBusy(true); setError('');
    try { await assignMember(contract.id, { email: email.trim(), role }); setEmail(''); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const remove = async (userId) => {
    setBusy(true); setError('');
    try { await removeMember(contract.id, userId); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>Roles — {contract.code}</h2>
        <p className="import-help">{contract.title}</p>
        {error && <div className="form-error">{error}</div>}

        <div className="assign-row">
          <input className="search-input" placeholder="correo@empresa.com.pe" value={email}
            onChange={(e) => setEmail(e.target.value)} />
          <select className="search-input" value={role} onChange={(e) => setRole(e.target.value)}>
            {CONTRACT_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button className="btn btn-primary" disabled={busy || !email.trim()} onClick={add}>Asignar</button>
          <button className="btn btn-secondary" onClick={() => setShowPaste(true)}>📋 Excel</button>
        </div>

        <h3 className="section-title">Miembros ({members.length})</h3>
        {members.length === 0 ? (
          <div className="empty-state"><p>Sin miembros asignados</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead><tr><th>Correo</th><th>Nombre</th><th>Rol</th><th></th></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.user_id}>
                    <td className="code-cell">{m.email}</td>
                    <td>{m.full_name}</td>
                    <td><span className="badge" style={{ backgroundColor: '#1e3a5f' }}>{m.role}</span></td>
                    <td>
                      <button className="btn btn-small btn-delete" disabled={busy} onClick={() => remove(m.user_id)}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>

        {showPaste && (
          <PasteGrid
            resource={`contracts/${contract.id}/members`}
            config={MEMBERS_CONFIG}
            onClose={() => setShowPaste(false)}
            onDone={load}
          />
        )}
      </div>
    </div>
  );
}
