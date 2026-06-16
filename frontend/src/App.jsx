import { useState, useEffect, useCallback } from 'react';

import DocumentList from './components/DocumentList';
import DocumentForm from './components/DocumentForm';
import CompanyList from './components/CompanyList';
import CompanyForm from './components/CompanyForm';
import ProjectList from './components/ProjectList';
import ProjectForm from './components/ProjectForm';
import ContractList from './components/ContractList';
import ContractForm from './components/ContractForm';
import ClaimList from './components/ClaimList';
import ClaimForm from './components/ClaimForm';
import ClaimDetail from './components/ClaimDetail';
import ContractMembers from './components/ContractMembers';
import UserList from './components/UserList';
import UserForm from './components/UserForm';
import Login from './components/Login';
import PasteGrid from './components/PasteGrid';
import ReportView from './components/ReportView';
import PresentationReport from './components/PresentationReport';
import { IMPORT_CONFIGS } from './lib/importConfig';

import { getDocuments, createDocument, updateDocument, deleteDocument } from './api/documents';
import { getCompanies, createCompany, updateCompany, deleteCompany } from './api/companies';
import { getProjects, createProject, updateProject, deleteProject } from './api/projects';
import { getContracts, createContract, updateContract, deleteContract } from './api/contracts';
import { getClaims, createClaim, updateClaim, deleteClaim } from './api/claims';
import { getUsers, createUser, updateUser, deleteUser } from './api/users';
import { getMe, logout } from './api/auth';
import { getToken } from './api/http';

const BASE_TABS = [
  { key: 'documents', label: 'Documentos' },
  { key: 'claims', label: 'Claims' },
  { key: 'companies', label: 'Empresas' },
  { key: 'projects', label: 'Proyectos' },
  { key: 'contracts', label: 'Contratos' },
  { key: 'presentation', label: 'Presentación' },
  { key: 'report', label: 'Reporte' },
];

function useModule(fetchFn, deps = []) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try { setItems(await fetchFn(search)); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, ...deps]);

  useEffect(() => {
    const t = setTimeout(fetch, 300);
    return () => clearTimeout(t);
  }, [fetch]);

  return { items, loading, search, setSearch, refresh: fetch };
}

// Top-level: handle the session. The data hooks live in <Dashboard> so they
// only mount (and fire API calls) once the user is authenticated.
export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const onUnauth = () => setUser(null);
    window.addEventListener('cd-unauthorized', onUnauth);
    (async () => {
      if (getToken()) {
        try { setUser(await getMe()); } catch { /* invalid token */ }
      }
      setChecking(false);
    })();
    return () => window.removeEventListener('cd-unauthorized', onUnauth);
  }, []);

  if (checking) return <div className="loading">Cargando…</div>;
  if (!user) return <Login onLoggedIn={setUser} />;
  return <Dashboard currentUser={user} onLogout={() => { logout(); setUser(null); }} />;
}

