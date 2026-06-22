import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

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
import DocumentDetail from './components/DocumentDetail';
import ContractMembers from './components/ContractMembers';
import UserList from './components/UserList';
import UserForm from './components/UserForm';
import OrgList from './components/OrgList';
import OrgForm from './components/OrgForm';
import OrgSettings from './components/OrgSettings';
import AssignAdminForm from './components/AssignAdminForm';
import Login from './components/Login';
import PasteGrid from './components/PasteGrid';
import ReportView from './components/ReportView';
import PresentationReport from './components/PresentationReport';
import RFIPanel from './components/RFIPanel';
import ChangeOrderList from './components/ChangeOrderList';
import ChangeOrderForm from './components/ChangeOrderForm';
import ChangeOrderDetail from './components/ChangeOrderDetail';
import ClassificationRules from './components/ClassificationRules';
import { IMPORT_CONFIGS } from './lib/importConfig';
import { useFloatingPanel } from './lib/useFloatingPanel';
import { applyClassification } from './lib/classify';

import { getDocuments, createDocument, updateDocument, deleteDocument } from './api/documents';
import { getCompanies, createCompany, updateCompany, deleteCompany } from './api/companies';
import { getProjects, createProject, updateProject, deleteProject } from './api/projects';
import { getContracts, createContract, updateContract, deleteContract } from './api/contracts';
import { getClaims, createClaim, updateClaim, deleteClaim, addDocToClaim, removeDocFromClaim } from './api/claims';
import { getChangeOrders, createChangeOrder, updateChangeOrder, deleteChangeOrder } from './api/changeOrders';
import { getUsers, createUser, updateUser, deleteUser } from './api/users';
import {
  getOrganizations, createOrganization, updateOrganization, deleteOrganization, assignOrgAdmin,
} from './api/organizations';
import { getMe, logout } from './api/auth';
import { getToken } from './api/http';
import { getRules } from './api/classificationRules';

