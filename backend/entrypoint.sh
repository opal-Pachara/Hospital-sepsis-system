#!/bin/sh
set -e

# If DB_HOST is localhost or 127.0.0.1, remap to host.docker.internal for container networking
if [ "$DB_HOST" = "127.0.0.1" ] || [ "$DB_HOST" = "localhost" ]; then
    echo "[RTSAS Entrypoint] Remapping DB_HOST from '$DB_HOST' to 'host.docker.internal'"
    export DB_HOST="host.docker.internal"
fi

# If DASHBOARD_DB_HOST is localhost or 127.0.0.1, remap to host.docker.internal
if [ "$DASHBOARD_DB_HOST" = "127.0.0.1" ] || [ "$DASHBOARD_DB_HOST" = "localhost" ]; then
    echo "[RTSAS Entrypoint] Remapping DASHBOARD_DB_HOST from '$DASHBOARD_DB_HOST' to 'host.docker.internal'"
    export DASHBOARD_DB_HOST="host.docker.internal"
fi

exec uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
