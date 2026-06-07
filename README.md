# QLab Connect

QLab Connect is a read-only Node.js web monitor for a remote QLab workspace. It is designed for show relay screens, backstage displays, and TV dashboards where people need to see what QLab is doing without having any ability to control the show.

The app connects to QLab over TCP OSC, reads cue information, watches what is running, and serves browser views for operators and displays.

## Features

- Read-only QLab connection using OSC over TCP.
- Admin-protected saved connection settings.
- Main monitor view showing:

   - workspace name as the main heading
   - cue order
   - running cues
   - elapsed/remaining time where QLab exposes it
   - current cue group
   - automatic scrolling to the active cue
   - mobile at-a-glance layout
   - QLab-inspired cue styling with larger group rows and cue color swatches
   - blank memo cues left blank instead of being labeled as untitled

- TV dashboard view for full-screen display.
- Live viewers page showing who is connected to the monitor and dashboard.
- Lightweight browser updates:

   - full cue list is sent only on initial load or cue-list changes
   - routine updates send small status/running/timing patches

- Browser-to-server disconnect detection.
- Fullscreen and keep-awake controls for supported browsers.
- iPhone/iPad fallback flow using Add to Home Screen and Focus Mode.
- Proxy-aware viewer tracking using forwarded client IP headers.
- No QLab playback, edit, stop, start, or control commands.

## Screens

- Main monitor: `http://localhost:3030/`
- Admin settings: `http://localhost:3030/admin.html`
- TV dashboard: `http://localhost:3030/dashboard.html`
- Live viewers: `http://localhost:3030/viewers.html`

Admin uses HTTP Basic Auth.

Default login:

```text
username: admin
password: thomas
```

Change these with environment variables before running in production.

## What The Views Show

### Main monitor

The main monitor is the operator-friendly page. It focuses on:

- current workspace name
- current cue group
- running cues with live timing
- full cue order
- auto-scroll to the currently active cue

On smaller screens it switches to a compact mobile layout so the running cue and cue list stay visible without the title area taking over the page.

### TV dashboard

The TV dashboard is a simplified full-screen view for relay screens and confidence displays. It emphasizes:

- current cue group
- current active cue
- progress/timing
- running cue summary

### Live viewers

The live viewers page is admin-protected and shows who is currently connected to the monitor or dashboard, including:

- page type
- IP address
- forwarded IP header information when behind a reverse proxy
- whether the page is currently visible or in the background
- connected time
- last-seen time
- user agent

## QLab Requirements

In QLab:

1. Enable OSC.
2. Create an OSC passcode with **view** access.
3. Control access is not required.
4. Make sure the machine running QLab Connect can reach the QLab Mac on TCP port `53000`.

QLab Connect uses TCP OSC because large cue-list replies can exceed UDP packet limits.

## Local Development

Install dependencies:

```bash
npm install
```

Run:

```bash
npm start
```

Optional development mode:

```bash
npm run dev
```

Then open:

```text
http://localhost:3030
```

## Configuration

Environment variables:

```bash
PORT=3030
QLAB_TCP_PORT=53000
ADMIN_USER=admin
ADMIN_PASSWORD=thomas
```

Saved QLab connection details are stored in `settings.json` at the project root. This file can contain a QLab host/passcode, so it is intentionally ignored by Git.

Example `settings.json`:

```json
{
  "host": "10.0.4.189",
  "passcode": "1235",
  "workspaceId": "",
  "autoConnect": true
}
```

You normally do not need to edit this file directly. Use the admin page instead.

## Reverse Proxy Notes

QLab Connect can sit behind a reverse proxy. For live viewer tracking, the app prefers these headers in order:

1. `X-Forwarded-For`
2. `X-Real-IP`
3. the direct socket address

If you want the viewers page to show real remote client IPs, make sure your proxy forwards `X-Forwarded-For` or `X-Real-IP`.

## Browser Notes

- Fullscreen works in browsers that support the Fullscreen API.
- Keep Awake uses the Screen Wake Lock API where supported.
- iPhone/iPad Safari does not support normal webpage fullscreen. The best experience there is:

  1. open the page in Safari
  2. use **Add to Home Screen**
  3. launch it from the Home Screen
  4. use **Focus Mode**

- The app tries to keep the device awake after user interaction where the browser allows it, but iOS still applies platform limits.

## Project Structure

```text
server.js                 App entry point
src/config.js             Paths, ports, environment config
src/http-server.js        HTTP routes and API handlers
src/http-utils.js         JSON responses, request body parsing, static files
src/auth.js               HTTP Basic Auth for admin routes
src/settings.js           Load/save public and private settings
src/state.js              Shared app state and lightweight patch tracking
src/events.js             Server-Sent Events snapshots, patches, heartbeat
src/qlab.js               QLab TCP OSC connection, polling, timing
src/osc.js                OSC and SLIP encode/decode helpers
src/cues.js               Cue flattening helpers
src/viewers.js            Live viewer tracking and presence state
public/                   Browser UI
deploy/qlabconnect.service systemd unit
scripts/install-ubuntu.sh Ubuntu installer
```

## Ubuntu Service Install

The installer creates:

- application directory: `/var/QlabConnect/app`
- environment file: `/etc/qlabconnect.env`
- systemd service: `qlabconnect.service`

It installs Node.js if needed, clones your GitHub repository, installs production dependencies, creates a starter `settings.json`, enables the service, and starts it on boot. The installer and systemd service run as `root`.

### Run From GitHub

After this repo is on GitHub, replace the URLs below with your own repository details.

```bash
curl -fsSL https://raw.githubusercontent.com/thomasdye12/Qlab-Screen/main/scripts/install-ubuntu.sh \
  | sudo REPO_URL=https://github.com/thomasdye12/Qlab-Screen.git bash
```

## Service Commands

Check status:

```bash
sudo systemctl status qlabconnect
```

View logs:

```bash
sudo journalctl -u qlabconnect -f
```

Restart:

```bash
sudo systemctl restart qlabconnect
```

Stop:

```bash
sudo systemctl stop qlabconnect
```

Edit environment variables:

```bash
sudo nano /etc/qlabconnect.env
sudo systemctl restart qlabconnect
```

## Updating On Ubuntu

Re-run the installer with the same `REPO_URL`, or update manually:

```bash
cd /var/QlabConnect/app
sudo git pull
sudo npm ci --omit=dev
sudo systemctl restart qlabconnect
```

If you only changed frontend files in `public/`, a restart is usually not required. After `git pull`, the new static files will be served on the next page load. Restart the service when backend files such as `server.js`, `src/*.js`, `package.json`, or environment settings change.

## Security Notes

- This app is intended for trusted production/show networks.
- Admin settings are protected with HTTP Basic Auth.
- The live viewers page is also protected with HTTP Basic Auth.
- Use a strong `ADMIN_PASSWORD` in `/etc/qlabconnect.env`.
- Use a QLab passcode with view-only access.
- Do not expose this service directly to the public internet.

## License
