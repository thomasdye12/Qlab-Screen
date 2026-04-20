import { readFile, writeFile } from "node:fs/promises";
import { SETTINGS_PATH } from "./config.js";

let settings = await loadSettings();

export function getSettings() {
  return settings;
}

export async function updateSettings(nextSettings) {
  settings = nextSettings;
  await writeFile(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return settings;
}

export function publicSettings() {
  return {
    host: settings.host,
    workspaceId: settings.workspaceId,
    autoConnect: settings.autoConnect,
    hasPasscode: Boolean(settings.passcode)
  };
}

async function loadSettings() {
  try {
    const content = await readFile(SETTINGS_PATH, "utf8");
    const saved = JSON.parse(content);
    return normalizeSettings(saved);
  } catch {
    return normalizeSettings({});
  }
}

function normalizeSettings(saved) {
  return {
    host: String(saved.host || ""),
    passcode: String(saved.passcode || ""),
    workspaceId: String(saved.workspaceId || ""),
    autoConnect: Boolean(saved.autoConnect)
  };
}
