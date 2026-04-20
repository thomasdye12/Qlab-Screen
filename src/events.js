import {
  clearCuesDirty,
  consumeChangeType,
  publicStatePatch,
  publicStateSnapshot,
  syncSignatures
} from "./state.js";

const clients = new Set();

export function handleEvents(response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  response.write(formatEvent("snapshot", publicStateSnapshot()));
  clients.add(response);
  response.on("close", () => clients.delete(response));
}

export function broadcastSnapshot() {
  syncSignatures();
  clearCuesDirty();
  broadcastEvent("snapshot", publicStateSnapshot());
}

export function broadcastPatch() {
  syncSignatures();
  broadcastEvent("patch", publicStatePatch());
}

export function broadcastChanges() {
  const changeType = consumeChangeType();
  if (changeType === "snapshot") broadcastEvent("snapshot", publicStateSnapshot());
  if (changeType === "patch") broadcastEvent("patch", publicStatePatch());
}

export function broadcastHeartbeat() {
  broadcastEvent("heartbeat", publicStatePatch());
}

function broadcastEvent(type, payload) {
  const data = formatEvent(type, payload);
  for (const client of clients) client.write(data);
}

function formatEvent(type, payload) {
  return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
}
