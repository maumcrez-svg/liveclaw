interface ConversationEntry {
  username: string;
  content: string;
  isAgent: boolean;
  timestamp: number;
}

interface ViewerProfile {
  username: string;
  messageCount: number;
  firstSeen: number;
  lastSeen: number;
  topics: string[];
}

class StreamMemory {
  private conversation: ConversationEntry[] = [];
  private viewers: Map<string, ViewerProfile> = new Map();
  private agentMood: string = 'neutral';
  private topicsDiscussed: string[] = [];
  private streamStartTime: number = Date.now();

  /** Record a message (viewer or agent) */
  addMessage(username: string, content: string, isAgent: boolean): void {
    this.conversation.push({ username, content, isAgent, timestamp: Date.now() });

    // Keep last 100 messages
    if (this.conversation.length > 100) {
      this.conversation = this.conversation.slice(-100);
    }

    // Update viewer profile
    if (!isAgent) {
      const existing = this.viewers.get(username);
      if (existing) {
        existing.messageCount++;
        existing.lastSeen = Date.now();
      } else {
        this.viewers.set(username, {
          username,
          messageCount: 1,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          topics: [],
        });
      }
    }
  }

  /** Get recent messages for context window */
  getRecentMessages(count: number = 10): ConversationEntry[] {
    return this.conversation.slice(-count);
  }

  /** Get a viewer's profile */
  getViewer(username: string): ViewerProfile | undefined {
    return this.viewers.get(username);
  }

  /** Check if this is a returning viewer */
  isReturningViewer(username: string): boolean {
    const viewer = this.viewers.get(username);
    return viewer !== undefined && viewer.messageCount > 1;
  }

  /** Get conversation summary for context */
  getContextSummary(): string {
    const uniqueViewers = this.viewers.size;
    const totalMessages = this.conversation.length;
    const uptimeMin = Math.floor((Date.now() - this.streamStartTime) / 60000);
    const recentTopics = this.topicsDiscussed.slice(-3);

    let summary = `Stream uptime: ${uptimeMin}min | ${uniqueViewers} unique viewers | ${totalMessages} messages`;
    if (recentTopics.length > 0) {
      summary += ` | Recent topics: ${recentTopics.join(', ')}`;
    }
    return summary;
  }

  /** Reset for new stream */
  reset(): void {
    this.conversation = [];
    this.viewers.clear();
    this.topicsDiscussed = [];
    this.streamStartTime = Date.now();
    this.agentMood = 'neutral';
  }
}

// Singleton
export const memory = new StreamMemory();
