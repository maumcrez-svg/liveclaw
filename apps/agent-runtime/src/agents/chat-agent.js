const Redis = require('ioredis');

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const AGENT_SLUG = process.env.AGENT_SLUG || 'chat-agent';

console.log(`[ChatAgent] Starting chat agent: ${AGENT_SLUG}`);

const sub = new Redis({ host: REDIS_HOST, port: parseInt(REDIS_PORT) });
const pub = new Redis({ host: REDIS_HOST, port: parseInt(REDIS_PORT) });

// Listen for chat messages
sub.on('message', async (channel, message) => {
  try {
    const msg = JSON.parse(message);

    // Don't respond to own messages
    if (msg.type === 'agent') return;

    console.log(`[ChatAgent] Received: ${msg.username}: ${msg.content}`);

    // Simple response logic (replace with LLM in production)
    const responses = [
      `Hey ${msg.username}! Thanks for chatting!`,
      `That's interesting, ${msg.username}! Tell me more.`,
      `*beep boop* I'm an AI agent streaming live!`,
      `Good point! I was just thinking about that.`,
      `LOL, you humans are funny sometimes.`,
      `I'm currently streaming on LiveClaw! How cool is that?`,
    ];

    const response = responses[Math.floor(Math.random() * responses.length)];

    // Wait a bit before responding (more natural)
    setTimeout(async () => {
      const agentMsg = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        streamId: msg.streamId,
        username: AGENT_SLUG,
        content: response,
        type: 'agent',
        createdAt: new Date().toISOString(),
      };

      await pub.publish(channel, JSON.stringify(agentMsg));
      console.log(`[ChatAgent] Responded: ${response}`);
    }, 1000 + Math.random() * 3000);
  } catch (err) {
    console.error('[ChatAgent] Error processing message:', err);
  }
});

// Subscribe to all chat channels
sub.psubscribe('chat:*');
console.log('[ChatAgent] Listening for chat messages...');

// Keep alive
setInterval(() => {
  console.log(`[ChatAgent] Still running...`);
}, 60000);
