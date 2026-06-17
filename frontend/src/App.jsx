import { useState, useEffect, useCallback, useMemo } from 'react';

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
import ClaimDropPanel from './components/ClaimDropPanel';
import ContractMembers from './components/ContractMembers';
import UserList from './components/UserList';
import UserForm from './components/UserForm';
import OrgList from './components/OrgList';
import OrgForm from './components/OrgForm';
import AssignAdminForm from './components/AssignAdminForm';
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
import {
  getOrganizations, createOrganization, updateOrganization, deleteOrganization, assignOrgAdmin,
} from './api/organizations';
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

  const onLogout = () => { logout(); setUser(null); };

  if (checking) return <div className="loading">Cargando…</div>;
  if (!user) return <Login onLoggedIn={setUser} />;
  if (user.role !== 'superadmin' && user.organization_id == null) {
    return <NoAccess user={user} onLogout={onLogout} />;
  }
  return <Dashboard currentUser={user} onLogout={onLogout} />;
}

// Shown to a self-registered user who has not been assigned to a client yet.
function NoAccess({ user, onLogout }) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>Control Doc</h1>
        <p className="login-sub">Hola, {user.full_name || user.email}</p>
        <p>Tu cuenta fue creada pero aún <strong>no está asignada a un cliente</strong>.
          El administrador debe habilitarte el acceso. Vuelve a intentar más tarde.</p>
        <button className="btn btn-secondary btn-block" onClick={onLogout}>Salir</button>
      </div>
    </div>
  );
}

