// Electron Linux Desktop Companion Launcher for Blinky
const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

function createBlinkyWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Window size for the desktop companion widget
  const winWidth = 340;
  const winHeight = 400;

  const win = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    // Place in the bottom right corner above the taskbar
    x: width - winWidth - 30,
    y: height - winHeight - 30,
    transparent: true,          // Background transparency
    frame: false,                // Frameless window
    alwaysOnTop: true,           // Floats above other windows
    resizable: false,
    hasShadow: false,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load the web application or local build
  win.loadURL('http://localhost:5173');

  // Optional: Set window to click-through or draggable
  // win.setIgnoreMouseEvents(true, { forward: true });
}

// Linux transparency flags
app.commandLine.appendSwitch('enable-transparent-visuals');
app.commandLine.appendSwitch('disable-gpu-vsync');

app.whenReady().then(createBlinkyWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
