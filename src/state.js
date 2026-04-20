export const state = {
  connected: false,
  host: "",
  workspaceId: "",
  workspaceName: "",
  lastError: "",
  lastMessageAt: null,
  cues: [],
  running: [],
  time: {},
  polling: false
};

let cuesVersion = 0;
let cuesSignature = "";
let runningSignature = "";
let timeSignature = "";
let metaSignature = "";
let cuesDirty = false;

export function setDisconnected(next = {}) {
  Object.assign(state, {
    connected: false,
    host: next.host ?? state.host,
    workspaceId: "",
    workspaceName: "",
    lastError: next.lastError || "",
    cues: [],
    running: [],
    time: {}
  });
  cuesVersion += 1;
  cuesDirty = true;
}

export function markCuesIfChanged(nextCues, force = false) {
  const nextSignature = JSON.stringify(nextCues);
  if (force || nextSignature !== cuesSignature) {
    state.cues = nextCues;
    cuesSignature = nextSignature;
    cuesVersion += 1;
    cuesDirty = true;
  }
}

export function publicStateSnapshot() {
  return {
    ...publicStatePatch(),
    cues: state.cues
  };
}

export function publicStatePatch() {
  return {
    ...publicStateMeta(),
    running: state.running,
    time: state.time,
    cuesVersion
  };
}

export function publicStateMeta() {
  return {
    connected: state.connected,
    host: state.host,
    workspaceId: state.workspaceId,
    workspaceName: state.workspaceName,
    lastError: state.lastError,
    lastMessageAt: state.lastMessageAt,
    polling: state.polling
  };
}

export function syncSignatures() {
  cuesSignature = JSON.stringify(state.cues);
  runningSignature = JSON.stringify(state.running);
  timeSignature = JSON.stringify(state.time);
  metaSignature = JSON.stringify(publicStateMeta());
}

export function clearCuesDirty() {
  cuesDirty = false;
}

export function consumeChangeType() {
  const nextRunningSignature = JSON.stringify(state.running);
  const nextTimeSignature = JSON.stringify(state.time);
  const nextMetaSignature = JSON.stringify(publicStateMeta());
  const changed = cuesDirty ||
    nextRunningSignature !== runningSignature ||
    nextTimeSignature !== timeSignature ||
    nextMetaSignature !== metaSignature;

  if (!changed) return null;

  if (cuesDirty) {
    cuesDirty = false;
    syncSignatures();
    return "snapshot";
  }

  runningSignature = nextRunningSignature;
  timeSignature = nextTimeSignature;
  metaSignature = nextMetaSignature;
  return "patch";
}
