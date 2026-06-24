// Limpia el registro de DOCUMENTOS conservando las relaciones de claims ya
// formadas para un contrato, para poder re-subir la información desde cero.
//
// Problema que resuelve: los vínculos claim<->documento viven en la tabla
// claim_documents, que tiene ON DELETE CASCADE sobre el documento. Si se borran
// los documentos, los vínculos desaparecen; y al re-subir, los documentos
// reciben IDs nuevos, así que no bastaría con "no tocar" claim_documents.
//
// Solución: guardamos cada vínculo por su CLAVE DE NEGOCIO estable
// (# TRANSMITTAL + DOCUMENTO NRO, la misma que usa la autosincronización), junto
// con los campos por línea del claim (claim_note / claim_data). Tras re-subir,
// re-emparejamos por esa clave y restauramos los vínculos.
//
// Los claims (la tabla claims) NUNCA se borran: solo se borran documentos.
//
// FLUJO recomendado (ejecutar con DATABASE_URL apuntando a la BD, p.ej. en la
// consola de Railway o local):
//   1) node backend/scripts/resetDocsKeepClaims.js snapshot        # guarda vínculos
//   2) node backend/scripts/resetDocsKeepClaims.js clear --yes     # borra documentos
//   3) (re-subir la información de Documentos por la app / sincronización)
//   4) node backend/scripts/resetDocsKeepClaims.js relink          # restaura vínculos
//   -  node backend/scripts/resetDocsKeepClaims.js status          # ver estado
//
// El contrato objetivo por defecto es OS23031832. Se puede cambiar con
// --contract=CODIGO. `snapshot` es acumulativo/idempotente (re-ejecutarlo
// refresca la foto del contrato). `clear` es destructivo y exige --yes.
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { pool } = require('../db');

const DEFAULT_CONTRACT = 'OS23031832';

function parseArgs(argv) {
  const args = { _: [] };
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      args[k] = v === undefined ? true : v;
    } else {
      args._.push(a);
    }
  }
  return args;
}

