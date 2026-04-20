import net from "node:net";
import { QLAB_TCP_PORT } from "./config.js";
import { asArray, flattenCues } from "./cues.js";
import { broadcastChanges, broadcastPatch, broadcastSnapshot } from "./events.js";
import { decodeOsc, decodeSlip, encodeOsc, encodeSlip, parseData } from "./osc.js";
import { markCuesIfChanged, setDisconnected, state } from "./state.js";

const pending = new Map();
let pollTimer = null;
let thumpTimer = null;
let qlabSocket = null;
let slipBuffer = Buffer.alloc(0);

export async function connectToQlab({ host, passcode = "", workspaceId = "" }) {
  clearTimers();
  setDisconnected({ host });
  broadcastSnapshot();

  await openQlabConnection(host);
  const workspacesReply = await query(host, "/workspaces", [], 3500);
  const workspaces = asArray(workspacesReply.data);
  const workspace = pickWorkspace(workspaces, workspaceId);

  if (!workspace?.uniqueID) {
    throw new Error("No open QLab workspace was found.");
  }

  const connectReply = await query(
    host,
    `/workspace/${workspace.uniqueID}/connect`,
    passcode ? [passcode] : [],
    6000
  );

  if (!String(connectReply.data).toLowerCase().startsWith("ok")) {
    throw new Error(`QLab rejected the passcode: ${connectReply.data || "unknown response"}.`);
  }

  Object.assign(state, {
    connected: true,
    workspaceId: workspace.uniqueID,
    workspaceName: workspace.displayName || workspace.name || workspace.uniqueID,
    lastError: ""
  });

  await send(host, `/workspace/${state.workspaceId}/updates`, [1]);
  await refreshAll();
  pollTimer = setInterval(refreshAll, 1000);
  thumpTimer = setInterval(() => send(host, `/workspace/${state.workspaceId}/thump`).catch(() => {}), 15000);
}

export async function disconnectQlab() {
  const { host, workspaceId } = state;
  clearTimers();
  if (host && workspaceId) {
    await send(host, `/workspace/${workspaceId}/updates`, [0]).catch(() => {});
    await send(host, `/workspace/${workspaceId}/disconnect`).catch(() => {});
  }
  closeQlabConnection();
  setDisconnected();
  broadcastSnapshot();
}

export async function refreshAll(forceCues = false) {
  if (!state.connected || state.polling) return;
  state.polling = true;
  try {
    const shouldLoadCues = forceCues || state.cues.length === 0;
    const [cueReply, runningReply] = await Promise.all([
      shouldLoadCues ? query(state.host, `/workspace/${state.workspaceId}/cueLists`, [], 5000) : Promise.resolve(null),
      query(state.host, `/workspace/${state.workspaceId}/runningOrPausedCues`, [], 3000)
    ]);

    if (cueReply) {
      markCuesIfChanged(flattenCues(asArray(cueReply.data)), forceCues);
    }

    state.running = flattenCues(asArray(runningReply.data));
    await refreshTiming();
    state.lastError = "";
  } catch (error) {
    state.lastError = error.message;
  } finally {
    state.polling = false;
    broadcastChanges();
  }
}

function refreshTiming() {
  const timing = {};
  const runningIds = state.running.map((cue) => cue.uniqueID).filter(Boolean);

  return Promise.all(runningIds.map(async (id) => {
    const base = `/workspace/${state.workspaceId}/cue_id/${id}`;
    const fields = await Promise.allSettled([
      query(state.host, `${base}/actionElapsed`, [], 1200),
      query(state.host, `${base}/duration`, [], 1200),
      query(state.host, `${base}/isPaused`, [], 1200)
    ]);

    timing[id] = {
      actionElapsed: settledData(fields[0]),
      duration: settledData(fields[1]),
      paused: Boolean(Number(settledData(fields[2]) || 0))
    };
  })).then(() => {
    state.time = timing;
  });
}

