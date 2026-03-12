export interface AgentConfig {
  slug: string;
  type: string;
  streamKey: string;
  config: Record<string, unknown>;
}

export abstract class BaseAgent {
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;

  protected log(message: string): void {
    console.log(`[${this.config.type}Agent:${this.config.slug}] ${message}`);
  }
}