function Dashboard({ currentUser, onLogout }) {
  const isOwner = currentUser.role === 'superadmin';
  const isAdmin = isOwner || currentUser.role === 'admin';
  const TABS = [
    ...(isOwner ? [{ key: 'organizations', label: 'Organizaciones' }] : []),
    ...BASE_TABS.slice(0, 5),
    ...(isAdmin ? [{ key: 'users', label: 'Usuarios' }] : []),
    ...BASE_TABS.slice(5),
  ];

  const [tab, setTab] = useState(isOwner ? 'organizations' : 'documents');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState(null);
  const [claimDetail, setClaimDetail] = useState(null);
  const [claimMode, setClaimMode] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [docFilters, setDocFilters] = useState({});
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState(null);
  const [rolesContract, setRolesContract] = useState(null);
  const [assignAdminOrg, setAssignAdminOrg] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const docs = useModule(getDocuments);
  const claims = useModule(getClaims);
  const companies = useModule(getCompanies);
  const projects = useModule(getProjects);
  const contracts = useModule(getContracts);
  const users = useModule(getUsers);
  const orgs = useModule(isOwner ? getOrganizations : async () => []);

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

  const linkDocToClaim = async (docId, claimId) => {
    setLinkBusy(true);
    try { await updateDocument(docId, { claim_id: claimId }); docs.refresh(); claims.refresh(); }
    catch (err) { setDeleteError(err.message); }
    finally { setLinkBusy(false); }
  };
  const unlinkDoc = async (docId) => {
    setLinkBusy(true);
    try { await updateDocument(docId, { claim_id: null }); docs.refresh(); claims.refresh(); }
    catch (err) { setDeleteError(err.message); }
    finally { setLinkBusy(false); }
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

  const handleSaveOrg = async (data) => {
    if (editing) await updateOrganization(editing.id, data);
    else await createOrganization(data);
    closeForm(); orgs.refresh();
  };
  const handleDeleteOrg = async (o) => {
    if (window.confirm(`¿Eliminar el cliente "${o.name}"? (sus usuarios quedan sin organización)`)) {
      try { await deleteOrganization(o.id); orgs.refresh(); setDeleteError(''); }
      catch (err) { setDeleteError(err.message); }
    }
  };
  const handleAssignAdmin = async (data) => {
    await assignOrgAdmin(assignAdminOrg.id, data);
    setAssignAdminOrg(null); orgs.refresh();
  };

  const tabConfig = {
    documents: { label: 'Documento', searchPlaceholder: 'Buscar documento (nro, descripción, contrato)...' },
    claims: { label: 'Claim', searchPlaceholder: 'Buscar claim (código, título, contrato)...' },
    companies: { label: 'Empresa', searchPlaceholder: 'Buscar por RUC o razón social...' },
    projects: { label: 'Proyecto', searchPlaceholder: 'Buscar por código o nombre...' },
    contracts: { label: 'Contrato', searchPlaceholder: 'Buscar por código o título...' },
    users: { label: 'Usuario', searchPlaceholder: 'Usuarios…' },
    organizations: { label: 'Cliente', searchPlaceholder: 'Clientes…' },
  };

  const activeModule = { documents: docs, claims, companies, projects, contracts, users, organizations: orgs }[tab];
  const cfg = tabConfig[tab];
  const importConfig = IMPORT_CONFIGS[tab];

  const handleImported = () => { activeModule?.refresh(); };

  // Quick filters for the Documents tab. Each is a dropdown built from the
  // distinct values present, so the user can narrow the register fast.
  const DOC_FILTER_FIELDS = [
    { key: 'n_contrato', label: 'Contrato' },
    { key: 'status', label: 'STATUS' },
    { key: 'status_g', label: 'STATUS G' },
    { key: 'empresa', label: 'EMPRESA' },
    { key: 'transmittal', label: '# TRANSMITTAL' },
    { key: 'responsable', label: 'RESPONSABLE' },
  ];
  const docFilterOptions = useMemo(() => {
    const opts = {};
    for (const f of DOC_FILTER_FIELDS) {
      opts[f.key] = [...new Set(docs.items.map((d) => d[f.key]).filter((v) => v != null && v !== ''))]
        .sort((a, b) => String(a).localeCompare(String(b), 'es'));
    }
    return opts;
  }, [docs.items]);
  // docFilters maps field -> array of selected values (multi-select). A field
  // with selections keeps docs whose value is any of them; fields combine (AND).
  const visibleDocs = useMemo(() => {
    const active = Object.entries(docFilters).filter(([, v]) => Array.isArray(v) && v.length);
    return active.length
      ? docs.items.filter((d) => active.every(([k, vals]) => vals.includes(String(d[k] ?? ''))))
      : docs.items;
  }, [docs.items, docFilters]);
  const anyDocFilter = Object.values(docFilters).some((v) => Array.isArray(v) && v.length);
  const activeFilterCount = Object.values(docFilters).filter((v) => Array.isArray(v) && v.length).length;

  // Create a claim inline from the side panel (no need to leave Documents).
  const handleCreateClaimInline = async (data) => {
    const created = await createClaim(data);
    claims.refresh();
    return created;
  };

  return (
    <div className={`app ${tab === 'documents' && claimMode ? 'claim-active' : ''}`}>
      <header className={`header ${headerCollapsed ? 'header-collapsed' : ''}`}>
        <div className="header-title">
          <button
            className="header-toggle"
            onClick={() => setHeaderCollapsed((v) => !v)}
            title={headerCollapsed ? 'Expandir encabezado' : 'Colapsar encabezado'}
          >
            {headerCollapsed ? '▾' : '▴'}
          </button>
          <div>
            <h1>Control Doc</h1>
            <p>Sistema de gestión contractual y documental</p>
          </div>
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
            onClick={() => { setTab(t.key); setShowForm(false); setShowImport(false); setEditing(null); setClaimDetail(null); setClaimMode(false); setSelectedClaimId(null); setDocFilters({}); setShowFilters(false); setRolesContract(null); setAssignAdminOrg(null); }}
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
            <div className="toolbar-sticky">
            <div className="toolbar">
              <input
                type="text"
                className="search-input"
                placeholder={cfg.searchPlaceholder}
                value={activeModule.search}
                onChange={(e) => activeModule.setSearch(e.target.value)}
              />
              {tab === 'documents' && (
                <div className="filters-dropdown">
                  <button
                    className={`btn ${anyDocFilter ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShowFilters((v) => !v)}
                  >
                    ⚙ Filtros{activeFilterCount ? ` (${activeFilterCount})` : ''}
                  </button>
                  {showFilters && (
                    <div className="filters-popover">
                      <div className="filters-popover-head">
                        <span className="doc-filters-hint">Ctrl+clic para elegir varios o quitar</span>
                        {anyDocFilter && (
                          <button className="chip" onClick={() => setDocFilters({})}>Limpiar</button>
                        )}
                        <button className="chip" onClick={() => setShowFilters(false)}>✕</button>
                      </div>
                      <div className="report-filters doc-filters">
                        {DOC_FILTER_FIELDS.map((f) => (
                          <label key={f.key} className="report-filter">
                            <span>{f.label} {docFilters[f.key]?.length ? `(${docFilters[f.key].length})` : ''}</span>
                            <select
                              multiple
                              size={5}
                              value={docFilters[f.key] || []}
                              onChange={(e) =>
                                setDocFilters((s) => ({ ...s, [f.key]: Array.from(e.target.selectedOptions, (o) => o.value) }))
                              }
                            >
                              {docFilterOptions[f.key].map((v) => <option key={v} value={v}>{v}</option>)}
                            </select>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {tab === 'documents' && (
                <button
                  className={`btn ${claimMode ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setClaimMode((v) => !v); setSelectedClaimId(null); }}
                >
                  🔗 {claimMode ? 'Salir de Claims' : 'Vincular a Claims'}
                </button>
              )}
              {importConfig && (
                <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
                  📋 Pegar desde Excel
                </button>
              )}
              <button className="btn btn-primary" onClick={openCreate}>
                + Nuevo {cfg.label}
              </button>
            </div>
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
                  claimMode ? (
                    <div className="docs-claim-split">
                      <div className="docs-claim-main">
                        <DocumentList
                          documents={visibleDocs}
                          onEdit={openEdit}
                          onDelete={handleDeleteDoc}
                          draggable
                          highlightClaimId={selectedClaimId}
                        />
                      </div>
                      <ClaimDropPanel
                        documents={visibleDocs}
                        claims={claims.items}
                        onAssign={linkDocToClaim}
                        onUnassign={unlinkDoc}
                        onCreateClaim={handleCreateClaimInline}
                        defaultContract={docFilters.n_contrato?.length === 1 ? docFilters.n_contrato[0] : ''}
                        selectedClaimId={selectedClaimId}
                        onSelectClaim={(id) => setSelectedClaimId((prev) => (prev === id ? null : id))}
                        busy={linkBusy}
                      />
                    </div>
                  ) : (
                    <DocumentList documents={visibleDocs} onEdit={openEdit} onDelete={handleDeleteDoc} />
                  )
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
                {tab === 'organizations' && (
                  <OrgList
                    organizations={orgs.items}
                    onEdit={openEdit}
                    onDelete={handleDeleteOrg}
                    onAssignAdmin={setAssignAdminOrg}
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
      {showForm && tab === 'organizations' && (
        <OrgForm org={editing} onSave={handleSaveOrg} onCancel={closeForm} />
      )}
      {assignAdminOrg && (
        <AssignAdminForm org={assignAdminOrg} onSave={handleAssignAdmin} onCancel={() => setAssignAdminOrg(null)} />
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
