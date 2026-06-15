const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Pending = STATUS G not "ATENDIDO". Due 3 days after FECHA; overdue when past due.
const SLA_DAYS = 3;
const DOC_CTE = `
  WITH d AS (
    SELECT
      doc.*,
      (UPPER(TRIM(COALESCE(doc.status_g,''))) <> 'ATENDIDO') AS is_pending,
      CASE WHEN doc.fecha IS NOT NULL
        THEN GREATEST(0, (CURRENT_DATE - (doc.fecha + INTERVAL '${SLA_DAYS} day')::date))
      END AS dias_atraso
    FROM documents doc
  )
`;

// Dashboard de presentación para Documentos / Correspondencia.
router.get('/documents', async (req, res) => {
  try {
    const totals = await pool.query(`${DOC_CTE}
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE is_pending) AS pendientes,
        COUNT(*) FILTER (WHERE NOT is_pending) AS atendidos,
        COUNT(*) FILTER (WHERE is_pending AND COALESCE(dias_atraso,0) > 0) AS atrasados,
        COALESCE(MAX(dias_atraso) FILTER (WHERE is_pending), 0) AS max_atraso,
        COALESCE(ROUND(AVG(dias_atraso) FILTER (WHERE is_pending AND dias_atraso > 0)), 0) AS prom_atraso
      FROM d`);

    const byResponsable = await pool.query(`${DOC_CTE}
      SELECT
        COALESCE(NULLIF(TRIM(responsable),''), 'Sin responsable') AS responsable,
        COUNT(*) FILTER (WHERE is_pending) AS pendientes,
        COUNT(*) FILTER (WHERE is_pending AND COALESCE(dias_atraso,0) > 0) AS atrasados,
        COALESCE(MAX(dias_atraso) FILTER (WHERE is_pending), 0) AS max_atraso
      FROM d
      GROUP BY 1
      HAVING COUNT(*) FILTER (WHERE is_pending) > 0
      ORDER BY atrasados DESC, pendientes DESC`);

    const byStatusG = await pool.query(`${DOC_CTE}
      SELECT COALESCE(NULLIF(TRIM(status_g),''), '(sin estado)') AS status_g, COUNT(*) AS count
      FROM d GROUP BY 1 ORDER BY count DESC`);

    const pendientesList = await pool.query(`${DOC_CTE}
      SELECT id, documento_nro, descripcion, responsable, n_contrato, empresa,
             fecha, status, status_g, dias_atraso, claim_id
      FROM d
      WHERE is_pending
      ORDER BY COALESCE(dias_atraso,0) DESC, fecha NULLS LAST
      LIMIT 500`);

    res.json({
      sla_days: SLA_DAYS,
      totals: totals.rows[0],
      byResponsable: byResponsable.rows,
      byStatusG: byStatusG.rows,
      pendientes: pendientesList.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