// Tabla persistente donde vive la foto de los vínculos. No referencia a
// documents por FK (a propósito) para sobrevivir al borrado de documentos.
async function ensureSnapshotTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS claim_link_snapshot (
      id              SERIAL PRIMARY KEY,
      claim_id        INTEGER NOT NULL,
      organization_id INTEGER,
      n_contrato      VARCHAR(120),
      transmittal     VARCHAR(255),
      documento_nro   VARCHAR(255),
      orig_claim_id   INTEGER,
      claim_note      TEXT,
      claim_data      JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at      TIMESTAMP DEFAULT NOW()
    )`);
}

// Guarda los vínculos del contrato objetivo. Toma los vínculos donde el claim
// pertenece al contrato O el documento pertenece al contrato (cubre ambos
// criterios). Solo guarda filas con clave de negocio utilizable.
async function snapshot(contract) {
  const client = await pool.connect();
  try {
    await ensureSnapshotTable(client);
    await client.query('BEGIN');
    // Refresca la foto de este contrato (borra la anterior del mismo contrato).
    await client.query('DELETE FROM claim_link_snapshot WHERE TRIM(n_contrato) = $1', [contract]);
    const ins = await client.query(
      `INSERT INTO claim_link_snapshot
         (claim_id, organization_id, n_contrato, transmittal, documento_nro,
          orig_claim_id, claim_note, claim_data)
       SELECT cd.claim_id, d.organization_id, $1, d.transmittal, d.documento_nro,
              d.claim_id, d.claim_note, COALESCE(d.claim_data, '{}'::jsonb)
       FROM claim_documents cd
       JOIN documents d ON d.id = cd.document_id
       JOIN claims    c ON c.id = cd.claim_id
       WHERE (TRIM(COALESCE(c.n_contrato, '')) = $1 OR TRIM(COALESCE(d.n_contrato, '')) = $1)
         AND COALESCE(TRIM(d.transmittal), '') <> ''
         AND COALESCE(TRIM(d.documento_nro), '') <> ''
       RETURNING id`,
      [contract]
    );
    // Cuenta vínculos descartados por no tener clave de negocio (para avisar).
    const dropped = await client.query(
      `SELECT COUNT(*)::int AS n
       FROM claim_documents cd
       JOIN documents d ON d.id = cd.document_id
       JOIN claims    c ON c.id = cd.claim_id
       WHERE (TRIM(COALESCE(c.n_contrato, '')) = $1 OR TRIM(COALESCE(d.n_contrato, '')) = $1)
         AND (COALESCE(TRIM(d.transmittal), '') = '' OR COALESCE(TRIM(d.documento_nro), '') = '')`,
      [contract]
    );
    const claims = await client.query(
      'SELECT COUNT(DISTINCT claim_id)::int AS n FROM claim_link_snapshot WHERE TRIM(n_contrato) = $1',
      [contract]
    );
    await client.query('COMMIT');
    console.log(`Snapshot de "${contract}":`);
    console.log(`  Vínculos guardados : ${ins.rowCount}`);
    console.log(`  Claims involucrados: ${claims.rows[0].n}`);
    if (dropped.rows[0].n > 0) {
      console.log(`  ⚠ Vínculos SIN clave de negocio (no se podrán re-vincular): ${dropped.rows[0].n}`);
    }
    console.log('Listo. Ahora puedes ejecutar: clear --yes');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Borra documentos. Por defecto TODO el registro (lo pedido: limpiar todo el
// log). Con --contract limita el borrado a ese contrato. Exige --yes.
async function clear(args) {
  const onlyContract = args.contract ? String(args.contract) : null;
  const snap = await pool.query('SELECT COUNT(*)::int AS n FROM claim_link_snapshot').catch(() => ({ rows: [{ n: 0 }] }));
  if (snap.rows[0].n === 0) {
    console.error('Abortado: no hay snapshot guardado. Ejecuta primero "snapshot".');
    process.exit(1);
  }
  let countQ = 'SELECT COUNT(*)::int AS n FROM documents';
  const params = [];
  if (onlyContract) { countQ += ' WHERE TRIM(COALESCE(n_contrato, \'\')) = $1'; params.push(onlyContract); }
  const before = await pool.query(countQ, params);
  if (!args.yes) {
    console.log(`Se borrarían ${before.rows[0].n} documento(s)${onlyContract ? ` del contrato ${onlyContract}` : ' (TODO el registro)'}.`);
    console.log('Vuelve a ejecutar con --yes para confirmar.');
    return;
  }
  let delQ = 'DELETE FROM documents';
  if (onlyContract) delQ += ' WHERE TRIM(COALESCE(n_contrato, \'\')) = $1';
  const r = await pool.query(delQ, params);
  console.log(`Documentos borrados: ${r.rowCount}`);
  console.log('Los vínculos claim_documents asociados se eliminaron en cascada, pero quedan guardados en el snapshot.');
  console.log('Tras re-subir la información, ejecuta: relink');
}

// Restaura los vínculos: empareja cada fila del snapshot con los documentos
// re-subidos por (organización, # TRANSMITTAL, DOCUMENTO NRO) y re-crea el
// vínculo en claim_documents; además restaura claim_note / claim_data y el
// claim_id legado (solo si está vacío) en el documento emparejado.
async function relink(contract) {
  const client = await pool.connect();
  try {
    await ensureSnapshotTable(client);
    await client.query('BEGIN');
    const snap = await client.query(
      'SELECT * FROM claim_link_snapshot WHERE TRIM(n_contrato) = $1',
      [contract]
    );
    let linked = 0, restoredFields = 0, unmatched = 0;
    for (const s of snap.rows) {
      const matches = await client.query(
        `SELECT id FROM documents
         WHERE organization_id IS NOT DISTINCT FROM $1
           AND TRIM(COALESCE(transmittal, ''))   = TRIM($2)
           AND TRIM(COALESCE(documento_nro, '')) = TRIM($3)`,
        [s.organization_id, s.transmittal || '', s.documento_nro || '']
      );
      if (matches.rows.length === 0) { unmatched++; continue; }
      for (const m of matches.rows) {
        await client.query(
          `INSERT INTO claim_documents (claim_id, document_id, organization_id)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [s.claim_id, m.id, s.organization_id]
        );
        linked++;
        // Restaura los campos por línea del claim si el snapshot los traía.
        const hasNote = s.claim_note != null && String(s.claim_note).trim() !== '';
        const hasData = s.claim_data && JSON.stringify(s.claim_data) !== '{}';
        if (hasNote || hasData || s.orig_claim_id != null) {
          await client.query(
            `UPDATE documents SET
               claim_note = COALESCE($2, claim_note),
               claim_data = CASE WHEN $3::jsonb <> '{}'::jsonb THEN $3::jsonb ELSE claim_data END,
               claim_id   = COALESCE(claim_id, $4),
               updated_at = NOW()
             WHERE id = $1`,
            [m.id, hasNote ? s.claim_note : null, JSON.stringify(s.claim_data || {}), s.orig_claim_id]
          );
          restoredFields++;
        }
      }
    }
    await client.query('COMMIT');
    console.log(`Relink de "${contract}":`);
    console.log(`  Filas en snapshot         : ${snap.rowCount}`);
    console.log(`  Vínculos restaurados      : ${linked}`);
    console.log(`  Documentos con campos rest.: ${restoredFields}`);
    if (unmatched > 0) {
      console.log(`  ⚠ Sin emparejar (no re-subidos aún o clave distinta): ${unmatched}`);
      console.log('    Re-sube esos documentos y vuelve a ejecutar relink (es idempotente).');
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function status(contract) {
  const docs = await pool.query('SELECT COUNT(*)::int AS n FROM documents');
  const snapExists = await pool.query(
    "SELECT to_regclass('public.claim_link_snapshot') IS NOT NULL AS ok"
  );
  console.log(`Documentos actuales en la BD: ${docs.rows[0].n}`);
  if (!snapExists.rows[0].ok) {
    console.log('Aún no existe snapshot (ejecuta "snapshot").');
    return;
  }
  const snap = await pool.query(
    'SELECT COUNT(*)::int AS n, COUNT(DISTINCT claim_id)::int AS claims FROM claim_link_snapshot WHERE TRIM(n_contrato) = $1',
    [contract]
  );
  console.log(`Snapshot de "${contract}": ${snap.rows[0].n} vínculo(s), ${snap.rows[0].claims} claim(s).`);
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  const contract = (args.contract ? String(args.contract) : DEFAULT_CONTRACT).trim();
  try {
    switch (cmd) {
      case 'snapshot': await snapshot(contract); break;
      case 'clear':    await clear(args); break;
      case 'relink':   await relink(contract); break;
      case 'status':   await status(contract); break;
      default:
        console.log('Uso: node backend/scripts/resetDocsKeepClaims.js <comando> [--contract=CODIGO] [--yes]');
        console.log('Comandos: snapshot | clear --yes | relink | status');
        console.log(`Contrato por defecto: ${DEFAULT_CONTRACT}`);
        break;
    }
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
