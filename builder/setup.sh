#!/usr/bin/env bash

set -Eeuo pipefail

# ============================================================
# Forge Builder API - Safe Setup Script
# ============================================================
#
# This script:
# - Does not reinstall Docker
# - Does not overwrite an existing systemd service
# - Does not recreate existing directories
# - Does not recreate an existing Python virtual environment
# - Installs only missing Ubuntu packages
# - Starts the service only when it is newly created
#
# Run:
#   sudo ./setup.sh
#
# ============================================================

APP_NAME="forge-builder"
SERVICE_NAME="${APP_NAME}.service"

APP_DIR="/home/Forge/builder"
REPOS_DIR="/home/Forge/repos"
BUILDS_DIR="/home/Forge/builds"

VENV_DIR="${APP_DIR}/venv"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}"

SERVICE_USER="forge-builder"
SERVICE_GROUP="forge-builder"

HOST="127.0.0.1"
PORT="8010"

SERVICE_WAS_CREATED=false


# ============================================================
# Logging
# ============================================================

log() {
    echo
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

warning() {
    echo
    echo "WARNING: $*" >&2
}

fail() {
    echo
    echo "ERROR: $*" >&2
    exit 1
}

error_handler() {
    local exit_code=$?
    local line_number=$1

    echo
    echo "Setup failed on line ${line_number} with exit code ${exit_code}." >&2
    exit "${exit_code}"
}

trap 'error_handler $LINENO' ERR


# ============================================================
# Root check
# ============================================================

if [[ "${EUID}" -ne 0 ]]; then
    fail "Run this script as root: sudo ./setup.sh"
fi


# ============================================================
# Check application directory
# ============================================================

log "Checking application directory"

if [[ ! -d "${APP_DIR}" ]]; then
    fail "Application directory does not exist: ${APP_DIR}"
fi

required_files=(
    "main.py"
    "build.py"
    "requirements.txt"
)

for required_file in "${required_files[@]}"; do
    if [[ ! -f "${APP_DIR}/${required_file}" ]]; then
        fail "Required file is missing: ${APP_DIR}/${required_file}"
    fi
done

log "Application files are available"


# ============================================================
# Create missing folders only
# ============================================================

create_directory_if_missing() {
    local directory_path="$1"

    if [[ -d "${directory_path}" ]]; then
        log "Directory already exists. Leaving unchanged: ${directory_path}"
        return
    fi

    log "Creating missing directory: ${directory_path}"

    mkdir -p "${directory_path}"

    # Ownership is applied only to newly created directories.
    chown "${SERVICE_USER}:${SERVICE_GROUP}" "${directory_path}"
    chmod 750 "${directory_path}"
}


# ============================================================
# Install missing Ubuntu packages only
# ============================================================

required_packages=(
    "python3"
    "python3-venv"
    "python3-pip"
    "zip"
    "unzip"
    "ca-certificates"
)

missing_packages=()

log "Checking required Ubuntu packages"

for package_name in "${required_packages[@]}"; do
    if dpkg-query -W -f='${Status}' "${package_name}" 2>/dev/null \
        | grep -q "install ok installed"; then

        echo "Already installed: ${package_name}"
    else
        echo "Missing package: ${package_name}"
        missing_packages+=("${package_name}")
    fi
done

if [[ ${#missing_packages[@]} -gt 0 ]]; then
    log "Installing missing Ubuntu packages"

    apt-get update

    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        "${missing_packages[@]}"
else
    log "All required Ubuntu packages are already installed"
fi


# ============================================================
# Check Docker without reinstalling it
# ============================================================

log "Checking Docker installation"

if ! command -v docker >/dev/null 2>&1; then
    fail "Docker is not installed. Install Docker Engine before running this setup."
fi

echo "Docker CLI: $(docker --version)"

if ! systemctl list-unit-files docker.service >/dev/null 2>&1; then
    fail "Docker systemd service was not found"
fi

if systemctl is-active --quiet docker.service; then
    log "Docker service is already running"
else
    warning "Docker is installed but the service is not running"
    log "Starting Docker service"

    systemctl start docker.service
fi

if ! systemctl is-enabled --quiet docker.service 2>/dev/null; then
    warning "Docker service is not enabled at boot"
    log "Enabling Docker service"

    systemctl enable docker.service
else
    log "Docker service is already enabled"
fi

if ! docker info >/dev/null 2>&1; then
    fail "Docker daemon is not available"
fi


# ============================================================
# Create service user only when missing
# ============================================================

log "Checking service user"

if id "${SERVICE_USER}" >/dev/null 2>&1; then
    log "Service user already exists. Leaving unchanged: ${SERVICE_USER}"
else
    log "Creating service user: ${SERVICE_USER}"

    useradd \
        --system \
        --create-home \
        --home-dir "/home/${SERVICE_USER}" \
        --shell /usr/sbin/nologin \
        "${SERVICE_USER}"
fi


# ============================================================
# Add user to Docker group only when needed
# ============================================================

if ! getent group docker >/dev/null 2>&1; then
    fail "Docker group does not exist"
fi

if id -nG "${SERVICE_USER}" | tr ' ' '\n' | grep -qx "docker"; then
    log "Service user is already a member of the Docker group"
else
    log "Adding ${SERVICE_USER} to the Docker group"

    usermod -aG docker "${SERVICE_USER}"
fi


# ============================================================
# Create missing storage directories
# ============================================================

create_directory_if_missing "${REPOS_DIR}"
create_directory_if_missing "${BUILDS_DIR}"


# ============================================================
# Check application directory access
# ============================================================

log "Checking service user access"

if sudo -u "${SERVICE_USER}" test -r "${APP_DIR}/main.py"; then
    log "Service user can read the application files"
else
    fail "${SERVICE_USER} cannot read ${APP_DIR}/main.py"
fi

if sudo -u "${SERVICE_USER}" test -w "${REPOS_DIR}"; then
    log "Service user can write to ${REPOS_DIR}"
else
    warning "${SERVICE_USER} cannot write to ${REPOS_DIR}"
    warning "Existing directory permissions were not changed"
fi

if sudo -u "${SERVICE_USER}" test -w "${BUILDS_DIR}"; then
    log "Service user can write to ${BUILDS_DIR}"
else
    warning "${SERVICE_USER} cannot write to ${BUILDS_DIR}"
    warning "Existing directory permissions were not changed"
fi


# ============================================================
# Create Python virtual environment only when missing
# ============================================================

log "Checking Python virtual environment"

if [[ -x "${VENV_DIR}/bin/python" ]]; then
    log "Virtual environment already exists. Leaving unchanged: ${VENV_DIR}"
else
    if [[ -e "${VENV_DIR}" ]]; then
        fail "${VENV_DIR} exists but is not a valid Python virtual environment"
    fi

    log "Creating Python virtual environment"

    sudo -u "${SERVICE_USER}" python3 -m venv "${VENV_DIR}"
fi


# ============================================================
# Install only unsatisfied Python requirements
# ============================================================

log "Checking Python dependencies"

# pip normally leaves already satisfied packages unchanged.
sudo -u "${SERVICE_USER}" \
    "${VENV_DIR}/bin/python" -m pip install \
    --disable-pip-version-check \
    --no-input \
    --upgrade-strategy only-if-needed \
    -r "${APP_DIR}/requirements.txt"


# ============================================================
# Create systemd service only when missing
# ============================================================

log "Checking systemd service"

if [[ -f "${SERVICE_FILE}" ]]; then
    log "Systemd service already exists. Leaving unchanged:"
    echo "${SERVICE_FILE}"
else
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

ExecStart=${VENV_DIR}/bin/uvicorn main:app --host ${HOST} --port ${PORT} --log-level info

Restart=always
RestartSec=5
TimeoutStopSec=30

Environment=PYTHONUNBUFFERED=1
Environment=PYTHONDONTWRITEBYTECODE=1

StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}

[Install]
WantedBy=multi-user.target
EOF

    chmod 644 "${SERVICE_FILE}"

    SERVICE_WAS_CREATED=true
fi


# ============================================================
# Make management scripts executable
# ============================================================

log "Checking management script permissions"

management_scripts=(
    "setup.sh"
    "start.sh"
    "stop.sh"
)

for script_name in "${management_scripts[@]}"; do
    script_path="${APP_DIR}/${script_name}"

    if [[ ! -f "${script_path}" ]]; then
        warning "Script not found: ${script_path}"
        continue
    fi

    if [[ -x "${script_path}" ]]; then
        echo "Already executable: ${script_name}"
    else
        chmod +x "${script_path}"
        echo "Made executable: ${script_name}"
    fi
done


# ============================================================
# Start newly created service
# ============================================================

if [[ "${SERVICE_WAS_CREATED}" == true ]]; then
    log "Reloading systemd"

    systemctl daemon-reload

    log "Enabling Forge Builder service"

    systemctl enable "${SERVICE_NAME}"

    log "Starting Forge Builder service"

    systemctl start "${SERVICE_NAME}"

    sleep 3

    if systemctl is-active --quiet "${SERVICE_NAME}"; then
        log "Forge Builder service started successfully"
    else
        echo
        systemctl status "${SERVICE_NAME}" --no-pager -l || true

        echo
        journalctl \
            -u "${SERVICE_NAME}" \
            -n 100 \
            --no-pager || true

        fail "Forge Builder service failed to start"
    fi
else
    log "Existing systemd service was not restarted or modified"

    if systemctl is-active --quiet "${SERVICE_NAME}"; then
        echo "Current service status: active"
    else
        echo "Current service status: inactive"
        echo
        echo "Start it manually using:"
        echo "  sudo systemctl start ${SERVICE_NAME}"
    fi
fi


# ============================================================
# Final output
# ============================================================

echo
echo "============================================================"
echo "Forge Builder setup completed"
echo "============================================================"
echo
echo "Application directory: ${APP_DIR}"
echo "Repositories directory: ${REPOS_DIR}"
echo "Builds directory:       ${BUILDS_DIR}"
echo "Service:                ${SERVICE_NAME}"
echo "API URL:                http://${HOST}:${PORT}"
echo "Health endpoint:        http://${HOST}:${PORT}/health"
echo "Swagger documentation:  http://${HOST}:${PORT}/docs"
echo
echo "Check service status:"
echo "  sudo systemctl status ${SERVICE_NAME} --no-pager"
echo
echo "View live logs:"
echo "  sudo journalctl -u ${SERVICE_NAME} -f"
echo
echo "Start service:"
echo "  sudo systemctl start ${SERVICE_NAME}"
echo
echo "Stop service:"
echo "  sudo systemctl stop ${SERVICE_NAME}"
echo
echo "Restart service manually after code changes:"
echo "  sudo systemctl restart ${SERVICE_NAME}"
echo

