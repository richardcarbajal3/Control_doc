// Backfill: claims sin N° de contrato heredan el de los documentos que ya
// tienen vinculados. Aplica retroactivamente lo que el sistema ya hace al
// vincular, para los claims creados antes de esa lógica.
//
// Uso en la consola de Railway (o local con DATABASE_URL):
//   node backend/scripts/backfillClaimContract.js
//
// Es idempotente: solo rellena claims con contrato vacío y nunca sobrescribe
// uno ya definido. Cuando los documentos de un claim apuntan a varios
// contratos, gana el más frecuente (desempate alfabético).
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { pool } = require('../db');

(async () => {
  try {
    const r = await pool.query(`
      WITH doc_contract AS (
        SELECT cd.claim_id,
               TRIM(d.n_contrato) AS n_contrato,
               COUNT(*)           AS cnt
        FROM claim_documents cd
        JOIN documents d ON d.id = cd.document_id
        WHERE COALESCE(TRIM(d.n_contrato), '') <> ''
        GROUP BY cd.claim_id, TRIM(d.n_contrato)
      ),
      ranked AS (
        SELECT claim_id, n_contrato,
               ROW_NUMBER() OVER (PARTITION BY claim_id ORDER BY cnt DESC, n_contrato) AS rn
        FROM doc_contract
      )
      UPDATE claims c
         SET n_contrato = r.n_contrato, updated_at = NOW()
        FROM ranked r
       WHERE c.id = r.claim_id
         AND r.rn = 1
         AND COALESCE(TRIM(c.n_contrato), '') = ''
      RETURNING c.id, c.code, c.title, c.n_contrato`);
    if (r.rowCount === 0) {
      console.log('Nada que actualizar: no hay claims sin contrato con documentos que lo aporten.');
    } else {
      console.log(`Claims actualizados: ${r.rowCount}`);
      for (const row of r.rows) {
        console.log(`  #${row.id} ${row.code || ''} "${row.title}" -> ${row.n_contrato}`);
      }
    }
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
