import { app, BrowserWindow, nativeImage, protocol, session } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { killAllTerminals, registerIpcHandlers } from './ipc-handlers';
import { resolveAppAssetPath } from './app-asset-path';
import { RepoWatcher } from './repo-watcher';
import { initDeepLinks, registerProtocol } from './auth/deep-link';
import { handleAuthCallback } from './ipc/account';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

// Register the custom protocol before app.ready. `app://` instead of `file://`:
// Chromium gives each file:// URL its own origin, which breaks ES modules.
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

// Both before app.ready: protocol registration writes the Windows registry, and
// losing the single-instance race means just forwarding args.
registerProtocol();

const isPrimaryInstance = initDeepLinks(url => {
  void handleAuthCallback(url).then(() => {
    // The user is looking at a browser tab right now; the result is in here.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

if (!isPrimaryInstance) {
  app.quit();
}

const repoWatcher = new RepoWatcher(() => {
  mainWindow?.webContents.send('repo:changed');
});

function createWindow() {
  const icon = nativeImage.createFromPath(iconPath);

  const titleBarOpts: Electron.BrowserWindowConstructorOptions =
    process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' }
      : {
          titleBarStyle: 'hidden',
          // Startup colours only — the first render replaces them with the
          // palette read from CSS variables (see src/hooks/use-theme.ts).
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
    mainWindow.loadURL('app://localhost/index.html');
  }

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (e, url) => {
    const allowed = process.env.VITE_DEV_SERVER_URL
      ? url.startsWith(process.env.VITE_DEV_SERVER_URL)
      : url.startsWith('app://localhost');
    if (!allowed) e.preventDefault();
  });

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
  if (!isPrimaryInstance) return;

  app.setAboutPanelOptions({
    applicationName: 'Git Desktop',
    applicationVersion: app.getVersion(),
    version: '',
    copyright: '© 2026 Mykhailo Bovtriuk',
    website: 'https://github.com/MykhailoBovtriuk/git-desktop',
    iconPath,
    credits:
      'A cross-platform Git desktop client with visual commit graph and conflict resolution.',
  });

  const distRoot = path.resolve(__dirname, '../../dist');

  protocol.handle('app', async request => {
    const resolved = resolveAppAssetPath(distRoot, request.url);
    if (!resolved.ok) {
      console.error(`[app://] 403 forbidden for ${request.url}`);
      return new Response('Forbidden', { status: 403 });
    }
    const { filePath } = resolved;
    try {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
      const data = await fs.readFile(filePath);
      const body = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      return new Response(body, { headers: { 'Content-Type': contentType } });
    } catch (err) {
      console.error(`[app://] 404 for ${request.url}:`, err);
      return new Response('Not Found', { status: 404 });
    }
  });

  // Strict CSP in production only: in dev it would break the Vite dev server
  // and HMR.
  if (!process.env.VITE_DEV_SERVER_URL) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            [
              "default-src 'self' app:",
              "script-src 'self'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: app:",
              "font-src 'self' app: data:",
              "connect-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          ],
        },
      });
    });
  }

  registerIpcHandlers({
    onRepoOpened: root => repoWatcher.watch(root),
    getWindow: () => mainWindow,
    logDir: path.join(app.getPath('userData'), 'logs'),
  });
  createWindow();
});

app.on('before-quit', () => killAllTerminals());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
