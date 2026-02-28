const { app, BrowserWindow } = require("electron");
const path = require("path");

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
    },
  });

  // Dev: load Vite dev server
  if (!app.isPackaged) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    // Prod: load built files
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});