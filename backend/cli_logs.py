#!/usr/bin/env python3
"""
RTSAS — Database & Service Timestamp Log CLI
Inspects database connections, downtime events, and crash logs.
Format matches MySQL server daemon error logs (as seen in server console).

Usage:
    python -m backend.cli_logs                    # View recent timestamp logs
    python -m backend.cli_logs --status           # View log summary & DB status
    python -m backend.cli_logs --tail 50          # Show last 50 entries
    python -m backend.cli_logs --errors           # Show only ERROR logs
    python -m backend.cli_logs --follow           # Live stream logs (tail -f)
    python -m backend.cli_logs --search "InnoDB"  # Search logs
"""

import sys
import time
import json
import argparse

# ANSI Color codes
C_RESET = "\033[0m"
C_BOLD = "\033[1m"
C_RED = "\033[91m"
C_GREEN = "\033[92m"
C_YELLOW = "\033[93m"
C_CYAN = "\033[96m"
C_GRAY = "\033[90m"
C_WHITE = "\033[97m"


def format_log_line(log: dict) -> str:
    """Format matching server error logs: YYYY-MM-DD HH:MM:SS <PID> [Level] Component: Message"""
    ts = log.get("timestamp", "")
    pid = log.get("pid", 0)
    level = log.get("level", "Note")
    component = log.get("component", "HOSxP_DB")
    msg = log.get("message", "")

    if level.upper() in ("ERROR", "CRITICAL"):
        lvl_str = f"{C_BOLD}{C_RED}[{level}]{C_RESET}"
    elif level.upper() in ("WARN", "WARNING"):
        lvl_str = f"{C_BOLD}{C_YELLOW}[{level}]{C_RESET}"
    else:
        lvl_str = f"{C_GREEN}[{level}]{C_RESET}"

    line = f"{ts} {pid:<5} {lvl_str} {C_BOLD}{component}:{C_RESET} {msg}"

    details = log.get("details")
    if details and isinstance(details, dict) and len(details) > 0:
        details_str = json.dumps(details, ensure_ascii=False)
        line += f"\n   {C_GRAY}└─ details: {details_str}{C_RESET}"

    return line


def show_status():
    from .log_service import get_log_summary
    from .database import db_pool
    from .config import settings

    summary = get_log_summary()
    is_connected = db_pool.pool is not None

    print(f"\n{C_BOLD}=== Timestamp Log Database & System Status ==={C_RESET}")
    print(f" • Log Database:     {summary.get('log_db_path')}")
    print(f" • Total Logs:       {summary.get('total_logs')}")
    print(f" • Error Logs:       {summary.get('error_logs')}")
    print(f" • HOSxP Database:   {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")
    print(f" • Pool Status:      {C_GREEN + 'Connected' if is_connected else C_YELLOW + 'Idle / Disconnected'}{C_RESET}")

    last = summary.get("last_entry")
    if last:
        print(f" • Last Log:         {last.get('timestamp')} [{last.get('level')}] {last.get('component')}: {last.get('message')}")
    print()


def show_logs(limit=50, level=None, search=None, as_json=False):
    from .log_service import get_logs

    logs = get_logs(limit=limit, level=level, search=search)

    if as_json:
        print(json.dumps(logs, indent=2, ensure_ascii=False))
        return

    # Chronological order
    for l in reversed(logs):
        print(format_log_line(l))


def follow_logs(interval=1.5, level=None):
    from .log_service import get_logs

    print(f"{C_CYAN}Streaming live timestamp logs (Ctrl+C to quit)...{C_RESET}")
    last_id = 0
    initial = get_logs(limit=1)
    if initial:
        last_id = initial[0]["id"]

    try:
        while True:
            recent = get_logs(limit=20, level=level)
            new_logs = [l for l in recent if l["id"] > last_id]
            for l in reversed(new_logs):
                print(format_log_line(l))
                last_id = max(last_id, l["id"])
            time.sleep(interval)
    except KeyboardInterrupt:
        print(f"\n{C_GRAY}Stream stopped.{C_RESET}")


def main():
    parser = argparse.ArgumentParser(
        description="RTSAS Timestamp Log Database Diagnostic CLI",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("-s", "--status", action="store_true", help="Display log database status & counts")
    parser.add_argument("-n", "--tail", type=int, default=50, help="Number of recent log events to show (default: 50)")
    parser.add_argument("-e", "--errors", action="store_true", help="Show only ERROR logs")
    parser.add_argument("-f", "--follow", action="store_true", help="Live stream new logs (tail -f)")
    parser.add_argument("-q", "--search", type=str, help="Search log messages or component name")
    parser.add_argument("--json", action="store_true", help="Output raw JSON array")

    args = parser.parse_args()

    if args.status:
        show_status()
        return

    lvl_filter = "ERROR" if args.errors else None

    if args.follow:
        follow_logs(level=lvl_filter)
    else:
        show_logs(
            limit=args.tail,
            level=lvl_filter,
            search=args.search,
            as_json=args.json
        )


if __name__ == "__main__":
    main()