function settledData(result) {
  return result.status === "fulfilled" ? result.value.data : null;
}

function clearTimers() {
  clearInterval(pollTimer);
  clearInterval(thumpTimer);
  pollTimer = null;
  thumpTimer = null;
}

function pickWorkspace(workspaces, requestedId) {
  if (requestedId) {
    return workspaces.find((workspace) =>
      workspace.uniqueID === requestedId ||
      workspace.displayName === requestedId ||
      workspace.name === requestedId
    );
  }
  return workspaces[0];
}

function query(host, address, args = [], timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(address);
      reject(new Error(`Timed out waiting for QLab reply to ${address}`));
    }, timeoutMs);

    pending.set(address, { resolve, reject, timeout });
    send(host, address, args).catch((error) => {
      clearTimeout(timeout);
      pending.delete(address);
      reject(error);
    });
  });
}

function send(host, address, args = []) {
  const message = encodeOsc(address, args);
  return new Promise((resolve, reject) => {
    if (!qlabSocket || qlabSocket.destroyed) {
      reject(new Error("QLab TCP connection is not open."));
      return;
    }
    qlabSocket.write(encodeSlip(message), (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function openQlabConnection(host) {
  closeQlabConnection();
  slipBuffer = Buffer.alloc(0);

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port: QLAB_TCP_PORT });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Timed out opening TCP OSC connection to ${host}:${QLAB_TCP_PORT}`));
    }, 3500);

    socket.once("connect", () => {
      clearTimeout(timeout);
      qlabSocket = socket;
      resolve();
    });

    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    socket.on("data", handleTcpData);
    socket.on("close", () => {
      if (qlabSocket === socket) {
        qlabSocket = null;
        rejectPending("QLab TCP connection closed.");
      }
    });
  });
}

function closeQlabConnection() {
  if (qlabSocket && !qlabSocket.destroyed) {
    qlabSocket.end();
    qlabSocket.destroy();
  }
  qlabSocket = null;
  rejectPending("QLab TCP connection closed.");
}

function rejectPending(message) {
  for (const [address, waiter] of pending.entries()) {
    clearTimeout(waiter.timeout);
    waiter.reject(new Error(message));
    pending.delete(address);
  }
}

function handleTcpData(chunk) {
  slipBuffer = Buffer.concat([slipBuffer, chunk]);
  let endIndex;

  while ((endIndex = slipBuffer.indexOf(0xc0)) !== -1) {
    const frame = slipBuffer.subarray(0, endIndex);
    slipBuffer = slipBuffer.subarray(endIndex + 1);
    if (!frame.length) continue;

    let packet;
    try {
      packet = decodeOsc(decodeSlip(frame));
    } catch (error) {
      console.warn("Could not decode OSC packet:", error.message);
      continue;
    }

    state.lastMessageAt = new Date().toISOString();
    const reply = normalizeReply(packet);
    if (!reply) continue;

    const waiter = pending.get(reply.address);
    if (waiter) {
      clearTimeout(waiter.timeout);
      pending.delete(reply.address);
      waiter.resolve(reply);
    }
  }
}

function normalizeReply(packet) {
  if (packet.address?.startsWith("/update/")) {
    const forceCues = !packet.address.includes("/playbackPosition");
    refreshAll(forceCues).catch((error) => {
      state.lastError = error.message;
      broadcastPatch();
    });
    return null;
  }

  if (packet.address === "/reply" && packet.args.length >= 2) {
    const [address, status, data] = packet.args;
    return { address, status, data: parseData(data) };
  }

  if (packet.address.startsWith("/reply/")) {
    const address = packet.address.slice("/reply".length);
    const body = parseData(packet.args[0]);
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return {
        address: body.address || address,
        status: body.status || "ok",
        data: body.data
      };
    }
    return { address, status: "ok", data: body };
  }

  if (pending.has(packet.address)) {
    return { address: packet.address, status: "ok", data: parseData(packet.args[0]) };
  }

  return null;
}
