import http from "node:http";
import { hasAdminAuth, isAdminPath, requestAdminAuth } from "./auth.js";
import { broadcastHeartbeat, handleEvents } from "./events.js";
import { sendJson, readBody, serveStatic } from "./http-utils.js";
import { connectToQlab, disconnectQlab } from "./qlab.js";
import { getSettings, publicSettings, updateSettings } from "./settings.js";
import { publicStatePatch, state } from "./state.js";

export function createHttpServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);

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

      if (url.pathname === "/api/state") {
        return sendJson(response, state);
      }

      if (url.pathname === "/api/status") {
        return sendJson(response, publicStatePatch());
      }

      if (url.pathname === "/events") {
        return handleEvents(response);
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

async function handleDisconnect(response) {
  await disconnectQlab();
  sendJson(response, state);
}
