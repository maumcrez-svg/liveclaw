import Redis from 'ioredis';

export class ChatClient {
  private sub: Redis;
  private pub: Redis;
  private agentSlug: string;

  constructor(redisHost: string, redisPort: number, agentSlug: string) {
    this.sub = new Redis({ host: redisHost, port: redisPort });
    this.pub = new Redis({ host: redisHost, port: redisPort });
    this.agentSlug = agentSlug;
  }

  async subscribe(streamId: string, onMessage: (msg: any) => void): Promise<void> {
    const channel = `chat:${streamId}`;

    this.sub.on('message', (_ch, message) => {
      try {
        const msg = JSON.parse(message);
        if (msg.type !== 'agent') {
          onMessage(msg);
        }
      } catch {}
    });

    await this.sub.subscribe(channel);
  }

  async sendMessage(streamId: string, content: string): Promise<void> {
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      streamId,
      username: this.agentSlug,
      content,
      type: 'agent',
      createdAt: new Date().toISOString(),
    };

    await this.pub.publish(`chat:${streamId}`, JSON.stringify(message));
  }

  async disconnect(): Promise<void> {
    this.sub.disconnect();
    this.pub.disconnect();
  }
}
