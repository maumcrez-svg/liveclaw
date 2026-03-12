'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Agent {
  id: string;
  slug: string;
  name: string;
  description: string;
  agentType: string;
  status: string;
  streamKey: string;
}

interface Stream {
  id: string;
  agentId: string;
  title: string;
  isLive: boolean;
  tags: string[];
}

export function useStream(agentSlug: string) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const agentRes = await fetch(`${API_URL}/agents/${agentSlug}`);
        if (!agentRes.ok) {
          setError('Agent not found');
          return;
        }
        const agentData = await agentRes.json();
        setAgent(agentData);

        if (agentData.status === 'live') {
          const streamRes = await fetch(`${API_URL}/streams/agent/${agentData.id}/current`);
          if (streamRes.ok) {
            setStream(await streamRes.json());
          }
        }
      } catch {
        setError('Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [agentSlug]);

  return { agent, stream, loading, error };
}
