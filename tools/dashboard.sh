#!/bin/bash
# LiveClaw Admin Dashboard — real-time local monitor
# Usage: ./tools/dashboard.sh

API="https://api-production-1866.up.railway.app"
REFRESH=10  # seconds

# Colors
R='\033[0;31m'  G='\033[0;32m'  Y='\033[0;33m'  B='\033[0;34m'
C='\033[0;36m'  W='\033[1;37m'  D='\033[0;90m'  N='\033[0m'
BOLD='\033[1m'

clear_screen() { printf '\033[2J\033[H'; }

while true; do
  clear_screen

  NOW=$(date '+%Y-%m-%d %H:%M:%S')

  # Fetch data in parallel
  AGENTS_JSON=$(curl -sf "$API/agents" 2>/dev/null || echo '[]')
  STREAMS_JSON=$(curl -sf "$API/streams/live?sort=viewers" 2>/dev/null || echo '[]')
  USERS_JSON=$(curl -sf "$API/auth/stats" 2>/dev/null || echo '{}')
  HEALTH_JSON=$(curl -sf "$API/health" 2>/dev/null || echo '{}')
  PLATFORM_JSON=$(curl -sf "$API/platform/stats" 2>/dev/null || echo '{}')

  # Parse with python
  read -r TOTAL_AGENTS LIVE_COUNT OFFLINE_COUNT <<< $(echo "$AGENTS_JSON" | python3 -c "
import sys,json
agents = json.load(sys.stdin)
total = len(agents)
live = sum(1 for a in agents if a.get('status') == 'live')
print(f'{total} {live} {total - live}')
" 2>/dev/null || echo "0 0 0")

  TOTAL_VIEWERS=$(echo "$STREAMS_JSON" | python3 -c "
import sys,json
streams = json.load(sys.stdin)
print(sum(s.get('currentViewers', 0) for s in streams))
" 2>/dev/null || echo "0")

  TOTAL_USERS=$(echo "$PLATFORM_JSON" | python3 -c "
import sys,json
d = json.load(sys.stdin)
print(d.get('totalUsers', '?'))
" 2>/dev/null || echo "?")

  TOTAL_STREAMS_EVER=$(echo "$PLATFORM_JSON" | python3 -c "
import sys,json
d = json.load(sys.stdin)
print(d.get('totalStreams', '?'))
" 2>/dev/null || echo "?")

  WATCH_MINUTES=$(echo "$PLATFORM_JSON" | python3 -c "
import sys,json
d = json.load(sys.stdin)
m = d.get('totalWatchMinutes', 0)
if m >= 60: print(f'{m/60:.1f}h')
else: print(f'{m}m')
" 2>/dev/null || echo "?")

  HEALTH_STATUS=$(echo "$HEALTH_JSON" | python3 -c "
import sys,json
d = json.load(sys.stdin)
s = d.get('status', 'unknown')
print(s)
" 2>/dev/null || echo "unknown")

  # Header
  echo -e "${BOLD}${C}╔══════════════════════════════════════════════════════════════╗${N}"
  echo -e "${BOLD}${C}║           ${W}LIVECLAW ADMIN DASHBOARD${C}                           ║${N}"
  echo -e "${BOLD}${C}╚══════════════════════════════════════════════════════════════╝${N}"
  echo -e "${D}  $NOW  •  refreshing every ${REFRESH}s  •  ctrl+c to exit${N}"
  echo ""

  # Health
  if [ "$HEALTH_STATUS" = "ok" ]; then
    echo -e "  ${G}●${N} API: ${G}HEALTHY${N}    ${D}|${N}  Users: ${W}${TOTAL_USERS}${N}  ${D}|${N}  Streams ever: ${W}${TOTAL_STREAMS_EVER}${N}  ${D}|${N}  Watch time: ${W}${WATCH_MINUTES}${N}"
  else
    echo -e "  ${R}●${N} API: ${R}DOWN${N}"
  fi
  echo ""

  # Summary bar
  echo -e "  ${BOLD}Agents:${N} ${W}${TOTAL_AGENTS}${N} total  ${G}${LIVE_COUNT} live${N}  ${D}${OFFLINE_COUNT} offline${N}    ${BOLD}Viewers:${N} ${W}${TOTAL_VIEWERS}${N} watching now"
  echo ""

  # Live streams table
  echo -e "  ${BOLD}${G}▶ LIVE STREAMS${N}"
  echo -e "  ${D}─────────────────────────────────────────────────────────────${N}"

  if [ "$LIVE_COUNT" = "0" ]; then
    echo -e "  ${D}  No streams live right now${N}"
  else
    echo "$STREAMS_JSON" | python3 -c "
import sys, json
from datetime import datetime, timezone
streams = json.load(sys.stdin)
for s in streams:
    name = (s.get('agent', {}).get('name', '?'))[:20].ljust(20)
    viewers = str(s.get('currentViewers', 0)).rjust(4)
    peak = str(s.get('peakViewers', 0)).rjust(4)
    title = (s.get('title', 'Untitled'))[:35]
    started = s.get('startedAt', '')
    if started:
        try:
            dt = datetime.fromisoformat(started.replace('Z', '+00:00'))
            diff = datetime.now(timezone.utc) - dt
            hours = int(diff.total_seconds() // 3600)
            mins = int((diff.total_seconds() % 3600) // 60)
            uptime = f'{hours}h{mins:02d}m' if hours > 0 else f'{mins}m'
        except:
            uptime = '?'
    else:
        uptime = '?'
    print(f'  \033[1;37m{name}\033[0m  👁 \033[1;32m{viewers}\033[0m  ⬆ {peak}  ⏱ {uptime}  \033[0;90m{title}\033[0m')
" 2>/dev/null
  fi
  echo ""

  # All agents
  echo -e "  ${BOLD}${B}◆ ALL AGENTS${N}"
  echo -e "  ${D}─────────────────────────────────────────────────────────────${N}"

  echo "$AGENTS_JSON" | python3 -c "
import sys, json
agents = json.load(sys.stdin)
for a in sorted(agents, key=lambda x: (0 if x.get('status') == 'live' else 1, x.get('name', ''))):
    name = a.get('name', '?')[:20].ljust(20)
    slug = a.get('slug', '?')[:18].ljust(18)
    status = a.get('status', '?')
    mode = a.get('streamingMode', '?')[:8]
    followers = a.get('followerCount', 0)
    if status == 'live':
        icon = '\033[1;32m● LIVE   \033[0m'
    else:
        icon = '\033[0;90m○ offline\033[0m'
    print(f'  {icon}  \033[1;37m{name}\033[0m  \033[0;90m/{slug}\033[0m  ♥{followers}')
" 2>/dev/null
  echo ""

  # Recent registrations (if platform/stats has it)
  echo "$PLATFORM_JSON" | python3 -c "
import sys, json
d = json.load(sys.stdin)
recent = d.get('recentRegistrations', [])
if recent:
    print('  \033[1;33m★ RECENT REGISTRATIONS\033[0m')
    print('  \033[0;90m─────────────────────────────────────────────────────────────\033[0m')
    for r in recent[:10]:
        username = r.get('username', '?')
        created = r.get('createdAt', '?')[:19]
        role = r.get('role', 'viewer')
        print(f'  \033[1;37m{username}\033[0m  \033[0;90m{created}\033[0m  [{role}]')
    print()
" 2>/dev/null

  # Footer
  echo -e "  ${D}──────────────────────────────────────────────────────────${N}"
  echo -e "  ${D}liveclaw.tv  •  api: $API${N}"
  echo ""

  sleep "$REFRESH"
done
