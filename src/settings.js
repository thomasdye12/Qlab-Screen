import { mkdir, readFile, writeFile } from "node:fs/promises";
import { SETTINGS_DIR, SETTINGS_PATH } from "./config.js";

let settings = await loadSettings();

export function getSettings() {
  return settings;
}

export async function updateSettings(nextSettings) {
  settings = normalizeSettings(nextSettings);
  await mkdir(SETTINGS_DIR, { recursive: true });
  await writeFile(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return settings;
}

export function publicSettings() {
  return {
    host: settings.host,
    workspaceId: settings.workspaceId,
    autoConnect: settings.autoConnect,
    hasPasscode: Boolean(settings.passcode)
  };
}

export function serverSettings() {
  return settings.server;
}

export function publicServerSettings() {
  return {
    httpPort: settings.server.httpPort,
    qlabTcpPort: settings.server.qlabTcpPort,
    adminUser: settings.server.adminUser,
    hasAdminPassword: Boolean(settings.server.adminPassword)
  };
}

export async function updateServerSettings(nextServerSettings) {
  return updateSettings({
    ...settings,
    server: {
      ...settings.server,
      ...nextServerSettings
    }
  });
}

async function loadSettings() {
  try {
    const content = await readFile(SETTINGS_PATH, "utf8");
    const saved = JSON.parse(content);
    return normalizeSettings(saved);
  } catch {
    return normalizeSettings({});
  }
}

function normalizeSettings(saved) {
  const server = saved.server && typeof saved.server === "object" ? saved.server : {};
  return {
    host: String(saved.host || ""),
    passcode: String(saved.passcode || ""),
    workspaceId: String(saved.workspaceId || ""),
    autoConnect: Boolean(saved.autoConnect),
    server: {
      httpPort: readPositiveNumber(server.httpPort, 3030),
      qlabTcpPort: readPositiveNumber(server.qlabTcpPort, 53000),
      adminUser: String(server.adminUser || "admin"),
      adminPassword: String(server.adminPassword || "thomas")
    }
  };
}

function readPositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
