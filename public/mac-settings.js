const token = new URLSearchParams(window.location.search).get("token") || "";
const form = document.querySelector("#macSettingsForm");
const connectButton = document.querySelector("#connectButton");
const message = document.querySelector("#macSettingsMessage");
const settingsPath = document.querySelector("#settingsPath");

const fields = {
  host: form.elements.host,
  passcode: form.elements.passcode,
  workspaceId: form.elements.workspaceId,
  autoConnect: form.elements.autoConnect,
  httpPort: form.elements.httpPort,
  qlabTcpPort: form.elements.qlabTcpPort,
  adminUser: form.elements.adminUser,
  adminPassword: form.elements.adminPassword
};

loadSettings();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveSettings(false);
});

connectButton.addEventListener("click", async () => {
  await saveSettings(true);
});

async function loadSettings() {
  const data = await fetchJson(`/api/mac/settings?token=${encodeURIComponent(token)}`);
  fields.host.value = data.qlab.host || "";
  fields.workspaceId.value = data.qlab.workspaceId || "";
  fields.autoConnect.checked = Boolean(data.qlab.autoConnect);
  fields.passcode.placeholder = data.qlab.hasPasscode ? "Saved passcode is set" : "QLab passcode";
  fields.httpPort.value = data.server.httpPort || data.active.httpPort;
  fields.qlabTcpPort.value = data.server.qlabTcpPort || data.active.qlabTcpPort;
  fields.adminUser.value = data.server.adminUser || data.active.adminUser;
  fields.adminPassword.placeholder = data.server.hasAdminPassword ? "Saved password is set" : "Admin password";
  settingsPath.textContent = data.active.settingsPath;
}

async function saveSettings(connectAfterSave) {
  setBusy(true);
  message.textContent = "";

  try {
    const passcode = fields.passcode.value;
    const payload = {
      qlab: {
        host: fields.host.value,
        passcode,
        workspaceId: fields.workspaceId.value,
        autoConnect: fields.autoConnect.checked || connectAfterSave
      },
      server: {
        httpPort: fields.httpPort.value,
        qlabTcpPort: fields.qlabTcpPort.value,
        adminUser: fields.adminUser.value,
        adminPassword: fields.adminPassword.value
      }
    };

    const data = await fetchJson(`/api/mac/settings?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Mac-Owner-Token": token
      },
      body: JSON.stringify(payload)
    });

    fields.passcode.value = "";
    fields.adminPassword.value = "";
    fields.passcode.placeholder = data.settings.hasPasscode ? "Saved passcode is set" : "QLab passcode";
    fields.adminPassword.placeholder = data.server.hasAdminPassword ? "Saved password is set" : "Admin password";
    message.textContent = data.restartRequired ? "Saved. Restart the Mac app to apply server changes." : "Saved.";

    if (connectAfterSave) {
      await fetchJson("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: fields.host.value,
          passcode,
          workspaceId: fields.workspaceId.value
        })
      });
      message.textContent = "Saved and connected.";
    }
  } catch (error) {
    message.textContent = error.message;
  } finally {
    setBusy(false);
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function setBusy(isBusy) {
  for (const element of form.elements) element.disabled = isBusy;
  connectButton.disabled = isBusy;
}
