// Electron main process — runs the backend INLINE (not forked).
// Why inline: a forked child running from inside app.asar can't reliably resolve
// require() calls into its sibling node_modules. Loading the server module in
// the main process lets Electron's asar-aware require do the work, and the
// native better-sqlite3 still gets pulled from app.asar.unpacked automatically.

const { app, BrowserWindow, dialog, Menu, shell } = require('electron');
const path = require('path');
const http = require('http');
const os = require('os');
const fs = require('fs');

const PORT = parseInt(process.env.SAS_PORT, 10) || 5000;
const IS_DEV = process.env.ELECTRON_DEV === '1';

let mainWindow = null;
let backendLoaded = false;
let lastBackendError = null;

function resolveServerScript() {
  // In dev:   <repo>/server/server.js
  // In prod:  <install>/resources/app.asar/server/server.js
  // Both resolve the same way relative to electron/main.js, and Electron's
  // require can read from inside asar.
  return path.join(__dirname, '..', 'server', 'server.js');
}

function getDataDir() {
  // Windows:  C:\Users\<you>\AppData\Roaming\SAS Accounts
  const dir = app.getPath('userData');
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'backups'), { recursive: true });
  return dir;
}

function getLanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

function startBackend() {
  // Dev: a separate `npm run server` already runs it.
  if (IS_DEV) return Promise.resolve();
  if (backendLoaded) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const dataDir = getDataDir();

    // env vars must be set BEFORE requiring server (db.js reads SAS_DB_PATH at load).
    process.env.PORT = String(PORT);
    process.env.HOST = '0.0.0.0';
    process.env.SAS_DB_PATH = path.join(dataDir, 'sas_accounts.db');
    process.env.SAS_BACKUP_DIR = path.join(dataDir, 'backups');
    process.env.NODE_ENV = 'production';

    // Surface any later async crash for the dialog.
    process.on('uncaughtException', (e) => {
      lastBackendError = e;
      console.error('[backend uncaught]', e);
    });
    process.on('unhandledRejection', (e) => {
      lastBackendError = e;
      console.error('[backend unhandled]', e);
    });

    try {
      require(resolveServerScript());
      backendLoaded = true;
    } catch (e) {
      return reject(new Error(
        `Backend failed to load.\n\n${e.stack || e.message}\n\n` +
        `DB path tried: ${process.env.SAS_DB_PATH}\n` +
        `Server script: ${resolveServerScript()}`
      ));
    }

    // Poll /api/health until the listener answers.
    const start = Date.now();
    const timeoutMs = 30_000;
    const intervalMs = 250;

    const ping = () => {
      const req = http.get(
        { host: '127.0.0.1', port: PORT, path: '/api/health', timeout: 2000 },
        (res) => {
          res.resume();
          if (res.statusCode === 200) return resolve();
          retry();
        }
      );
      req.on('error', retry);
      req.on('timeout', () => { req.destroy(); retry(); });
    };

    const retry = () => {
      if (lastBackendError) {
        return reject(new Error(
          `Backend crashed during startup:\n\n${lastBackendError.stack || lastBackendError.message}`
        ));
      }
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(
          `Backend started but didn't respond on http://127.0.0.1:${PORT}/api/health within 30s.`
        ));
      }
      setTimeout(ping, intervalMs);
    };

    ping();
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.ico');
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const url = IS_DEV ? 'http://localhost:3000' : `http://127.0.0.1:${PORT}`;
  mainWindow.loadURL(url);

  const lan = getLanAddresses();
  if (lan.length) {
    console.log(`\n  Open on phone (same Wi-Fi):  ${lan.map(ip => `http://${ip}:${PORT}`).join('  |  ')}\n`);
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url: u }) => {
    if (u.startsWith('http')) shell.openExternal(u);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  if (IS_DEV) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function buildMenu() {
  const lan = getLanAddresses().map(ip => `http://${ip}:${PORT}`);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'App',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { label: lan.length ? `Phone URL: ${lan[0]}` : 'Phone URL: unavailable', enabled: false },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
  ]));
}

app.whenReady().then(async () => {
  try {
    await startBackend();
    buildMenu();
    createWindow();
  } catch (err) {
    dialog.showErrorBox('SAS Accounts — Startup Error', err.message || String(err));
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
