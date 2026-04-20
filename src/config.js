import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT_DIR = fileURLToPath(new URL("..", import.meta.url));
export const PUBLIC_DIR = join(ROOT_DIR, "public");
export const SETTINGS_PATH = join(ROOT_DIR, "settings.json");

export const HTTP_PORT = Number(process.env.PORT || 3030);
export const QLAB_TCP_PORT = Number(process.env.QLAB_TCP_PORT || 53000);
export const ADMIN_USER = process.env.ADMIN_USER || "admin";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "thomas";

export const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};
