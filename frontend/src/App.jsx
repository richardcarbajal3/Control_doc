import { useState, useEffect, useCallback, useRef } from 'react';
import DocumentList from './components/DocumentList';
import DocumentForm from './components/DocumentForm';
import {
  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  importDocuments,
  exportUrl,
  templateUrl,
} from './api/documents';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDocuments(search);
      setDocuments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchDocuments, 300);
    return () => clearTimeout(timer);
  }, [fetchDocuments]);

  const handleSave = async (formData) => {
    if (editingDoc) {
      await updateDocument(editingDoc.id, formData);
    } else {
      await createDocument(formData);
    }
    setShowForm(false);
    setEditingDoc(null);
    fetchDocuments();
  };

  const handleEdit = (doc) => {
    setEditingDoc(doc);
    setShowForm(true);
  };

  const handleDelete = async (doc) => {
    if (window.confirm(`¿Eliminar el documento "${doc.title}"?`)) {
      await deleteDocument(doc.id);
      fetchDocuments();
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingDoc(null);
  };

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const result = await importDocuments(file);
      setImportResult(result);
      fetchDocuments();
    } catch (err) {
      setImportResult({ error: err.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Control Documentario</h1>
        <p>Sistema de gestión y control de documentos</p>
      </header>

      <main className="main">
        <div className="toolbar">
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por código, título, disciplina, tipo o responsable..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <a className="btn btn-secondary" href={templateUrl}>
            Plantilla
          </a>
          <button
            className="btn btn-secondary"
            onClick={handlePickFile}
            disabled={importing}
          >
            {importing ? 'Importando…' : 'Importar Excel'}
          </button>
          <a className="btn btn-secondary" href={exportUrl}>
            Exportar Excel
          </a>
          <button
            className="btn btn-primary"
            onClick={() => { setEditingDoc(null); setShowForm(true); }}
          >
            + Nuevo Documento
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {loading ? (
          <div className="loading">Cargando documentos...</div>
        ) : (
          <DocumentList
            documents={documents}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </main>

      {showForm && (
        <DocumentForm
          document={editingDoc}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      {importResult && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Resultado de la importación</h2>
            {importResult.error ? (
              <div className="form-error">{importResult.error}</div>
            ) : (
              <>
                <ul className="import-summary">
                  <li><strong>Creados:</strong> {importResult.created}</li>
                  <li><strong>Actualizados:</strong> {importResult.updated}</li>
                  <li><strong>Con errores:</strong> {importResult.errors?.length || 0}</li>
                </ul>
                {importResult.errors?.length > 0 && (
                  <div className="import-errors">
                    <h3>Errores</h3>
                    <ul>
                      {importResult.errors.slice(0, 20).map((e, i) => (
                        <li key={i}>
                          Fila {e.row}{e.code ? ` (${e.code})` : ''}: {e.error}
                        </li>
                      ))}
                      {importResult.errors.length > 20 && (
                        <li>… y {importResult.errors.length - 20} más</li>
                      )}
                    </ul>
                  </div>
                )}
              </>
            )}
            <div className="form-actions">
              <button className="btn btn-primary" onClick={() => setImportResult(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
