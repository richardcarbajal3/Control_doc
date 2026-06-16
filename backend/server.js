require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { initDB } = require('./db');
const documentsRouter = require('./routes/documents');
const companiesRouter = require('./routes/companies');
const projectsRouter = require('./routes/projects');
const contractsRouter = require('./routes/contracts');
const claimsRouter = require('./routes/claims');
const reportsRouter = require('./routes/reports');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const organizationsRouter = require('./routes/organizations');
const contractMembersRouter = require('./routes/contractMembers');
const { requireAuth, requireOrgAccess } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Public auth endpoints (login).
app.use('/api/auth', authRouter);

// Health is public so platform probes work without a token.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Account administration (each router enforces its own role).
app.use('/api/users', usersRouter);
app.use('/api/organizations', organizationsRouter);
app.use('/api/contracts/:contractId/members', contractMembersRouter);

// Data routes: require a session AND belonging to an organization (or owner).
app.use('/api/documents', requireAuth, requireOrgAccess, documentsRouter);
app.use('/api/companies', requireAuth, requireOrgAccess, companiesRouter);
app.use('/api/projects', requireAuth, requireOrgAccess, projectsRouter);
app.use('/api/contracts', requireAuth, requireOrgAccess, contractsRouter);
app.use('/api/claims', requireAuth, requireOrgAccess, claimsRouter);
app.use('/api/reports', requireAuth, requireOrgAccess, reportsRouter);

// Servir frontend compilado en producción
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
const indexHtml = path.join(frontendDist, 'index.html');

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));

  // SPA fallback: solo para rutas que NO son /api
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(indexHtml);
  });
}

initDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
      console.log(`Frontend dist existe: ${fs.existsSync(indexHtml)}`);
    });
  })
  .catch((err) => {
    console.error('Error al inicializar la base de datos:', err.message);
    process.exit(1);
  });
