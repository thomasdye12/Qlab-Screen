import { app, BrowserWindow, Menu, shell } from "electron";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { join } from "node:path";

let server;
let mainWindow;
let ownerToken;
let httpPort;
let ownerUrl;
let isQuitting = false;

app.setName("QLab Connect");

async function createWindow() {
  const userData = app.getPath("userData");
  ownerToken = ownerToken || randomBytes(32).toString("hex");

  process.env.QLAB_ELECTRON = "1";
  process.env.QLAB_SETTINGS_PATH = join(userData, "settings.json");
  process.env.MAC_OWNER_TOKEN = ownerToken;

  if (!server) {
    const { HTTP_PORT } = await import("../src/config.js");
    const { startServer } = await import("../server.js");
    httpPort = HTTP_PORT;
    server = startServer();
    if (!server.listening) await once(server, "listening");
  }

  ownerUrl = `http://127.0.0.1:${httpPort}/mac-settings.html?token=${ownerToken}`;
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 780,
    minWidth: 900,
    minHeight: 620,
    title: "QLab Connect",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.webContents.on("did-finish-load", () => {
    injectMacNavigation();
  });

  await mainWindow.loadURL(ownerUrl);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "QLab Connect",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { label: "Owner Console", click: showOwnerConsole },
        { label: "Monitor", click: () => showPage(`http://127.0.0.1:${httpPort}/`) },
        { label: "TV Dashboard", click: () => showPage(`http://127.0.0.1:${httpPort}/dashboard.html`) },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    }
  ]));
}

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (mainWindow) {
    showOwnerConsole();
  } else {
    createWindow();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  server?.close();
});

function showOwnerConsole() {
  showPage(ownerUrl);
}

function showPage(url) {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
  mainWindow.loadURL(url);
}

function injectMacNavigation() {
  const urls = {
    owner: ownerUrl,
    monitor: `http://127.0.0.1:${httpPort}/`,
    dashboard: `http://127.0.0.1:${httpPort}/dashboard.html`
  };
  const script = `
    (() => {
      const existing = document.querySelector("#qlabMacNav");
      if (existing) existing.remove();

      const nav = document.createElement("nav");
      nav.id = "qlabMacNav";
      nav.setAttribute("aria-label", "Mac app navigation");
      nav.style.cssText = [
        "position:fixed",
        "right:14px",
        "bottom:14px",
        "z-index:2147483647",
        "display:flex",
        "gap:8px",
        "padding:8px",
        "border:1px solid rgba(255,255,255,0.22)",
        "border-radius:8px",
        "background:rgba(5,5,5,0.88)",
        "box-shadow:0 10px 28px rgba(0,0,0,0.35)",
        "backdrop-filter:blur(12px)"
      ].join(";");

      const links = [
        ["Owner", ${JSON.stringify(urls.owner)}],
        ["Monitor", ${JSON.stringify(urls.monitor)}],
        ["Dashboard", ${JSON.stringify(urls.dashboard)}]
      ];

      for (const [label, href] of links) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.style.cssText = [
          "height:32px",
          "padding:0 10px",
          "border:1px solid rgba(255,255,255,0.24)",
          "border-radius:6px",
          "background:#fff",
          "color:#050505",
          "font:700 12px system-ui,-apple-system,BlinkMacSystemFont,sans-serif",
          "cursor:pointer"
        ].join(";");
        button.addEventListener("click", () => {
          window.location.href = href;
        });
        nav.append(button);
      }

      document.body.append(nav);
    })();
  `;
  mainWindow.webContents.executeJavaScript(script).catch(() => {});
}
