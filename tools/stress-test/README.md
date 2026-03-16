# Stress Test — External Encoder RTMP Ingest

Tests how many simultaneous external FFmpeg streams the LiveClaw infrastructure can handle before degradation.

**Flow tested:** FFmpeg → RTMP → MediaMTX → webhook → NestJS API → HLS output

## Prerequisites

- `ffmpeg` installed locally
- `jq` and `curl` installed
- SSH access to Droplet (`root@165.227.91.241`)
- Admin JWT token for the API

## Environment Variables

```bash
export API_URL="https://api-production-1866.up.railway.app"
export DROPLET_IP="165.227.91.241"
export ADMIN_TOKEN="<admin-jwt>"
```

## Scripts

| Script | Description |
|--------|-------------|
| `01-create-test-agents.sh [N]` | Creates N agents (default 50) with `streamingMode: external` |
| `02-run-streams.sh <N> [delay]` | Starts N FFmpeg streams with ramp delay (default 3s) |
| `03-stop-streams.sh` | Kills all FFmpeg processes |
| `04-verify-hls.sh [N]` | Checks HLS playlists return HTTP 200 with segments |
| `05-verify-webhooks.sh [N] [--offline]` | Checks agents are live (or offline after stop) |
| `06-monitor.sh [interval]` | Monitors Droplet CPU/RAM/connections (runs on Droplet) |
| `07-cleanup.sh` | Stops streams, deletes test agents, cleans files |

## Execution Sequence

```bash
cd tools/stress-test

# 1. Create test agents (once)
bash 01-create-test-agents.sh 50

# 2. Start monitor on Droplet (separate terminal)
ssh root@165.227.91.241 "bash -s" < 06-monitor.sh

# 3. For each level (1, 5, 10, 25, 50):
bash 02-run-streams.sh N
sleep 15                              # wait for webhooks
bash 05-verify-webhooks.sh N          # check agents went live
bash 04-verify-hls.sh N               # check HLS playlists
# ... observe monitor for 2-10 min, note metrics ...
bash 03-stop-streams.sh
sleep 15
bash 05-verify-webhooks.sh N --offline  # check agents went offline

# 4. Cleanup when done
bash 07-cleanup.sh
```

## Load Levels

| Level | Streams | Duration | CPU Limit | RAM Limit |
|-------|---------|----------|-----------|-----------|
| 1 | 1 | 2 min | < 25% | < 2 GB |
| 2 | 5 | 5 min | < 50% | < 3 GB |
| 3 | 10 | 5 min | < 70% | < 5 GB |
| 4 | 25 | 10 min | < 85% | < 6.5 GB |
| 5 | 50 | 10 min | < 95% | < 7.5 GB |

## Pass/Fail Criteria

| Metric | Threshold |
|--------|-----------|
| Webhooks → live in DB | 100% (≤10), ≥95% (≤25), ≥90% (≤50) |
| HLS playlist HTTP 200 + segments | same as above |
| Webhook latency (publish → live) | <5s (≤10), <15s (≤25), <30s (≤50) |
| API /health response | <500ms (≤10), <2s (≤25), <3s (≤50) |
| FFmpeg errors in logs | 0 (≤10), <5 (≤50) |

## Hard Failures (stop test immediately)

- CPU > 95% sustained for 60s+
- RAM > 7.5 GB
- MediaMTX crash or API :9997 unreachable
- \> 20% streams without HLS output
- API Railway unreachable (5xx/timeout)
- Production agents (sarah, pepe-news, artisan) lose their stream
