import { useState, useEffect, useCallback } from 'react';
import DocumentList from './components/DocumentList';
import DocumentForm from './components/DocumentForm';
import {
  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
} from './api/documents';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [loading, setLoading] = useState(true);

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
            placeholder="Buscar por código o título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={() => { setEditingDoc(null); setShowForm(true); }}
          >
            + Nuevo Documento
          </button>
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
    </div>
  );
}
