```bash
#!/usr/bin/env bash

set -Eeuo pipefail

APP_NAME="forge-builder"
SERVICE_NAME="${APP_NAME}.service"

if [[ "${EUID}" -ne 0 ]]; then
    echo "Run this script with sudo:"
    echo "  sudo ./stop.sh"
    exit 1
fi

echo "Stopping ${APP_NAME}..."

if ! systemctl is-active --quiet "${SERVICE_NAME}"; then
    echo "${APP_NAME} is already stopped."
    exit 0
fi

systemctl stop "${SERVICE_NAME}"

if systemctl is-active --quiet "${SERVICE_NAME}"; then
    echo "Failed to stop ${APP_NAME}."
    systemctl status "${SERVICE_NAME}" --no-pager || true
    exit 1
fi

echo "${APP_NAME} stopped successfully."
```
