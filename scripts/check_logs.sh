#!/usr/bin/env bash
# Quick CLI script to inspect RTSAS Database Health & Timestamp Logs
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
export PYTHONPATH="$DIR:$PYTHONPATH"

# Run Python CLI Diagnostic Tool
python3 -m backend.cli_logs "$@"
