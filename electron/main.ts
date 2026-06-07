import { app, BrowserWindow, nativeImage, protocol } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { registerIpcHandlers } from './ipc-handlers';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
};

// Register custom protocol BEFORE app.ready so it has privileged status.
// Loading the renderer via `app://` instead of `file://` is required because
// Chromium treats each file:// URL as a unique origin which breaks ES module loading.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

const iconPath = path.join(__dirname, '../../build/icon.png');

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  registerIpcHandlers();

  const icon = nativeImage.createFromPath(iconPath);

  const titleBarOpts: Electron.BrowserWindowConstructorOptions =
    process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' }
      : {
          titleBarStyle: 'hidden',
          titleBarOverlay: { color: '#181825', symbolColor: '#cdd6f4', height: 40 },
          autoHideMenuBar: true,
        };

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    ...titleBarOpts,
    backgroundColor: '#1e1e2e',
    icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.platform === 'darwin' && app.dock && !icon.isEmpty()) {
    app.dock.setIcon(icon);
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Use app://localhost/... so URL parses with proper host + pathname.
    mainWindow.loadURL('app://localhost/index.html');
  }

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[did-fail-load] code=${code} desc=${desc} url=${url}`);
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error(`[render-process-gone]`, details);
  });
  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.log(`[renderer console] level=${level} ${sourceId}:${line} ${message}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: 'Git Desktop',
    applicationVersion: app.getVersion(),
    version: '',
    copyright: '© 2026 Mykhailo Bovtriuk',
    website: 'https://github.com/MykhailoBovtriuk/git-desktop',
    iconPath,
    credits: 'A cross-platform Git desktop client with visual commit graph and conflict resolution.',
  });

  protocol.handle('app', async (request) => {
    try {
      const url = new URL(request.url);
      const relativePath = decodeURIComponent(url.pathname.replace(/^\//, '')) || 'index.html';
      const filePath = path.join(__dirname, '../../dist', relativePath);
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
      const data = await fs.readFile(filePath);
      // Convert Node Buffer to Uint8Array so Response is happy in both Node and Electron contexts.
      const body = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      return new Response(body, { headers: { 'Content-Type': contentType } });
    } catch (err) {
      console.error(`[app://] 404 for ${request.url}:`, err);
      return new Response('Not Found', { status: 404 });
    }
  });
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