const BASE_TABS = [
  { key: 'documents', label: 'Documentos' },
  { key: 'claims', label: 'Claims' },
  { key: 'change-orders', label: 'Órd. Cambio' },
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
  const [claimFloat, setClaimFloat] = useState(() => {
    try { return localStorage.getItem('claimDock.float') === '1'; } catch { return false; }
  });
  const [claimMin, setClaimMin] = useState(() => {
    try { return localStorage.getItem('claimDock.min') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('claimDock.float', claimFloat ? '1' : '0'); } catch { /* ignore */ }
  }, [claimFloat]);
  useEffect(() => {
    try { localStorage.setItem('claimDock.min', claimMin ? '1' : '0'); } catch { /* ignore */ }
  }, [claimMin]);
  const [linkBusy, setLinkBusy] = useState(false);
  const [docFilters, setDocFilters] = useState({});
  // Persisted custom order of the document filter segments (drag to reorder).
  const [filterOrder, setFilterOrder] = useState(() => {
    try {
      const raw = localStorage.getItem('docFilters.order');
      const arr = raw ? JSON.parse(raw) : null;
      return Array.isArray(arr) ? arr : null;
    } catch { return null; }
  });
  useEffect(() => {
    try {
      if (filterOrder) localStorage.setItem('docFilters.order', JSON.stringify(filterOrder));
    } catch { /* ignore */ }
  }, [filterOrder]);
  const [dragFilter, setDragFilter] = useState(null);
  const [dragOverFilter, setDragOverFilter] = useState(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showFilterHelp, setShowFilterHelp] = useState(() => {
    try { return localStorage.getItem('docFilters.help') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('docFilters.help', showFilterHelp ? '1' : '0'); } catch { /* ignore */ }
  }, [showFilterHelp]);
  const filtersRef = useRef(null);
  const filtersPanel = useFloatingPanel('docFilters', { defaultPos: { x: 24, y: 132 }, enabled: showFilters });

  // Auto-collapse the page header to a single line after 3s so the document
  // list gets the maximum vertical space. The toggle button still works.
  useEffect(() => {
    const t = setTimeout(() => setHeaderCollapsed(true), 3000);
    return () => clearTimeout(t);
  }, []);

  // Close the filters popover when clicking outside of it.
  useEffect(() => {
    if (!showFilters) return undefined;
    const onDown = (e) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target)) setShowFilters(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showFilters]);
  const [selectedClaimIds, setSelectedClaimIds] = useState([]);
  const [docDetail, setDocDetail] = useState(null);
  const [coDetail, setCoDetail] = useState(null);
  const [claimView, setClaimView] = useState('highlight'); // highlight | related | unrelated
  const [rolesContract, setRolesContract] = useState(null);
  const [assignAdminOrg, setAssignAdminOrg] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [showOrgSettings, setShowOrgSettings] = useState(false);
  const [onedriveBaseUrl, setOnedriveBaseUrl] = useState(currentUser.onedrive_base_url || null);
  const [classificationRules, setClassificationRules] = useState([]);
  const [showClassification, setShowClassification] = useState(false);

  useEffect(() => {
    getRules().then(setClassificationRules).catch(() => {});
  }, []);

  const docs = useModule(getDocuments);
  const claims = useModule(getClaims);
  const changeOrders = useModule(getChangeOrders);
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
    try { await addDocToClaim(claimId, docId); docs.refresh(); claims.refresh(); }
    catch (err) { setDeleteError(err.message); }
    finally { setLinkBusy(false); }
  };
  const unlinkDoc = async (docId, claimId) => {
    setLinkBusy(true);
    try { await removeDocFromClaim(claimId, docId); docs.refresh(); claims.refresh(); }
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

  const handleSaveChangeOrder = async (data) => {
    if (editing) await updateChangeOrder(editing.id, data);
    else await createChangeOrder(data);
    closeForm(); changeOrders.refresh();
  };
  const handleDeleteChangeOrder = async (co) => {
    if (window.confirm(`¿Eliminar la orden de cambio "${co.title}"?`)) {
      try { await deleteChangeOrder(co.id); changeOrders.refresh(); setDeleteError(''); }
      catch (err) { setDeleteError(err.message); }
    }
  };

  // Contextual row-click: RFI → RFIPanel, else → DocumentDetail
  const handleDocRowClick = (doc) => {
    const tipo = (doc.tipo_doc || '').toUpperCase().trim();
    if (tipo === 'RFI') setDocDetail({ ...doc, _panel: 'rfi' });
    else setDocDetail(doc);
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
    'change-orders': { label: 'Orden de Cambio', searchPlaceholder: 'Buscar por código, título o contrato...' },
    companies: { label: 'Empresa', searchPlaceholder: 'Buscar por RUC o razón social...' },
    projects: { label: 'Proyecto', searchPlaceholder: 'Buscar por código o nombre...' },
    contracts: { label: 'Contrato', searchPlaceholder: 'Buscar por código o título...' },
    users: { label: 'Usuario', searchPlaceholder: 'Usuarios…' },
    organizations: { label: 'Cliente', searchPlaceholder: 'Clientes…' },
  };

  const activeModule = { documents: docs, claims, 'change-orders': changeOrders, companies, projects, contracts, users, organizations: orgs }[tab];
  const cfg = tabConfig[tab];
  const importConfig = IMPORT_CONFIGS[tab];

  const handleImported = () => { activeModule?.refresh(); };

  // Documents with virtual `familia` field derived from classification rules.
  const docsWithFamilia = useMemo(
    () => applyClassification(docs.items, classificationRules),
    [docs.items, classificationRules]
  );

  // Quick filters for the Documents tab. Each is a dropdown built from the
  // distinct values present, so the user can narrow the register fast.
  const DOC_FILTER_FIELDS = [
    { key: 'familia', label: 'FAMILIA' },
    { key: 'n_contrato', label: 'Contrato' },
    { key: 'status', label: 'STATUS' },
    { key: 'status_g', label: 'STATUS G' },
    { key: 'empresa', label: 'EMPRESA' },
    { key: 'transmittal', label: '# TRANSMITTAL' },
    { key: 'responsable', label: 'RESPONSABLE' },
  ];
  // Filter fields laid out in the user's saved order. Unknown/new fields are
  // appended so the list stays complete even after the field set changes.
  const orderedFilterFields = useMemo(() => {
    if (!filterOrder) return DOC_FILTER_FIELDS;
    const byKey = new Map(DOC_FILTER_FIELDS.map((f) => [f.key, f]));
    const ordered = filterOrder.map((k) => byKey.get(k)).filter(Boolean);
    for (const f of DOC_FILTER_FIELDS) {
      if (!ordered.includes(f)) ordered.push(f);
    }
    return ordered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOrder]);
  // Move a filter segment to where another one sits (drag-and-drop reorder).
  const moveFilter = (fromKey, toKey) => {
    if (!fromKey || fromKey === toKey) return;
    const base = orderedFilterFields.map((f) => f.key);
    const from = base.indexOf(fromKey);
    const to = base.indexOf(toKey);
    if (from === -1 || to === -1) return;
    const next = [...base];
    next.splice(from, 1);
    next.splice(to, 0, fromKey);
    setFilterOrder(next);
  };
  const docFilterOptions = useMemo(() => {
    const opts = {};
    for (const f of DOC_FILTER_FIELDS) {
      opts[f.key] = [...new Set(docsWithFamilia.map((d) => d[f.key]).filter((v) => v != null && v !== ''))]
        .sort((a, b) => String(a).localeCompare(String(b), 'es'));
    }
    return opts;
  }, [docsWithFamilia]);
  // docFilters maps field -> array of selected values (multi-select). A field
  // with selections keeps docs whose value is any of them; fields combine (AND).
  const visibleDocs = useMemo(() => {
    const active = Object.entries(docFilters).filter(([, v]) => Array.isArray(v) && v.length);
    return active.length
      ? docsWithFamilia.filter((d) => active.every(([k, vals]) => vals.includes(String(d[k] ?? ''))))
      : docsWithFamilia;
  }, [docsWithFamilia, docFilters]);
  const anyDocFilter = Object.values(docFilters).some((v) => Array.isArray(v) && v.length);
  const activeFilterCount = Object.values(docFilters).filter((v) => Array.isArray(v) && v.length).length;

  // When the documents are filtered by contract, the claims panel follows suit:
  // only claims belonging to the selected contract(s) remain visible.
  const visibleClaims = useMemo(() => {
    const contracts = docFilters.n_contrato;
    if (!Array.isArray(contracts) || !contracts.length) return claims.items;
    return claims.items.filter((c) => contracts.includes(String(c.n_contrato ?? '')));
  }, [claims.items, docFilters.n_contrato]);

  // Claim-mode view: count related/unrelated among the currently visible docs,
  // and pick which subset the table shows depending on the chosen mode.
  const hasClaim = (d) => Array.isArray(d.claim_ids) && d.claim_ids.length > 0;
  const inSelected = (d) => Array.isArray(d.claim_ids) && d.claim_ids.some((id) => selectedClaimIds.includes(id));
  const relatedCount = useMemo(() => visibleDocs.filter(hasClaim).length, [visibleDocs]);
  const unrelatedCount = visibleDocs.length - relatedCount;
  const claimViewDocs = useMemo(() => {
    if (claimView === 'unrelated') return visibleDocs.filter((d) => !hasClaim(d));
    if (claimView === 'related') {
      const rel = visibleDocs.filter(hasClaim);
      // Selecting one or more claims focuses the view on just those claims (union).
      return selectedClaimIds.length ? rel.filter(inSelected) : rel;
    }
    return visibleDocs;
  }, [visibleDocs, claimView, selectedClaimIds]);

  // Create a claim inline from the side panel (no need to leave Documents).
  const handleCreateClaimInline = async (data) => {
    const created = await createClaim(data);
    claims.refresh();
    return created;
  };

  return (
    <div className={`app ${tab === 'documents' && claimMode ? 'claim-active' : ''} ${claimMode && claimFloat ? 'claim-floating' : ''} ${claimMode && claimMin ? 'claim-min' : ''} ${headerCollapsed ? 'header-collapsed-app' : ''}`}>
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
          {isAdmin && !isOwner && (
            <button
              className="btn btn-secondary btn-small"
              onClick={() => setShowOrgSettings(true)}
              title="Configurar integración OneDrive"
            >
              📁 OneDrive
            </button>
          )}
          <button className="btn btn-secondary btn-small" onClick={onLogout}>Salir</button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${tab === t.key ? 'tab-btn-active' : ''}`}
            onClick={() => { setTab(t.key); setShowForm(false); setShowImport(false); setEditing(null); setClaimDetail(null); setDocDetail(null); setClaimMode(false); setSelectedClaimIds([]); setClaimView('highlight'); setDocFilters({}); setShowFilters(false); setRolesContract(null); setAssignAdminOrg(null); }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className={`main${tab === 'documents' ? ' main-full' : ''}`}>
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
                <div className="filters-dropdown" ref={filtersRef}>
                  <button
                    className={`btn ${anyDocFilter ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShowFilters((v) => !v)}
                  >
                    ⚙ Filtros{activeFilterCount ? ` (${activeFilterCount})` : ''}
                  </button>
                  {showFilters && (
                    <div
                      className="filters-popover filters-popover--float"
                      ref={filtersPanel.panelRef}
                      style={filtersPanel.style}
                    >
                      <div className="filters-popover-bar" onPointerDown={filtersPanel.onDragStart}>
                        <span className="filters-popover-title">
                          <span className="claim-dock-grip" aria-hidden="true">⠿</span>
                          Filtros{activeFilterCount ? ` (${activeFilterCount})` : ''}
                        </span>
                        <span className="filters-popover-ctls">
                          {anyDocFilter && (
                            <button className="chip" onClick={() => setDocFilters({})}>Limpiar</button>
                          )}
                          <button
                            className={`dock-ctl ${showFilterHelp ? 'dock-ctl-on' : ''}`}
                            title={showFilterHelp ? 'Ocultar ayuda' : 'Mostrar ayuda'}
                            onClick={() => setShowFilterHelp((v) => !v)}
                          >
                            ?
                          </button>
                          <button className="dock-ctl" title="Cerrar" onClick={() => setShowFilters(false)}>✕</button>
                        </span>
                      </div>
                      <div className="filters-popover-body">
                        {showFilterHelp && (
                          <div className="doc-filters-hint">Ctrl+clic para elegir varios o quitar · arrastra ⠿ para reordenar los filtros</div>
                        )}
                        <div className="report-filters doc-filters">
                          {orderedFilterFields.map((f) => (
                            <label
                              key={f.key}
                              className={`report-filter ${dragOverFilter === f.key && dragFilter !== f.key ? 'filter-drop-over' : ''} ${dragFilter === f.key ? 'filter-dragging' : ''}`}
                              onDragOver={(e) => { if (dragFilter) { e.preventDefault(); setDragOverFilter(f.key); } }}
                              onDragLeave={() => setDragOverFilter((k) => (k === f.key ? null : k))}
                              onDrop={(e) => {
                                e.preventDefault();
                                moveFilter(e.dataTransfer.getData('text/filter') || dragFilter, f.key);
                                setDragFilter(null);
                                setDragOverFilter(null);
                              }}
                            >
                              <span className="report-filter-head">
                                <span
                                  className="filter-grip"
                                  draggable
                                  title="Arrastra para reordenar"
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('text/filter', f.key);
                                    e.dataTransfer.effectAllowed = 'move';
                                    setDragFilter(f.key);
                                  }}
                                  onDragEnd={() => { setDragFilter(null); setDragOverFilter(null); }}
                                >⠿</span>
                                <span className="filter-label-text">{f.label} {docFilters[f.key]?.length ? `(${docFilters[f.key].length})` : ''}</span>
                              </span>
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
                    </div>
                  )}
                </div>
              )}
              {tab === 'documents' && isAdmin && (
                <button
                  className={`btn btn-secondary`}
                  onClick={() => setShowClassification(true)}
                  title="Reglas de clasificación de documentos por familia"
                >
                  🗂 Clasificación
                </button>
              )}
              {tab === 'documents' && (
                <button
                  className={`btn ${claimMode ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setClaimMode((v) => !v); setSelectedClaimIds([]); setClaimView('highlight'); }}
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
                          documents={claimViewDocs}
                          onEdit={openEdit}
                          onDelete={handleDeleteDoc}
                          draggable
                          highlightClaimIds={claimView === 'highlight' ? selectedClaimIds : []}
                          onRowClick={handleDocRowClick}
                          onedriveBaseUrl={onedriveBaseUrl}
                        />
                      </div>
                      <ClaimDropPanel
                        documents={visibleDocs}
                        claims={visibleClaims}
                        onAssign={linkDocToClaim}
                        onUnassign={unlinkDoc}
                        onCreateClaim={handleCreateClaimInline}
                        defaultContract={docFilters.n_contrato?.length === 1 ? docFilters.n_contrato[0] : ''}
                        selectedClaimIds={selectedClaimIds}
                        onSelectClaim={(id) => setSelectedClaimIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
                        viewMode={claimView}
                        onViewMode={setClaimView}
                        relatedCount={relatedCount}
                        unrelatedCount={unrelatedCount}
                        busy={linkBusy}
                        floating={claimFloat}
                        onToggleFloat={() => setClaimFloat((v) => !v)}
                        minimized={claimMin}
                        onToggleMinimize={() => setClaimMin((v) => !v)}
                        onOpenDetail={(c) => setClaimDetail(c)}
                      />
                    </div>
                  ) : (
                    <DocumentList documents={visibleDocs} onEdit={openEdit} onDelete={handleDeleteDoc} onRowClick={handleDocRowClick} onedriveBaseUrl={onedriveBaseUrl} />
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
                {tab === 'change-orders' && (
                  <ChangeOrderList
                    changeOrders={changeOrders.items}
                    onEdit={openEdit}
                    onDelete={handleDeleteChangeOrder}
                    onOpen={(co) => setCoDetail(co)}
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
                    onedriveBaseUrl={onedriveBaseUrl}
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
      {showForm && tab === 'change-orders' && (
        <ChangeOrderForm co={editing} onSave={handleSaveChangeOrder} onCancel={closeForm} />
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
          floating={claimMode}
        />
      )}

      {docDetail && docDetail._panel === 'rfi' ? (
        <RFIPanel
          doc={docDetail}
          allDocuments={docs.items}
          onClose={() => setDocDetail(null)}
          onChanged={() => { docs.refresh(); claims.refresh(); }}
        />
      ) : docDetail ? (
        <DocumentDetail
          doc={docDetail}
          allDocuments={docs.items}
          claims={claims.items}
          onClose={() => setDocDetail(null)}
          onedriveBaseUrl={onedriveBaseUrl}
        />
      ) : null}

      {coDetail && (
        <ChangeOrderDetail
          co={coDetail}
          allDocuments={docs.items}
          onClose={() => setCoDetail(null)}
          onChanged={() => changeOrders.refresh()}
        />
      )}

      {rolesContract && (
        <ContractMembers contract={rolesContract} onClose={() => setRolesContract(null)} />
      )}

      {showOrgSettings && (
        <OrgSettings
          currentValue={onedriveBaseUrl}
          onSaved={(url) => { setOnedriveBaseUrl(url); setShowOrgSettings(false); }}
          onCancel={() => setShowOrgSettings(false)}
        />
      )}

      {showClassification && (
        <ClassificationRules
          onClose={() => setShowClassification(false)}
          onChange={() => getRules().then(setClassificationRules).catch(() => {})}
        />
      )}
    </div>
  );
}
