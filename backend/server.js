require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { initDB } = require('./db');
const documentsRouter = require('./routes/documents');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/documents', documentsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Servir frontend compilado en producción
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

initDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Error al inicializar la base de datos:', err.message);
    process.exit(1);
  });