function Dashboard({ currentUser, onLogout }) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';
  const TABS = isAdmin
    ? [...BASE_TABS.slice(0, 5), { key: 'users', label: 'Usuarios' }, ...BASE_TABS.slice(5)]
    : BASE_TABS;

  const [tab, setTab] = useState('documents');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState(null);
  const [claimDetail, setClaimDetail] = useState(null);
  const [rolesContract, setRolesContract] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const docs = useModule(getDocuments);
  const claims = useModule(getClaims);
  const companies = useModule(getCompanies);
  const projects = useModule(getProjects);
  const contracts = useModule(getContracts);
  const users = useModule(getUsers);

  const openCreate = () => { setDeleteError(''); setEditing(null); setShowForm(true); };
  const openEdit = (item) => { setDeleteError(''); setEditing(item); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const handleSaveDoc = async (data) => {
    if (editing) await updateDocument(editing.id, data);
    else await createDocument(data);
    closeForm(); docs.refresh();
  };
  const handleDeleteDoc = async (doc) => {
    const label = doc.documento_nro || doc.descripcion || doc.n_contrato || `#${doc.id}`;
    if (window.confirm(`¿Eliminar el documento "${label}"?`)) {
      try { await deleteDocument(doc.id); docs.refresh(); setDeleteError(''); }
      catch (err) { setDeleteError(err.message); }
    }
  };

  const handleSaveCompany = async (data) => {
    if (editing) await updateCompany(editing.id, data);
    else await createCompany(data);
    closeForm(); companies.refresh();
  };
  const handleDeleteCompany = async (c) => {
    if (window.confirm(`¿Eliminar la empresa "${c.razon_social}"?`)) {
      try { await deleteCompany(c.id); companies.refresh(); setDeleteError(''); }
      catch (err) { setDeleteError(err.message); }
    }
  };

  const handleSaveProject = async (data) => {
    if (editing) await updateProject(editing.id, data);
    else await createProject(data);
    closeForm(); projects.refresh();
  };
  const handleDeleteProject = async (p) => {
    if (window.confirm(`¿Eliminar el proyecto "${p.name}"?`)) {
      try { await deleteProject(p.id); projects.refresh(); setDeleteError(''); }
      catch (err) { setDeleteError(err.message); }
    }
  };

  const handleSaveContract = async (data) => {
    if (editing) await updateContract(editing.id, data);
    else await createContract(data);
    closeForm(); contracts.refresh();
  };
  const handleDeleteContract = async (c) => {
    if (window.confirm(`¿Eliminar el contrato "${c.title}"?`)) {
      try { await deleteContract(c.id); contracts.refresh(); setDeleteError(''); }
      catch (err) { setDeleteError(err.message); }
    }
  };

  const handleSaveClaim = async (data) => {
    if (editing) await updateClaim(editing.id, data);
    else await createClaim(data);
    closeForm(); claims.refresh();
  };
  const handleDeleteClaim = async (c) => {
    if (window.confirm(`¿Eliminar el claim "${c.title}"?`)) {
      try { await deleteClaim(c.id); claims.refresh(); setDeleteError(''); }
      catch (err) { setDeleteError(err.message); }
    }
  };

  const handleSaveUser = async (data) => {
    if (editing) await updateUser(editing.id, data);
    else await createUser(data);
    closeForm(); users.refresh();
  };
  const handleDeleteUser = async (u) => {
    if (window.confirm(`¿Eliminar al usuario "${u.email}"?`)) {
      try { await deleteUser(u.id); users.refresh(); setDeleteError(''); }
      catch (err) { setDeleteError(err.message); }
    }
  };

  const tabConfig = {
    documents: { label: 'Documento', searchPlaceholder: 'Buscar documento (nro, descripción, contrato)...' },
    claims: { label: 'Claim', searchPlaceholder: 'Buscar claim (código, título, contrato)...' },
    companies: { label: 'Empresa', searchPlaceholder: 'Buscar por RUC o razón social...' },
    projects: { label: 'Proyecto', searchPlaceholder: 'Buscar por código o nombre...' },
    contracts: { label: 'Contrato', searchPlaceholder: 'Buscar por código o título...' },
    users: { label: 'Usuario', searchPlaceholder: 'Usuarios…' },
  };

  const activeModule = { documents: docs, claims, companies, projects, contracts, users }[tab];
  const cfg = tabConfig[tab];
  const importConfig = IMPORT_CONFIGS[tab];

  const handleImported = () => { activeModule?.refresh(); };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Control Doc</h1>
          <p>Sistema de gestión contractual y documental</p>
        </div>
        <div className="user-box">
          <span className="user-email">{currentUser.email}</span>
          <span className="user-role">{currentUser.role}</span>
          <button className="btn btn-secondary btn-small" onClick={onLogout}>Salir</button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${tab === t.key ? 'tab-btn-active' : ''}`}
            onClick={() => { setTab(t.key); setShowForm(false); setShowImport(false); setEditing(null); setClaimDetail(null); setRolesContract(null); }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="main">
        {tab === 'presentation' ? (
          <PresentationReport />
        ) : tab === 'report' ? (
          <ReportView />
        ) : (
          <>
            <div className="toolbar">
              <input
                type="text"
                className="search-input"
                placeholder={cfg.searchPlaceholder}
                value={activeModule.search}
                onChange={(e) => activeModule.setSearch(e.target.value)}
              />
              <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
                📋 Pegar desde Excel
              </button>
              <button className="btn btn-primary" onClick={openCreate}>
                + Nuevo {cfg.label}
              </button>
            </div>

            {deleteError && (
              <div className="alert-error">
                {deleteError}
                <button className="alert-close" onClick={() => setDeleteError('')}>✕</button>
              </div>
            )}

            {activeModule.loading ? (
              <div className="loading">Cargando...</div>
            ) : (
              <>
                {tab === 'documents' && (
                  <DocumentList documents={docs.items} onEdit={openEdit} onDelete={handleDeleteDoc} />
                )}
                {tab === 'claims' && (
                  <ClaimList
                    claims={claims.items}
                    onEdit={openEdit}
                    onDelete={handleDeleteClaim}
                    onOpen={(c) => setClaimDetail(c)}
                  />
                )}
                {tab === 'companies' && (
                  <CompanyList companies={companies.items} onEdit={openEdit} onDelete={handleDeleteCompany} />
                )}
                {tab === 'projects' && (
                  <ProjectList projects={projects.items} onEdit={openEdit} onDelete={handleDeleteProject} />
                )}
                {tab === 'contracts' && (
                  <ContractList
                    contracts={contracts.items}
                    onEdit={openEdit}
                    onDelete={handleDeleteContract}
                    onManageRoles={isAdmin ? setRolesContract : undefined}
                  />
                )}
                {tab === 'users' && (
                  <UserList
                    users={users.items}
                    currentUser={currentUser}
                    onEdit={openEdit}
                    onDelete={handleDeleteUser}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>

      {showForm && tab === 'documents' && (
        <DocumentForm
          document={editing}
          claims={claims.items}
          documents={docs.items}
          onSave={handleSaveDoc}
          onCancel={closeForm}
        />
      )}
      {showForm && tab === 'claims' && (
        <ClaimForm claim={editing} onSave={handleSaveClaim} onCancel={closeForm} />
      )}
      {showForm && tab === 'users' && (
        <UserForm
          user={editing}
          isSuperadmin={currentUser.role === 'superadmin'}
          onSave={handleSaveUser}
          onCancel={closeForm}
        />
      )}
      {showForm && tab === 'companies' && (
        <CompanyForm company={editing} onSave={handleSaveCompany} onCancel={closeForm} />
      )}
      {showForm && tab === 'projects' && (
        <ProjectForm
          project={editing}
          companies={companies.items}
          onSave={handleSaveProject}
          onCancel={closeForm}
        />
      )}
      {showForm && tab === 'contracts' && (
        <ContractForm
          contract={editing}
          projects={projects.items}
          companies={companies.items}
          onSave={handleSaveContract}
          onCancel={closeForm}
        />
      )}

      {showImport && importConfig && (
        <PasteGrid
          resource={tab}
          config={importConfig}
          onClose={() => setShowImport(false)}
          onDone={handleImported}
        />
      )}

      {claimDetail && (
        <ClaimDetail
          claim={claimDetail}
          allDocuments={docs.items}
          onClose={() => setClaimDetail(null)}
          onChanged={() => { claims.refresh(); docs.refresh(); }}
        />
      )}

      {rolesContract && (
        <ContractMembers contract={rolesContract} onClose={() => setRolesContract(null)} />
      )}
    </div>
  );
}
