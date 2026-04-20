#!/usr/bin/env bash
set -euo pipefail

APP_NAME="qlabconnect"
APP_ROOT="/var/QlabConnect"
APP_DIR="${APP_ROOT}/app"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
ENV_FILE="/etc/qlabconnect.env"
REPO_URL="${REPO_URL:-${1:-}}"
BRANCH="${BRANCH:-main}"
PORT="${PORT:-3030}"
QLAB_TCP_PORT="${QLAB_TCP_PORT:-53000}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-thomas}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root, for example: sudo REPO_URL=https://github.com/USER/REPO.git $0" >&2
  exit 1
fi

if [[ -z "${REPO_URL}" ]]; then
  echo "REPO_URL is required." >&2
  echo "Example:" >&2
  echo "  curl -fsSL https://raw.githubusercontent.com/thomasdye12/Qlab-Screen/main/scripts/install-ubuntu.sh | sudo REPO_URL=https://github.com/thomasdye12/Qlab-Screen.git bash" >&2
  exit 1
fi

echo "Installing QLab Connect from ${REPO_URL} (${BRANCH}) v1"

# apt-get update
apt-get install -y ca-certificates curl git

install_node_if_needed() {
  if command -v node >/dev/null 2>&1; then
    local major
    major="$(node -p 'Number(process.versions.node.split(".")[0])')"
    if [[ "${major}" -ge 18 ]]; then
      return
    fi
  fi

  echo "Installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
}

# install_node_if_needed

mkdir -p "${APP_ROOT}"

if [[ -d "${APP_DIR}/.git" ]]; then
  echo "Updating existing checkout"
  git -C "${APP_DIR}" fetch --all --prune
  git -C "${APP_DIR}" checkout "${BRANCH}"
  git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"
else
  rm -rf "${APP_DIR}"
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi

chown -R root:root "${APP_ROOT}"

echo "Installing production dependencies"
# /root/.nvm/versions/node/v16.20.2/bin/npm --prefix "${APP_DIR}" ci --omit=dev

if [[ ! -f "${APP_DIR}/settings.json" ]]; then
  cat > "${APP_DIR}/settings.json" <<'JSON'
{
  "host": "",
  "passcode": "",
  "workspaceId": "",
  "autoConnect": false
}
JSON
fi

chown root:root "${APP_DIR}/settings.json"
chmod 600 "${APP_DIR}/settings.json"

if [[ ! -f "${ENV_FILE}" ]]; then
  cat > "${ENV_FILE}" <<EOF
PORT=${PORT}
QLAB_TCP_PORT=${QLAB_TCP_PORT}
ADMIN_USER=${ADMIN_USER}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
EOF
  chmod 600 "${ENV_FILE}"
else
  echo "${ENV_FILE} already exists; leaving existing environment in place."
fi

install -m 0644 "${APP_DIR}/deploy/qlabconnect.service" "${SERVICE_FILE}"
systemctl daemon-reload
systemctl enable "${APP_NAME}"
systemctl restart "${APP_NAME}"

echo
echo "QLab Connect installed."
echo "Service: ${APP_NAME}"
echo "App directory: ${APP_DIR}"
echo "Environment: ${ENV_FILE}"
echo "Open: http://$(hostname -I | awk '{print $1}'):${PORT}"
echo
echo "Useful commands:"
echo "  sudo systemctl status ${APP_NAME}"
echo "  sudo journalctl -u ${APP_NAME} -f"
echo "  sudo systemctl restart ${APP_NAME}"
