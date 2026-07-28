```bash
#!/usr/bin/env bash

set -Eeuo pipefail

APP_NAME="forge-builder"
APP_DIR="/home/Forge/builder"
REPOS_DIR="/home/Forge/repos"
BUILDS_DIR="/home/Forge/builds"
VENV_DIR="${APP_DIR}/venv"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
SERVICE_USER="forge-builder"
SERVICE_GROUP="forge-builder"
HOST="127.0.0.1"
PORT="8000"

log() {
    echo
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

fail() {
    echo
    echo "ERROR: $1" >&2
    exit 1
}

if [[ "${EUID}" -ne 0 ]]; then
    fail "Run this script as root: sudo ./setup.sh"
fi

log "Checking application files"

[[ -f "${APP_DIR}/main.py" ]] || fail "main.py not found in ${APP_DIR}"
[[ -f "${APP_DIR}/build.py" ]] || fail "build.py not found in ${APP_DIR}"
[[ -f "${APP_DIR}/requirements.txt" ]] || fail "requirements.txt not found in ${APP_DIR}"

log "Installing required system packages"

apt-get update

DEBIAN_FRONTEND=noninteractive apt-get install -y \
    python3 \
    python3-venv \
    python3-pip \
    docker.io \
    zip \
    unzip \
    ca-certificates

log "Starting and enabling Docker"

systemctl enable --now docker

log "Creating Forge directories"

mkdir -p "${APP_DIR}"
mkdir -p "${REPOS_DIR}"
mkdir -p "${BUILDS_DIR}"

log "Creating service user"

if ! id "${SERVICE_USER}" >/dev/null 2>&1; then
    useradd \
        --system \
        --create-home \
        --home-dir "/home/${SERVICE_USER}" \
        --shell /usr/sbin/nologin \
        "${SERVICE_USER}"
fi

log "Adding service user to Docker group"

usermod -aG docker "${SERVICE_USER}"

log "Setting directory permissions"

chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${APP_DIR}"
chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${REPOS_DIR}"
chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${BUILDS_DIR}"

chmod 750 "${APP_DIR}"
chmod 750 "${REPOS_DIR}"
chmod 750 "${BUILDS_DIR}"

log "Creating Python virtual environment"

if [[ ! -d "${VENV_DIR}" ]]; then
    sudo -u "${SERVICE_USER}" python3 -m venv "${VENV_DIR}"
fi

log "Installing Python dependencies"

sudo -u "${SERVICE_USER}" "${VENV_DIR}/bin/python" -m pip install \
    --upgrade pip setuptools wheel

sudo -u "${SERVICE_USER}" "${VENV_DIR}/bin/pip" install \
    --no-cache-dir \
    -r "${APP_DIR}/requirements.txt"

log "Creating systemd service"

cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=Forge Docker Builder API
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
SupplementaryGroups=docker

WorkingDirectory=${APP_DIR}

ExecStart=${VENV_DIR}/bin/uvicorn main:app --host ${HOST} --port ${PORT}

Restart=always
RestartSec=5
TimeoutStopSec=30

Environment=PYTHONUNBUFFERED=1
Environment=PYTHONDONTWRITEBYTECODE=1

NoNewPrivileges=false

[Install]
WantedBy=multi-user.target
EOF

chmod 644 "${SERVICE_FILE}"

log "Making management scripts executable"

chmod +x "${APP_DIR}/setup.sh" 2>/dev/null || true
chmod +x "${APP_DIR}/start.sh" 2>/dev/null || true
chmod +x "${APP_DIR}/stop.sh" 2>/dev/null || true

log "Reloading systemd"

systemctl daemon-reload
systemctl enable "${APP_NAME}.service"

log "Starting Forge Builder API"

systemctl restart "${APP_NAME}.service"

sleep 3

if systemctl is-active --quiet "${APP_NAME}.service"; then
    log "Forge Builder API installed successfully"

    echo
    echo "Service: ${APP_NAME}.service"
    echo "API URL: http://${HOST}:${PORT}"
    echo "Health:  http://${HOST}:${PORT}/health"
    echo "Docs:    http://${HOST}:${PORT}/docs"
    echo
    echo "Check status:"
    echo "  sudo systemctl status ${APP_NAME}"
    echo
    echo "View logs:"
    echo "  sudo journalctl -u ${APP_NAME} -f"
else
    echo
    systemctl status "${APP_NAME}.service" --no-pager || true
    echo
    journalctl -u "${APP_NAME}.service" -n 50 --no-pager || true

    fail "Forge Builder API failed to start"
fi
```
