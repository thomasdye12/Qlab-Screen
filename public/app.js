const statusText = document.querySelector("#statusText");
const workspaceHero = document.querySelector("#workspaceHero");
const workspaceText = document.querySelector("#workspaceText");
const runningCount = document.querySelector("#runningCount");
const lastUpdate = document.querySelector("#lastUpdate");
const cueCount = document.querySelector("#cueCount");
const cueList = document.querySelector("#cueList");
const runningList = document.querySelector("#runningList");

let currentState = null;
let serverOnline = false;
let eventsOnline = false;
let lastScrollTarget = "";
let userScrolledAt = 0;
let autoScrolling = false;

const events = new EventSource("/events");

events.onopen = () => {
  eventsOnline = true;
  serverOnline = true;
  render(currentState);
};

events.addEventListener("snapshot", (event) => {
  eventsOnline = true;
  serverOnline = true;
  render(JSON.parse(event.data));
});

events.addEventListener("patch", (event) => {
  eventsOnline = true;
  serverOnline = true;
  render(mergeStatePatch(currentState, JSON.parse(event.data)));
});

events.addEventListener("heartbeat", (event) => {
  eventsOnline = true;
  serverOnline = true;
  render(mergeStatePatch(currentState, JSON.parse(event.data)));
});

events.onerror = () => {
  eventsOnline = false;
  render(currentState);
};

pollState();
setInterval(pollState, 3000);

cueList.addEventListener("scroll", () => {
  if (autoScrolling) return;
  userScrolledAt = Date.now();
}, { passive: true });

function render(state) {
  currentState = state || {};
  const runningIds = new Set((currentState.running || []).map((cue) => cue.uniqueID));
  document.body.classList.toggle("server-offline", !serverOnline);
  document.body.classList.toggle("events-offline", serverOnline && !eventsOnline);
  document.body.classList.toggle("qlab-connected", Boolean(serverOnline && currentState.connected && !currentState.lastError));
  document.body.classList.toggle("qlab-error", Boolean(serverOnline && currentState.lastError));

  if (!serverOnline) {
    statusText.textContent = "Server disconnected";
  } else if (!eventsOnline) {
    statusText.textContent = "Reconnecting live view";
  } else {
    statusText.textContent = currentState.connected ? "Connected" : "Disconnected";
    if (currentState.lastError) statusText.textContent = currentState.lastError;
  }
  workspaceHero.textContent = currentState.workspaceName || "Waiting for workspace";
  workspaceText.textContent = getCurrentGroup(currentState) || "-";
  runningCount.textContent = String((currentState.running || []).length);
  lastUpdate.textContent = currentState.lastMessageAt ? new Date(currentState.lastMessageAt).toLocaleTimeString() : "-";

  cueCount.textContent = `${(currentState.cues || []).length} cues`;
  cueList.classList.toggle("empty", !currentState.cues?.length);
  cueList.innerHTML = currentState.cues?.length
    ? currentState.cues.map((cue) => renderCue(cue, runningIds.has(cue.uniqueID))).join("")
    : "No cues loaded.";

  runningList.classList.toggle("empty", !currentState.running?.length);
  runningList.innerHTML = currentState.running?.length
    ? currentState.running.map(renderRunningCue).join("")
    : "Nothing running.";

  requestAnimationFrame(() => scrollToActiveCue(currentState));
}

async function pollState() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error("State request failed.");
    serverOnline = true;
    render(mergeStatePatch(currentState, await response.json()));
  } catch {
    serverOnline = false;
    eventsOnline = false;
    render(currentState);
  }
}

function mergeStatePatch(previousState, patch) {
  return {
    ...(previousState || {}),
    ...patch,
    cues: patch.cues || previousState?.cues || []
  };
}

function renderCue(cue, isRunning) {
  const isDisabled = Number(cue.armed) === 0;
  return `
    <article class="cue-row ${isRunning ? "running" : ""} ${isDisabled ? "disabled" : ""}" data-cue-id="${escapeHtml(cue.uniqueID)}" data-parent-id="${escapeHtml(cue.parentId || "")}" style="--depth:${Number(cue.depth || 0)}">
      <div class="cue-number">${escapeHtml(cue.number || "-")}</div>
      <div class="cue-name cue-indent">${escapeHtml(cue.name || "Untitled cue")}</div>
      <div class="type">${escapeHtml(cue.type || "cue")}</div>
      <div class="badges">
        ${cue.flagged ? '<span class="badge warn">F</span>' : ""}
        ${isDisabled ? '<span class="badge danger">D</span>' : ""}
        ${isRunning ? '<span class="badge">RUN</span>' : ""}
      </div>
    </article>
  `;
}

function scrollToActiveCue(state) {
  if (!state?.cues?.length || !state.running?.length) return;
  if (Date.now() - userScrolledAt < 5000) return;

  const cueMap = new Map(state.cues.map((cue) => [cue.uniqueID, cue]));
  const primary = pickPrimaryCue(state.running, cueMap);
  const targetCue = cueMap.get(primary?.uniqueID) || findParentInList(primary, cueMap);
  if (!targetCue?.uniqueID || targetCue.uniqueID === lastScrollTarget) return;

  const row = cueList.querySelector(`[data-cue-id="${CSS.escape(targetCue.uniqueID)}"]`);
  if (!row) return;

  lastScrollTarget = targetCue.uniqueID;
  autoScrolling = true;
  row.scrollIntoView({ block: "center", behavior: "smooth" });
  setTimeout(() => {
    autoScrolling = false;
  }, 900);
}

function pickPrimaryCue(running, cueMap) {
  const withFullCue = running.map((cue) => cueMap.get(cue.uniqueID) || cue);
  return withFullCue.find((cue) => cue.type !== "Group" && cue.type !== "Cue List") || withFullCue[0] || null;
}

function findParentInList(cue, cueMap) {
  let current = cue;
  while (current?.parentId) {
    const parent = cueMap.get(current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current;
}

function getCurrentGroup(state) {
  const cueMap = new Map((state.cues || []).map((cue) => [cue.uniqueID, cue]));
  const primary = pickPrimaryCue(state.running || [], cueMap);
  if (!primary) return "";

  const fullCue = cueMap.get(primary.uniqueID) || primary;
  if (fullCue.groupName) return fullCue.groupName;

  let current = fullCue;
  while (current?.parentId) {
    const parent = cueMap.get(current.parentId);
    if (!parent) break;
    if (parent.name || parent.number) return parent.name || parent.number;
    current = parent;
  }

  return fullCue.listName || "";
}

function renderRunningCue(cue) {
  const timing = currentState.time?.[cue.uniqueID] || {};
  const elapsed = Number(timing.actionElapsed || 0);
  const duration = Number(timing.duration || 0);
  const progress = duration > 0 ? Math.min(100, Math.max(0, (elapsed / duration) * 100)) : 0;
  const remaining = duration > 0 ? Math.max(0, duration - elapsed) : null;

  return `
    <article class="run-card">
      <div class="run-top">
        <strong class="cue-number">${escapeHtml(cue.number || "-")}</strong>
        <strong class="run-title">${escapeHtml(cue.name || "Untitled cue")}</strong>
        <span class="timer">${formatTime(elapsed)}</span>
      </div>
      <div class="progress" aria-hidden="true"><span style="--progress:${progress}%"></span></div>
      <div class="meta">
        ${duration > 0 ? `${formatTime(remaining)} remaining of ${formatTime(duration)}` : "Duration unavailable"}
        ${timing.paused ? " / paused" : ""}
      </div>
    </article>
  `;
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
