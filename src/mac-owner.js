import { MAC_OWNER_TOKEN } from "./config.js";

export function isMacOwnerPath(pathname) {
  return pathname === "/mac-settings.html" ||
    pathname.startsWith("/api/mac/");
}

export function hasMacOwnerAccess(request, url) {
  if (!MAC_OWNER_TOKEN) return false;
  if (!isLocalRequest(request)) return false;
  return url.searchParams.get("token") === MAC_OWNER_TOKEN ||
    request.headers["x-mac-owner-token"] === MAC_OWNER_TOKEN;
}

export function denyMacOwnerAccess(response) {
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

function isLocalRequest(request) {
  const remoteAddress = request.socket?.remoteAddress || "";
  return remoteAddress === "127.0.0.1" ||
    remoteAddress === "::1" ||
    remoteAddress === "::ffff:127.0.0.1";
}
