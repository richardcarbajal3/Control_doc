const { Router } = require('express');
const { pool } = require('../db');
const { createBulkHandler } = require('../lib/bulkInsert');

const router = Router();

// Columns of the documents register, in the order shown in the UI.
const DOC_COLUMNS = [
  'status', 'status_g', 'n_contrato', 'empresa', 'contrato', 'descripcion_contrato',
  'fecha', 'transmittal', 'referencia', 'documento_nro', 'rev', 'descripcion',
  'tipo_doc', 'status_contratista', 'responsable',
];

// Carga masiva por pegado desde Excel
router.post('/bulk', createBulkHandler({
  table: 'documents',
  columns: DOC_COLUMNS,
  required: [],
  dateColumns: ['fecha'],
}));

// Listar documentos (con búsqueda opcional)
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM documents';
    const params = [];

    if (search) {
      query += ` WHERE documento_nro ILIKE $1 OR descripcion ILIKE $1
                 OR n_contrato ILIKE $1 OR empresa ILIKE $1 OR transmittal ILIKE $1`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY updated_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener documento por ID
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Build (columns, placeholders, values) for the documents register fields.
function buildFields(body) {
  const cols = [];
  const placeholders = [];
  const values = [];
  let p = 1;
  for (const c of DOC_COLUMNS) {
    let v = body[c];
    if (typeof v === 'string') v = v.trim();
    cols.push(c);
    placeholders.push(`$${p++}`);
    values.push(v === '' || v === undefined ? null : v);
  }
  return { cols, placeholders, values, nextParam: p };
}

// Crear documento
router.post('/', async (req, res) => {
  try {
    const { cols, placeholders, values } = buildFields(req.body);
    const { rows } = await pool.query(
      `INSERT INTO documents (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar documento
router.put('/:id', async (req, res) => {
  try {
    const { cols, values, nextParam } = buildFields(req.body);
    const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `UPDATE documents SET ${setClause}, updated_at = NOW() WHERE id = $${nextParam} RETURNING *`,
      [...values, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar documento
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM documents WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    res.json({ message: 'Documento eliminado', document: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
