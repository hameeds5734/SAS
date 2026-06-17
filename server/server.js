const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const cors = require('cors');

const app = express();

// CORS still useful in dev (CRA at :3000 hits API at :5000); harmless in prod.
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ---- API routes ----
app.use('/api/places',        require('./routes/places'));
app.use('/api/customers',     require('./routes/customers'));
app.use('/api/base-products', require('./routes/baseProducts'));
app.use('/api/products',      require('./routes/products'));
app.use('/api/bills',         require('./routes/bills'));
app.use('/api/payments',      require('./routes/payments'));
app.use('/api/reports',       require('./routes/reports'));
app.use('/api/admin',         require('./routes/admin'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ---- Serve the React production build (when it exists) ----
// In packaged Electron, build/ lives at: <install>/resources/app.asar/build
// In a `node server/server.js` run from the repo, it lives at: <repo>/build
const buildCandidates = [
  path.join(__dirname, '..', 'build'),
  path.join(process.resourcesPath || '', 'app.asar', 'build'),
];
const buildDir = buildCandidates.find(p => p && fs.existsSync(path.join(p, 'index.html')));

if (buildDir) {
  app.use(express.static(buildDir, { maxAge: '7d', index: 'index.html' }));
  // Client-side-routing fallback: anything that isn't /api/* gets index.html.
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(buildDir, 'index.html'));
  });
  console.log(`[server] serving React build from ${buildDir}`);
} else {
  console.log('[server] no build/ found — running API-only (use the CRA dev server for the UI)');
}

// ---- Listen on every interface so LAN devices (phones, tablets) can reach it ----
const PORT = parseInt(process.env.PORT, 10) || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) {
        console.log(`[server]   reachable at http://${ni.address}:${PORT}`);
      }
    }
  }
});
