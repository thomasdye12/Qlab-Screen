import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

export const ROOT_DIR = fileURLToPath(new URL("..", import.meta.url));
export const PUBLIC_DIR = join(ROOT_DIR, "public");
export const SETTINGS_PATH = process.env.QLAB_SETTINGS_PATH || join(ROOT_DIR, "settings.json");
export const SETTINGS_DIR = dirname(SETTINGS_PATH);
export const APP_VERSION = readAppVersion();
const SAVED_SERVER_CONFIG = readSavedServerConfig();

export const HTTP_PORT = readNumber(process.env.PORT, SAVED_SERVER_CONFIG.httpPort, 3030);
export const QLAB_TCP_PORT = readNumber(process.env.QLAB_TCP_PORT, SAVED_SERVER_CONFIG.qlabTcpPort, 53000);
export const ADMIN_USER = process.env.ADMIN_USER || SAVED_SERVER_CONFIG.adminUser || "admin";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || SAVED_SERVER_CONFIG.adminPassword || "thomas";
export const MAC_OWNER_TOKEN = process.env.MAC_OWNER_TOKEN || "";

export const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function readAppVersion() {
  try {
    const packageJson = JSON.parse(readFileSync(join(ROOT_DIR, "package.json"), "utf8"));
    return String(packageJson.version || "0.0.0");
  } catch {
    return "0.0.0";
  }
}

function readSavedServerConfig() {
  try {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf8"));
    return settings.server && typeof settings.server === "object" ? settings.server : {};
  } catch {
    return {};
  }
}

function readNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
}
