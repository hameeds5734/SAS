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

// Returns the machine's LAN IPv4 addresses so the UI can display
// "Mobile: http://192.168.x.x:5000" for the user to type into their phone.
app.get('/api/network', (_req, res) => {
  const port = parseInt(process.env.PORT, 10) || 5000;
  const ips = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) ips.push(ni.address);
    }
  }
  res.json({ port, ips, urls: ips.map(ip => `http://${ip}:${port}`) });
});

// ---- Serve the React production build (when it exists) ----
// Lookup rule:
//   - In packaged Electron, __dirname lives inside app.asar. We MUST serve
//     static assets from the unpacked sibling (app.asar.unpacked/build) —
//     express.static reads files via fs.createReadStream which can't open
//     a virtual asar entry reliably.
//   - In dev (`node server/server.js`), use the plain build/ sibling.
function resolveBuildDir() {
  const localBuild = path.join(__dirname, '..', 'build');
  if (localBuild.includes('app.asar') && !localBuild.includes('app.asar.unpacked')) {
    const unpacked = localBuild.replace(/app\.asar(?=[\\/])/, 'app.asar.unpacked');
    if (fs.existsSync(path.join(unpacked, 'index.html'))) return unpacked;
  }
  if (fs.existsSync(path.join(localBuild, 'index.html'))) return localBuild;
  return null;
}
const buildDir = resolveBuildDir();

if (buildDir) {
  app.use(express.static(buildDir, {
    index: 'index.html',
    setHeaders: (res, filePath) => {
      // index.html must never be cached — it's the entry point that names the
      // current main.<hash>.js. A cached stale index.html keeps pointing at
      // chunks that no longer exist after a rebuild → ChunkLoadError.
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else if (/\.[a-f0-9]{8,}\./.test(filePath)) {
        // Content-hashed filename (main.abc12345.js, etc.) — safe forever.
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    },
  }));

  // Only serve index.html for real navigations — never for missing assets.
  // An asset request (with a file extension or under /static/) that the static
  // middleware couldn't satisfy is a genuine 404; returning index.html instead
  // would corrupt the JS chunk loader with HTML and trigger
  //   "Uncaught SyntaxError: Unexpected token '<'"
  app.get(/^\/(?!api\/).*/, (req, res, next) => {
    const looksLikeAsset = /\.[a-zA-Z0-9]{2,5}$/.test(req.path) || req.path.startsWith('/static/');
    if (looksLikeAsset) return res.status(404).send('Not found: ' + req.path);
    if (!req.accepts('html')) return next();
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
