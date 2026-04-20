const tvConnection = document.querySelector("#tvConnection");
const tvWorkspace = document.querySelector("#tvWorkspace");
const tvClock = document.querySelector("#tvClock");
const tvGroup = document.querySelector("#tvGroup");
const tvCueNumber = document.querySelector("#tvCueNumber");
const tvCueName = document.querySelector("#tvCueName");
const tvProgress = document.querySelector("#tvProgress");
const tvElapsed = document.querySelector("#tvElapsed");
const tvRemaining = document.querySelector("#tvRemaining");
const tvRunningList = document.querySelector("#tvRunningList");

let currentState = {};
let serverOnline = false;
let eventsOnline = false;

updateClock();
setInterval(() => {
  updateClock();
}, 1000);

const events = new EventSource("/events");

events.onopen = () => {
  eventsOnline = true;
  serverOnline = true;
  render();
};

events.addEventListener("snapshot", (event) => {
  eventsOnline = true;
  serverOnline = true;
  currentState = JSON.parse(event.data);
  render();
});

events.addEventListener("patch", (event) => {
  eventsOnline = true;
  serverOnline = true;
  currentState = mergeStatePatch(currentState, JSON.parse(event.data));
  render();
});

events.addEventListener("heartbeat", (event) => {
  eventsOnline = true;
  serverOnline = true;
  currentState = mergeStatePatch(currentState, JSON.parse(event.data));
  render();
});

events.onerror = () => {
  eventsOnline = false;
  render();
};

pollState();
setInterval(pollState, 3000);

function render() {
  document.body.classList.toggle("server-offline", !serverOnline);
  document.body.classList.toggle("events-offline", serverOnline && !eventsOnline);
  document.body.classList.toggle("qlab-connected", Boolean(serverOnline && currentState.connected && !currentState.lastError));
  document.body.classList.toggle("qlab-error", Boolean(serverOnline && currentState.lastError));

  const running = currentState.running || [];
  const cueMap = new Map((currentState.cues || []).map((cue) => [cue.uniqueID, cue]));
  const primary = pickPrimaryCue(running, cueMap);
  const fullCue = cueMap.get(primary?.uniqueID) || primary;
  const group = findGroupName(fullCue, cueMap);
  const timing = currentState.time?.[primary?.uniqueID] || {};
  const elapsed = Number(timing.actionElapsed || 0);
  const duration = Number(timing.duration || 0);
  const remaining = duration > 0 ? Math.max(0, duration - elapsed) : null;
  const progress = duration > 0 ? Math.min(100, Math.max(0, (elapsed / duration) * 100)) : 0;

  if (!serverOnline) {
    tvConnection.textContent = "Server disconnected";
  } else if (!eventsOnline) {
    tvConnection.textContent = "Reconnecting live view";
  } else {
    tvConnection.textContent = currentState.connected ? "Connected" : currentState.lastError || "Disconnected";
  }
  tvWorkspace.textContent = currentState.workspaceName || currentState.workspaceId || "-";
  tvGroup.textContent = group || (running.length ? "Ungrouped cue" : "Waiting for QLab");
  tvCueNumber.textContent = primary?.number || "-";
  tvCueName.textContent = primary?.name || "No cue running";
  tvProgress.style.width = `${progress}%`;
  tvElapsed.textContent = `${formatTime(elapsed)} elapsed`;
  tvRemaining.textContent = remaining == null ? "duration unavailable" : `${formatTime(remaining)} remaining`;

  tvRunningList.innerHTML = running.length
    ? running.map((cue) => `<div>${escapeHtml(cue.number || "-")} ${escapeHtml(cue.name || "Untitled cue")}</div>`).join("")
    : "Nothing running.";
}

async function pollState() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error("State request failed.");
    serverOnline = true;
    currentState = mergeStatePatch(currentState, await response.json());
    render();
  } catch {
    serverOnline = false;
    eventsOnline = false;
    render();
  }
}

function mergeStatePatch(previousState, patch) {
  return {
    ...(previousState || {}),
    ...patch,
    cues: patch.cues || previousState?.cues || []
  };
}

function pickPrimaryCue(running, cueMap) {
  const withFullCue = running.map((cue) => cueMap.get(cue.uniqueID) || cue);
  return withFullCue.find((cue) => cue.type !== "Group" && cue.type !== "Cue List") || withFullCue[0] || null;
}

function findGroupName(cue, cueMap) {
  if (!cue) return "";
  if (cue.groupName) return cue.groupName;

  let current = cue;
  while (current?.parentId) {
    const parent = cueMap.get(current.parentId);
    if (!parent) break;
    if (parent.name || parent.number) return parent.name || parent.number;
    current = parent;
  }

  return cue.listName || "";
}

function formatTime(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return "--:--.-";
  const value = Math.max(0, Number(seconds));
  const minutes = Math.floor(value / 60);
  const secs = Math.floor(value % 60);
  const tenths = Math.floor((value % 1) * 10);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function updateClock() {
  tvClock.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
