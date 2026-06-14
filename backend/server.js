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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/documents', documentsRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/contracts', contractsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
