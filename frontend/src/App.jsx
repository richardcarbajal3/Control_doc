import { useState, useEffect, useCallback } from 'react';

import DocumentList from './components/DocumentList';
import DocumentForm from './components/DocumentForm';
import CompanyList from './components/CompanyList';
import CompanyForm from './components/CompanyForm';
import ProjectList from './components/ProjectList';
import ProjectForm from './components/ProjectForm';
import ContractList from './components/ContractList';
import ContractForm from './components/ContractForm';
import CorrespondenceList from './components/CorrespondenceList';
import CorrespondenceForm from './components/CorrespondenceForm';

import { getDocuments, createDocument, updateDocument, deleteDocument } from './api/documents';
import { getCompanies, createCompany, updateCompany, deleteCompany } from './api/companies';
import { getProjects, createProject, updateProject, deleteProject } from './api/projects';
import { getContracts, createContract, updateContract, deleteContract } from './api/contracts';
import { getCorrespondence, createCorrespondence, updateCorrespondence, deleteCorrespondence } from './api/correspondence';

const TABS = [
  { key: 'documents', label: 'Documentos' },
  { key: 'companies', label: 'Empresas' },
  { key: 'projects', label: 'Proyectos' },
  { key: 'contracts', label: 'Contratos' },
  { key: 'correspondence', label: 'Correspondencia' },
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

export default function App() {
  const [tab, setTab] = useState('documents');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const docs = useModule(getDocuments);
  const companies = useModule(getCompanies);
  const projects = useModule(getProjects);
  const contracts = useModule(getContracts);
  const correspondence = useModule(getCorrespondence);

  const openCreate = () => { setDeleteError(''); setEditing(null); setShowForm(true); };
  const openEdit = (item) => { setDeleteError(''); setEditing(item); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const handleSaveDoc = async (data) => {
    if (editing) await updateDocument(editing.id, data);
    else await createDocument(data);
    closeForm(); docs.refresh();
  };
  const handleDeleteDoc = async (doc) => {
    if (window.confirm(`¿Eliminar el documento "${doc.title}"?`)) {
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
    if (window.confirm(`¿Eliminar el contrato "${c.titulo}"?`)) {
      try { await deleteContract(c.id); contracts.refresh(); setDeleteError(''); }
      catch (err) { setDeleteError(err.message); }
    }
  };

  const handleSaveCorrespondence = async (data) => {
    if (editing) await updateCorrespondence(editing.id, data);
    else await createCorrespondence(data);
    closeForm(); correspondence.refresh();
  };
  const handleDeleteCorrespondence = async (c) => {
    if (window.confirm(`¿Eliminar la correspondencia "${c.code} — ${c.subject}"?`)) {
      try { await deleteCorrespondence(c.id); correspondence.refresh(); setDeleteError(''); }
      catch (err) { setDeleteError(err.message); }
    }
  };

  const tabConfig = {
    documents:      { label: 'Documento',       searchPlaceholder: 'Buscar por código o título...' },
    companies:      { label: 'Empresa',          searchPlaceholder: 'Buscar por RUC o razón social...' },
    projects:       { label: 'Proyecto',         searchPlaceholder: 'Buscar por código o nombre...' },
    contracts:      { label: 'Contrato',         searchPlaceholder: 'Buscar por código o título...' },
    correspondence: { label: 'Correspondencia',  searchPlaceholder: 'Buscar por código o asunto...' },
  };

  const activeModule = { documents: docs, companies, projects, contracts, correspondence }[tab];
  const cfg = tabConfig[tab];

  return (
    <div className="app">
      <header className="header">
        <h1>Control Doc</h1>
        <p>Sistema de gestión contractual y documental</p>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${tab === t.key ? 'tab-btn-active' : ''}`}
            onClick={() => { setTab(t.key); setShowForm(false); setEditing(null); }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="main">
        <div className="toolbar">
          <input
            type="text"
            className="search-input"
            placeholder={cfg.searchPlaceholder}
            value={activeModule.search}
            onChange={(e) => activeModule.setSearch(e.target.value)}
          />
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
            {tab === 'companies' && (
              <CompanyList companies={companies.items} onEdit={openEdit} onDelete={handleDeleteCompany} />
            )}
            {tab === 'projects' && (
              <ProjectList projects={projects.items} onEdit={openEdit} onDelete={handleDeleteProject} />
            )}
            {tab === 'contracts' && (
              <ContractList contracts={contracts.items} onEdit={openEdit} onDelete={handleDeleteContract} />
            )}
            {tab === 'correspondence' && (
              <CorrespondenceList items={correspondence.items} onEdit={openEdit} onDelete={handleDeleteCorrespondence} />
            )}
          </>
        )}
      </main>

      {showForm && tab === 'documents' && (
        <DocumentForm
          document={editing}
          projects={projects.items}
          contracts={contracts.items}
          correspondence={correspondence.items}
          onSave={handleSaveDoc}
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
      {showForm && tab === 'correspondence' && (
        <CorrespondenceForm
          item={editing}
          projects={projects.items}
          contracts={contracts.items}
          companies={companies.items}
          onSave={handleSaveCorrespondence}
          onCancel={closeForm}
        />
      )}
    </div>
  );
}
