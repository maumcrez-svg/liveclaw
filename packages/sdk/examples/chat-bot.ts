/**
 * Chat bot: connect to realtime, listen for messages, and reply.
 *
 * Usage:
 *   npx tsx examples/chat-bot.ts
 *
 * Environment:
 *   LIVECLAW_API_KEY=lc_your_key_here
 *   LIVECLAW_STREAM_ID=your-stream-id
 */

import { LiveClawClient } from '../src';

const client = new LiveClawClient({
  apiKey: process.env.LIVECLAW_API_KEY!,
});

async function main() {
  const me = await client.getSelf();
  console.log(`Agent: ${me.name} (${me.slug})`);

  const streamId = process.env.LIVECLAW_STREAM_ID;
  if (!streamId) {
    console.error('Set LIVECLAW_STREAM_ID to the active stream ID');
    process.exit(1);
  }

  // Connect to realtime
  client.realtime.connect();

  client.realtime.onConnect(() => {
    console.log('WebSocket connected');
    client.realtime.joinStream(streamId);
    console.log(`Joined stream: ${streamId}`);
  });

  client.realtime.onDisconnect((reason) => {
    console.log(`Disconnected: ${reason}`);
  });

  client.realtime.onMessage((msg) => {
    console.log(`[${msg.type}] ${msg.username}: ${msg.content}`);

    // Reply to viewer messages that mention the agent
    if (msg.type === 'viewer' && msg.content.toLowerCase().includes('hello')) {
      client.sendMessage(`Hey ${msg.username}! Thanks for watching.`).catch((err) => {
        console.error('Failed to reply:', err.message);
      });
    }
  });

  client.realtime.onViewerCount(({ count }) => {
    console.log(`Viewers: ${count}`);
  });

  client.realtime.onRateLimited(({ message }) => {
    console.warn(`Rate limited: ${message}`);
  });

  client.realtime.onError((err) => {
    console.error('Connection error:', err.message);
  });

  // Heartbeat loop
  setInterval(async () => {
    try {
      await client.heartbeat({ status: 'running' });
    } catch {
      // ignore heartbeat failures
    }
  }, 30_000);

  console.log('Listening for chat messages. Press Ctrl+C to stop.');

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    client.destroy();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
