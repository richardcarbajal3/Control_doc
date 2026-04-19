const { Router } = require('express');
const ExcelJS = require('exceljs');
const multer = require('multer');
const { pool } = require('../db');

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const EXCEL_COLUMNS = [
  { header: 'Código',         key: 'code',        width: 18 },
  { header: 'Título',         key: 'title',       width: 40 },
  { header: 'Versión',        key: 'version',     width: 10 },
  { header: 'Estado',         key: 'status',      width: 14 },
  { header: 'Disciplina',     key: 'discipline',  width: 18 },
  { header: 'Tipo',           key: 'type',        width: 16 },
  { header: 'Responsable',    key: 'responsible', width: 22 },
  { header: 'Fecha Emisión',  key: 'issue_date',  width: 14 },
  { header: 'Notas',          key: 'notes',       width: 40 },
];

const HEADER_ALIASES = {
  'codigo': 'code', 'code': 'code',
  'titulo': 'title', 'title': 'title', 'nombre': 'title',
  'version': 'version', 'rev': 'version', 'revision': 'version',
  'estado': 'status', 'status': 'status',
  'disciplina': 'discipline', 'discipline': 'discipline',
  'tipo': 'type', 'type': 'type',
  'responsable': 'responsible', 'responsible': 'responsible', 'dueno': 'responsible',
  'fechaemision': 'issue_date', 'fecha': 'issue_date', 'issuedate': 'issue_date',
  'notas': 'notes', 'notes': 'notes', 'observaciones': 'notes',
};

function normalizeHeader(raw) {
  if (raw == null) return '';
  return String(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function cellText(cell) {
  if (cell == null) return '';
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object' && 'richText' in v) {
    return v.richText.map((t) => t.text).join('').trim();
  }
  if (typeof v === 'object' && 'text' in v) return String(v.text).trim();
  if (typeof v === 'object' && 'result' in v) return String(v.result ?? '').trim();
  return String(v).trim();
}

function cellDate(cell) {
  if (cell == null || cell.value == null) return null;
  const v = cell.value;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function buildWorkbook(rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Control Documentario';
  wb.created = new Date();
  const ws = wb.addWorksheet('Documentos');
  ws.columns = EXCEL_COLUMNS;
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: 'middle' };
  rows.forEach((r) => {
    ws.addRow({
      code: r.code,
      title: r.title,
      version: r.version,
      status: r.status,
      discipline: r.discipline,
      type: r.type,
      responsible: r.responsible,
      issue_date: r.issue_date ? new Date(r.issue_date) : null,
      notes: r.notes,
    });
  });
  ws.getColumn('issue_date').numFmt = 'yyyy-mm-dd';
  return wb;
}

// Listar documentos (con búsqueda opcional)
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM documents';
    const params = [];

    if (search) {
      query += ' WHERE code ILIKE $1 OR title ILIKE $1 OR discipline ILIKE $1 OR type ILIKE $1 OR responsible ILIKE $1';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY updated_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Exportar todos los documentos a Excel
router.get('/export', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM documents ORDER BY code ASC');
    const wb = buildWorkbook(rows);
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="documentos_${today}.xlsx"`
    );
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Descargar plantilla Excel vacía con encabezados y un ejemplo
router.get('/template', async (req, res) => {
  try {
    const wb = buildWorkbook([
      {
        code: 'DOC-001',
        title: 'Ejemplo de título',
        version: '1.0',
        status: 'Borrador',
        discipline: 'Civil',
        type: 'Plano',
        responsible: 'Juan Pérez',
        issue_date: new Date(),
        notes: 'Reemplazar esta fila con tus documentos',
      },
    ]);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="plantilla_documentos.xlsx"'
    );
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Importar documentos desde Excel (upsert por código)
router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió archivo (campo "file")' });
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(req.file.buffer);
  } catch (err) {
    return res.status(400).json({ error: 'No se pudo leer el archivo Excel' });
  }

  const ws = wb.worksheets[0];
  if (!ws || ws.rowCount < 2) {
    return res.status(400).json({ error: 'La hoja está vacía o solo tiene encabezados' });
  }

  // Map headers → DB columns
  const headerRow = ws.getRow(1);
  const colMap = {};
  headerRow.eachCell((cell, colNumber) => {
    const key = HEADER_ALIASES[normalizeHeader(cellText(cell))];
    if (key) colMap[colNumber] = key;
  });

  if (!Object.values(colMap).includes('code') || !Object.values(colMap).includes('title')) {
    return res.status(400).json({
      error: 'El Excel debe tener al menos las columnas "Código" y "Título"',
    });
  }

  const client = await pool.connect();
  const result = { created: 0, updated: 0, skipped: 0, errors: [] };

  try {
    await client.query('BEGIN');

    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      if (!row.hasValues) continue;

      const data = {
        code: '', title: '', version: null, status: null,
        discipline: null, type: null, responsible: null,
        issue_date: null, notes: null,
      };

      for (const [colNumber, key] of Object.entries(colMap)) {
        const cell = row.getCell(Number(colNumber));
        if (key === 'issue_date') {
          data[key] = cellDate(cell);
        } else {
          const text = cellText(cell);
          data[key] = text === '' ? null : text;
        }
      }

      if (!data.code || !data.title) {
        // Skip empty rows silently, report partial rows
        const anyValue = Object.values(data).some((v) => v != null && v !== '');
        if (anyValue) {
          result.errors.push({ row: i, error: 'Falta código o título' });
        }
        continue;
      }

      try {
        const upsert = await client.query(
          `INSERT INTO documents
             (code, title, version, status, discipline, type, responsible, issue_date, notes)
           VALUES ($1, $2, COALESCE($3,'1.0'), COALESCE($4,'Borrador'), $5, $6, $7, $8, $9)
           ON CONFLICT (code) DO UPDATE SET
             title       = EXCLUDED.title,
             version     = COALESCE(EXCLUDED.version, documents.version),
             status      = COALESCE(EXCLUDED.status, documents.status),
             discipline  = EXCLUDED.discipline,
             type        = EXCLUDED.type,
             responsible = EXCLUDED.responsible,
             issue_date  = EXCLUDED.issue_date,
             notes       = EXCLUDED.notes,
             updated_at  = NOW()
           RETURNING (xmax = 0) AS inserted`,
          [
            data.code, data.title, data.version, data.status,
            data.discipline, data.type, data.responsible,
            data.issue_date, data.notes,
          ]
        );
        if (upsert.rows[0].inserted) result.created++;
        else result.updated++;
      } catch (err) {
        result.errors.push({ row: i, code: data.code, error: err.message });
      }
    }

    await client.query('COMMIT');
    res.json(result);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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

// Crear documento
router.post('/', async (req, res) => {
  try {
    const {
      code, title, version, status,
      discipline, type, responsible, issue_date, notes,
    } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO documents
         (code, title, version, status, discipline, type, responsible, issue_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        code, title,
        version || '1.0',
        status || 'Borrador',
        discipline || null,
        type || null,
        responsible || null,
        issue_date || null,
        notes || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un documento con ese código' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Actualizar documento
router.put('/:id', async (req, res) => {
  try {
    const {
      code, title, version, status,
      discipline, type, responsible, issue_date, notes,
    } = req.body;
    const { rows } = await pool.query(
      `UPDATE documents
         SET code = $1, title = $2, version = $3, status = $4,
             discipline = $5, type = $6, responsible = $7,
             issue_date = $8, notes = $9,
             updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        code, title, version, status,
        discipline || null,
        type || null,
        responsible || null,
        issue_date || null,
        notes || null,
        req.params.id,
      ]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un documento con ese código' });
    }
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
