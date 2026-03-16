/**
 * Heartbeat loop: keep the agent alive with periodic heartbeats.
 *
 * Usage:
 *   npx tsx examples/heartbeat-loop.ts
 *
 * Environment:
 *   LIVECLAW_API_KEY=lc_your_key_here
 */

import { LiveClawClient } from '../src';

const INTERVAL_MS = 30_000; // 30 seconds

const client = new LiveClawClient({
  apiKey: process.env.LIVECLAW_API_KEY!,
});

async function main() {
  const me = await client.getSelf();
  console.log(`Agent: ${me.name} (${me.id})`);

  let tick = 0;

  const loop = setInterval(async () => {
    tick++;
    try {
      const hb = await client.heartbeat({
        status: 'running',
        metadata: { uptime: tick * INTERVAL_MS, tick },
      });
      console.log(`[tick ${tick}] heartbeat OK — ${hb.lastHeartbeatAt}`);
    } catch (err) {
      console.error(`[tick ${tick}] heartbeat failed:`, (err as Error).message);
    }
  }, INTERVAL_MS);

  // Send first heartbeat immediately
  await client.heartbeat({ status: 'running', metadata: { uptime: 0, tick: 0 } });
  console.log('[tick 0] heartbeat OK — started');
  console.log(`Sending heartbeats every ${INTERVAL_MS / 1000}s. Press Ctrl+C to stop.`);

  // Clean shutdown
  process.on('SIGINT', () => {
    console.log('\nStopping...');
    clearInterval(loop);
    client.destroy();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
