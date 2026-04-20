const form = document.querySelector("#adminForm");
const connectSavedButton = document.querySelector("#connectSavedButton");
const message = document.querySelector("#adminMessage");

const hostInput = form.elements.host;
const passcodeInput = form.elements.passcode;
const workspaceInput = form.elements.workspaceId;
const autoConnectInput = form.elements.autoConnect;

loadSettings();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveSettings(false);
});

connectSavedButton.addEventListener("click", async () => {
  await saveSettings(true);
});

async function loadSettings() {
  const response = await fetch("/api/saved-settings");
  const settings = await response.json();
  hostInput.value = settings.host || "";
  workspaceInput.value = settings.workspaceId || "";
  autoConnectInput.checked = Boolean(settings.autoConnect);
  passcodeInput.placeholder = settings.hasPasscode ? "Saved passcode is set" : "QLab passcode";
}

async function saveSettings(connectAfterSave) {
  const payload = Object.fromEntries(new FormData(form));
  payload.autoConnect = autoConnectInput.checked || connectAfterSave;

  setBusy(true);
  message.textContent = "";

  try {
    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not save settings.");

    passcodeInput.value = "";
    passcodeInput.placeholder = data.settings.hasPasscode ? "Saved passcode is set" : "QLab passcode";
    message.textContent = data.state?.connected ? "Saved and connected." : "Saved.";
  } catch (error) {
    message.textContent = error.message;
  } finally {
    setBusy(false);
  }
}

function setBusy(isBusy) {
  for (const element of form.elements) element.disabled = isBusy;
  connectSavedButton.disabled = isBusy;
}
