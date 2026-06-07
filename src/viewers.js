import { getClientIp } from "./http-utils.js";

const liveViewers = new Map();

export function registerLiveViewer(request, response, { page = "unknown", clientId = "" } = {}) {
  const viewer = {
    clientId: clientId || `anon:${Math.random().toString(36).slice(2, 10)}`,
    page,
    ip: getClientIp(request),
    forwardedFor: request.headers["x-forwarded-for"] || "",
    userAgent: request.headers["user-agent"] || "",
    connectedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    visible: true
  };

  liveViewers.set(response, viewer);
  response.on("close", () => {
    liveViewers.delete(response);
  });
  return viewer;
}

export function updateViewerPresence(request, payload = {}) {
  const clientId = String(payload.clientId || "").trim();
  if (!clientId) return;

  for (const viewer of liveViewers.values()) {
    if (viewer.clientId !== clientId) continue;
    viewer.page = String(payload.page || viewer.page || "unknown");
    viewer.visible = payload.visible !== false;
    viewer.lastSeenAt = new Date().toISOString();
    viewer.ip = getClientIp(request);
  }
}

export function touchLiveViewers() {
  const now = new Date().toISOString();
  for (const viewer of liveViewers.values()) {
    viewer.lastSeenAt = now;
  }
}

export function listViewers() {
  return Array.from(liveViewers.values())
    .sort((left, right) => right.connectedAt.localeCompare(left.connectedAt));
}
