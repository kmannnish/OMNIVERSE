const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');
const { createServer } = require('./server.js');

let mainWindow = null;
let serverInstance = null;
const PORT = 39428;

function startApp() {
  const server = createServer();
  serverInstance = server.listen(PORT, '127.0.0.1', () => {
    console.log(`[OMNIVERSE] Standalone server active on http://127.0.0.1:${PORT}`);
    createWindow();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1140,
    height: 820,
    minWidth: 850,
    minHeight: 620,
    backgroundColor: '#06070B',
    title: 'OMNIVERSE — Boundless Streams within One Luminous Core',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      if (!url.includes(`127.0.0.1:${PORT}`)) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startApp();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (serverInstance) {
    try { serverInstance.close(); } catch {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
