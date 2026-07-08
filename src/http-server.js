import http from "node:http";
import { hasAdminAuth, isAdminPath, requestAdminAuth } from "./auth.js";
import { ADMIN_PASSWORD, ADMIN_USER, HTTP_PORT, QLAB_TCP_PORT, SETTINGS_PATH } from "./config.js";
import { broadcastHeartbeat, handleEvents } from "./events.js";
import { sendJson, readBody, serveStatic } from "./http-utils.js";
import { denyMacOwnerAccess, hasMacOwnerAccess, isMacOwnerPath } from "./mac-owner.js";
import { connectToQlab, disconnectQlab } from "./qlab.js";
import { getSettings, publicServerSettings, publicSettings, updateServerSettings, updateSettings } from "./settings.js";
import { publicStatePatch, state } from "./state.js";
import { listViewers, updateViewerPresence } from "./viewers.js";

export function createHttpServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);

      if (isMacOwnerPath(url.pathname) && !hasMacOwnerAccess(request, url)) {
        return denyMacOwnerAccess(response);
      }

      if (isAdminPath(url.pathname) && !hasAdminAuth(request)) {
        return requestAdminAuth(response);
      }

      if (url.pathname === "/api/connect" && request.method === "POST") {
        return handleConnect(request, response);
      }

      if (url.pathname === "/api/disconnect" && request.method === "POST") {
        return handleDisconnect(response);
      }

      if (url.pathname === "/api/saved-settings" && request.method === "GET") {
        return sendJson(response, publicSettings());
      }

      if (url.pathname === "/api/admin/settings" && request.method === "POST") {
        return handleSaveSettings(request, response);
      }

      if (url.pathname === "/api/mac/settings" && request.method === "GET") {
        return handleMacSettings(response);
      }

      if (url.pathname === "/api/mac/settings" && request.method === "POST") {
        return handleSaveMacSettings(request, response);
      }

      if (url.pathname === "/api/admin/viewers" && request.method === "GET") {
        return sendJson(response, { viewers: listViewers() });
      }

      if (url.pathname === "/api/presence" && request.method === "POST") {
        return handlePresence(request, response);
      }

      if (url.pathname === "/api/state") {
        return sendJson(response, state);
      }

      if (url.pathname === "/api/status") {
        return sendJson(response, publicStatePatch());
      }

      if (url.pathname === "/events") {
        return handleEvents(request, response);
      }

      return serveStatic(url.pathname, response);
    } catch (error) {
      console.error(error);
      sendJson(response, { error: error.message }, error.status || 500);
    }
  });
}

export function startHeartbeat() {
  return setInterval(broadcastHeartbeat, 10000);
}

async function handleConnect(request, response) {
  const body = await readBody(request);
  const settings = getSettings();
  const host = String(body.host || "").trim();
  const workspaceId = String(body.workspaceId || "").trim();
  const requestedPasscode = String(body.passcode || "").trim();
  const canUseSavedPasscode = host === settings.host && (!workspaceId || workspaceId === settings.workspaceId);
  const passcode = requestedPasscode || (canUseSavedPasscode ? settings.passcode : "");

  if (!host) {
    return sendJson(response, { error: "QLab host is required." }, 400);
  }

  try {
    await connectToQlab({ host, passcode, workspaceId });
    sendJson(response, state);
  } catch (error) {
    state.connected = false;
    state.lastError = error.message;
    sendJson(response, { error: error.message }, 502);
  }
}

async function handleSaveSettings(request, response) {
  try {
    const body = await readBody(request);
    const previous = getSettings();
    const nextSettings = {
      ...previous,
      host: String(body.host || "").trim(),
      passcode: String(body.passcode || previous.passcode || "").trim(),
      workspaceId: String(body.workspaceId || "").trim(),
      autoConnect: Boolean(body.autoConnect)
    };

    if (!nextSettings.host) {
      return sendJson(response, { error: "QLab host is required." }, 400);
    }

    await updateSettings(nextSettings);

    if (nextSettings.autoConnect) {
      await connectToQlab(nextSettings);
    }

    sendJson(response, { ok: true, settings: publicSettings(), state });
  } catch (error) {
    sendJson(response, { error: error.message }, error.status || 500);
  }
}

function handleMacSettings(response) {
  sendJson(response, {
    qlab: publicSettings(),
    server: publicServerSettings(),
    active: {
      httpPort: HTTP_PORT,
      qlabTcpPort: QLAB_TCP_PORT,
      adminUser: ADMIN_USER,
      settingsPath: SETTINGS_PATH
    }
  });
}

async function handleSaveMacSettings(request, response) {
  const body = await readBody(request);
  const previous = getSettings();
  const qlab = body.qlab || {};
  const server = body.server || {};
  const nextSettings = {
    ...previous,
    host: String(qlab.host || "").trim(),
    passcode: String(qlab.passcode || previous.passcode || "").trim(),
    workspaceId: String(qlab.workspaceId || "").trim(),
    autoConnect: Boolean(qlab.autoConnect)
  };

  if (!nextSettings.host) {
    return sendJson(response, { error: "QLab host is required." }, 400);
  }

  await updateSettings(nextSettings);
  await updateServerSettings({
    httpPort: readPositiveNumber(server.httpPort, HTTP_PORT),
    qlabTcpPort: readPositiveNumber(server.qlabTcpPort, QLAB_TCP_PORT),
    adminUser: String(server.adminUser || ADMIN_USER).trim() || ADMIN_USER,
    adminPassword: String(server.adminPassword || previous.server.adminPassword || ADMIN_PASSWORD).trim()
  });

  sendJson(response, {
    ok: true,
    restartRequired: Number(server.httpPort) !== HTTP_PORT ||
      Number(server.qlabTcpPort) !== QLAB_TCP_PORT ||
      String(server.adminUser || "") !== ADMIN_USER ||
      Boolean(server.adminPassword),
    settings: publicSettings(),
    server: publicServerSettings()
  });
}

async function handleDisconnect(response) {
  await disconnectQlab();
  sendJson(response, state);
}

async function handlePresence(request, response) {
  const body = await readBody(request);
  updateViewerPresence(request, body);
  sendJson(response, { ok: true });
}

function readPositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
