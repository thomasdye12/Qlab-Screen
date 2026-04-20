import { ADMIN_PASSWORD, ADMIN_USER } from "./config.js";

export function isAdminPath(pathname) {
  return pathname === "/admin.html" ||
    pathname === "/admin.js" ||
    pathname.startsWith("/api/admin/");
}

export function hasAdminAuth(request) {
  const header = request.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;

  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const splitAt = decoded.indexOf(":");
    const username = decoded.slice(0, splitAt);
    const password = decoded.slice(splitAt + 1);
    return username === ADMIN_USER && password === ADMIN_PASSWORD;
  } catch {
    return false;
  }
}

export function requestAdminAuth(response) {
  response.writeHead(401, {
    "WWW-Authenticate": 'Basic realm="QLab Screen Admin"',
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end("Authentication required.");
}
