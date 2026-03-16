#!/usr/bin/env bash
# Monitors Droplet resources during stress test.
# Run ON the Droplet: ssh root@165.227.91.241 "bash -s" < 06-monitor.sh
# Or locally with SSH: bash 06-monitor.sh (will SSH automatically if DROPLET_IP is set)
#
# Ctrl+C to stop.

set -euo pipefail

INTERVAL="${1:-10}"

monitor_loop() {
  echo "=== LiveClaw Stress Test Monitor (every ${INTERVAL}s) ==="
  echo "Press Ctrl+C to stop"
  echo ""

  while true; do
    echo "────────────────────────────────────────────"
    echo "$(date '+%Y-%m-%d %H:%M:%S')"
    echo ""

    # CPU & RAM
    cpu=$(top -bn1 | grep "Cpu(s)" | awk '{printf "%.1f%%", $2+$4}')
    mem_info=$(free -m | awk '/Mem:/ {printf "%.1fGB / %.1fGB (%.0f%%)", $3/1024, $2/1024, $3/$2*100}')
    echo "CPU:  $cpu"
    echo "RAM:  $mem_info"
    echo ""

    # MediaMTX process
    mtx_pid=$(pgrep -f mediamtx 2>/dev/null | head -1 || echo "")
    if [ -n "$mtx_pid" ]; then
      mtx_rss=$(ps -o rss= -p "$mtx_pid" 2>/dev/null | awk '{printf "%.1fMB", $1/1024}')
      mtx_cpu=$(ps -o %cpu= -p "$mtx_pid" 2>/dev/null | awk '{printf "%.1f%%", $1}')
      echo "MediaMTX PID $mtx_pid: RSS=$mtx_rss CPU=$mtx_cpu"
    else
      echo "MediaMTX: NOT RUNNING ⚠"
    fi

    # RTMP connections
    rtmp_conns=$(ss -tn state established '( dport = :1935 or sport = :1935 )' 2>/dev/null | tail -n +2 | wc -l || echo "?")
    echo "RTMP connections: $rtmp_conns"

    # MediaMTX API — paths
    paths_resp=$(curl -s --max-time 3 "http://127.0.0.1:9997/v3/paths/list" 2>/dev/null || echo '{"items":[]}')
    path_count=$(echo "$paths_resp" | jq '.items | length' 2>/dev/null || echo "?")
    echo "MediaMTX paths: $path_count"

    # MediaMTX API — HLS muxers
    hls_resp=$(curl -s --max-time 3 "http://127.0.0.1:9997/v3/hlsmuxers/list" 2>/dev/null || echo '{"items":[]}')
    hls_count=$(echo "$hls_resp" | jq '.items | length' 2>/dev/null || echo "?")
    echo "HLS muxers: $hls_count"

    # Disk I/O (if iostat available)
    if command -v iostat &>/dev/null; then
      disk_util=$(iostat -dx 1 1 2>/dev/null | awk '/vda|sda/ {printf "%.1f%%", $NF}' || echo "?")
      echo "Disk util: $disk_util"
    fi

    # Network (rough)
    if [ -f /proc/net/dev ]; then
      echo ""
      echo "Network (eth0):"
      rx_bytes_1=$(awk '/eth0/ {print $2}' /proc/net/dev 2>/dev/null || echo "0")
      tx_bytes_1=$(awk '/eth0/ {print $10}' /proc/net/dev 2>/dev/null || echo "0")
      sleep 1
      rx_bytes_2=$(awk '/eth0/ {print $2}' /proc/net/dev 2>/dev/null || echo "0")
      tx_bytes_2=$(awk '/eth0/ {print $10}' /proc/net/dev 2>/dev/null || echo "0")
      rx_mbps=$(( (rx_bytes_2 - rx_bytes_1) * 8 / 1000000 ))
      tx_mbps=$(( (tx_bytes_2 - tx_bytes_1) * 8 / 1000000 ))
      echo "  RX: ${rx_mbps} Mbps  TX: ${tx_mbps} Mbps"
    fi

    echo ""

    # Production agents check
    echo "Production agents:"
    for proc_name in sarah artisan pepe; do
      pid=$(pgrep -f "$proc_name" 2>/dev/null | head -1 || echo "")
      if [ -n "$pid" ]; then
        echo "  $proc_name → running (PID $pid)"
      else
        echo "  $proc_name → NOT FOUND ⚠"
      fi
    done

    echo ""
    sleep "$INTERVAL"
  done
}

# If running locally with DROPLET_IP, SSH into the droplet
if [ -n "${DROPLET_IP:-}" ] && [ "$(hostname -I 2>/dev/null | awk '{print $1}')" != "$DROPLET_IP" ]; then
  echo "SSHing into $DROPLET_IP to run monitor..."
  ssh "root@${DROPLET_IP}" "INTERVAL=$INTERVAL bash -s" < "$0"
  exit $?
fi

monitor_loop
