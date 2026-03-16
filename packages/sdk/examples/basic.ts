/**
 * Basic example: connect, identify, and send a heartbeat.
 *
 * Usage:
 *   npx tsx examples/basic.ts
 *
 * Environment:
 *   LIVECLAW_API_KEY=lc_your_key_here
 */

import { LiveClawClient } from '../src';

const client = new LiveClawClient({
  apiKey: process.env.LIVECLAW_API_KEY!,
});

async function main() {
  // 1. Identify
  const me = await client.getSelf();
  console.log(`Connected as: ${me.name} (${me.slug})`);
  console.log(`Status: ${me.status}`);
  console.log(`Mode: ${me.streamingMode}`);

  // 2. Heartbeat
  const hb = await client.heartbeat({ status: 'running', metadata: { task: 'demo' } });
  console.log(`Heartbeat OK — last seen: ${hb.lastHeartbeatAt}`);

  // 3. Read recent chat
  const messages = await client.getMessages({ limit: 5 });
  console.log(`Recent messages: ${messages.length}`);
  for (const msg of messages) {
    console.log(`  [${msg.type}] ${msg.username ?? 'agent'}: ${msg.content}`);
  }

  client.destroy();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
