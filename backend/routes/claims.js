const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { createBulkHandler } = require('../lib/bulkInsert');

// A document is PENDING when STATUS G is not "ATENDIDO" (case/space-insensitive).
const PENDING_SQL = "UPPER(TRIM(COALESCE(d.status_g,''))) <> 'ATENDIDO'";
// Days overdue: a document is due 3 days after its FECHA (date of entry).
const DIAS_ATRASO_SQL =
  "CASE WHEN d.fecha IS NOT NULL THEN GREATEST(0, (CURRENT_DATE - (d.fecha + INTERVAL '3 day')::date)) END";

// Carga masiva por pegado desde Excel
router.post('/bulk', createBulkHandler({
  table: 'claims',
  columns: ['code', 'title', 'type', 'n_contrato', 'status', 'description'],
  required: ['title'],
}));

// Listar claims con conteo de documentos y pendientes
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT c.*,
        COUNT(d.id) AS doc_count,
        COUNT(d.id) FILTER (WHERE ${PENDING_SQL}) AS pendientes
      FROM claims c
      LEFT JOIN claim_documents cd ON cd.claim_id = c.id
      LEFT JOIN documents d ON d.id = cd.document_id
    `;
    const params = [];
    if (search) {
      query += ' WHERE c.code ILIKE $1 OR c.title ILIKE $1 OR c.n_contrato ILIKE $1';
      params.push(`%${search}%`);
    }
    query += ' GROUP BY c.id ORDER BY c.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener un claim con sus documentos de soporte (con días de atraso)
router.get('/:id', async (req, res) => {
  try {
    const claimRes = await pool.query('SELECT * FROM claims WHERE id = $1', [req.params.id]);
    if (claimRes.rows.length === 0) return res.status(404).json({ error: 'Claim no encontrado' });
    const docs = await pool.query(
      `SELECT d.*, cd.relacion,
         (${PENDING_SQL}) AS is_pending,
         ${DIAS_ATRASO_SQL} AS dias_atraso
       FROM claim_documents cd
       JOIN documents d ON d.id = cd.document_id
       WHERE cd.claim_id = $1
       ORDER BY d.fecha NULLS LAST, d.id`,
      [req.params.id]
    );
    res.json({ ...claimRes.rows[0], documents: docs.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Adjuntar un documento existente al claim. relacion: 'soporte' | 'referencia'.
// Un mismo documento puede adjuntarse a varios claims (relación N:N).
router.post('/:id/documents', async (req, res) => {
  const { document_id, relacion } = req.body;
  if (!document_id) return res.status(400).json({ error: 'document_id es requerido' });
  const rel = relacion === 'referencia' ? 'referencia' : 'soporte';
  try {
    await pool.query(
      `INSERT INTO claim_documents (claim_id, document_id, relacion)
       VALUES ($1, $2, $3)
       ON CONFLICT (claim_id, document_id) DO UPDATE SET relacion = EXCLUDED.relacion`,
      [req.params.id, document_id, rel]
    );
    res.status(201).json({ claim_id: Number(req.params.id), document_id: Number(document_id), relacion: rel });
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ error: 'Claim o documento no existe' });
    res.status(500).json({ error: err.message });
  }
});

// Quitar un documento del claim (no elimina el documento, solo el vínculo).
router.delete('/:id/documents/:documentId', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM claim_documents WHERE claim_id = $1 AND document_id = $2 RETURNING document_id',
      [req.params.id, req.params.documentId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'El documento no estaba en este claim' });
    res.json({ message: 'Documento quitado del claim' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { code, title, type, n_contrato, status, description } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'El título es requerido' });
  try {
    const result = await pool.query(
      `INSERT INTO claims (code, title, type, n_contrato, status, description)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [code || null, title.trim(), type || 'Otro', n_contrato || null, status || 'Abierto', description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { code, title, type, n_contrato, status, description } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'El título es requerido' });
  try {
    const result = await pool.query(
      `UPDATE claims SET code=$1, title=$2, type=$3, n_contrato=$4, status=$5, description=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [code || null, title.trim(), type, n_contrato || null, status, description || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Claim no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM claims WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Claim no encontrado' });
    res.json({ message: 'Claim eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
