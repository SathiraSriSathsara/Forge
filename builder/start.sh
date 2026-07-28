#!/usr/bin/env bash

set -Eeuo pipefail

APP_NAME="forge-builder"
SERVICE_NAME="${APP_NAME}.service"

if [[ "${EUID}" -ne 0 ]]; then
    echo "Run this script with sudo:"
    echo "  sudo ./start.sh"
    exit 1
fi

echo "Starting ${APP_NAME}..."

systemctl daemon-reload
systemctl start "${SERVICE_NAME}"

sleep 2

if systemctl is-active --quiet "${SERVICE_NAME}"; then
    echo "${APP_NAME} started successfully."
    echo
    echo "API:    http://127.0.0.1:8010"
    echo "Health: http://127.0.0.1:8010/health"
    echo "Docs:   http://127.0.0.1:8010/docs"
else
    echo "${APP_NAME} failed to start."
    echo

    systemctl status "${SERVICE_NAME}" --no-pager || true

    echo
    echo "Recent logs:"
    journalctl -u "${SERVICE_NAME}" -n 50 --no-pager || true

    exit 1
fi

