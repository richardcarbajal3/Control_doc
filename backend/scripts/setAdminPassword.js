// Crea o restablece la contraseña del superadmin (dueño de la app).
//
// Uso en la consola de Railway (o local):
//   node backend/scripts/setAdminPassword.js
//   node backend/scripts/setAdminPassword.js correo@dominio.com MiClaveNueva
//
// Sin argumentos toma SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD del entorno.
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { pool } = require('../db');
const { hashPassword, normalizeEmail } = require('../lib/auth');

(async () => {
  const email = normalizeEmail(process.argv[2] || process.env.SUPERADMIN_EMAIL || 'richard.carbajal3@gmail.com');
  const password = process.argv[3] || process.env.SUPERADMIN_PASSWORD;
  if (!password) {
    console.error('Falta la contraseña. Define SUPERADMIN_PASSWORD o pásala: node backend/scripts/setAdminPassword.js <email> <password>');
    process.exit(1);
  }
  try {
    const r = await pool.query(
      `INSERT INTO users (email, full_name, password_hash, role, is_active)
         VALUES ($1, 'Administrador', $2, 'superadmin', TRUE)
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash, role = 'superadmin', is_active = TRUE`,
      [email, hashPassword(password)]
    );
    console.log(`OK: superadmin "${email}" listo (filas afectadas: ${r.rowCount}). Ya puedes iniciar sesión.`);
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
