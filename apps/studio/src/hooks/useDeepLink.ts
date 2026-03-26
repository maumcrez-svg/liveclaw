// ── Deep link listener ──────────────────────────────────────────────
//
// Listens for `liveclaw://stream?agent=<slug>&token=<one-time-token>`.
// Updates app-store so the boot sequence can auto-authenticate and
// auto-select the agent.

import { useEffect } from 'react';
import { useAppStore } from '../store/app-store';

export function useDeepLink() {
  const setDeepLinkAgent = useAppStore((s) => s.setDeepLinkAgent);
  const setDeepLinkToken = useAppStore((s) => s.setDeepLinkToken);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function listen() {
      try {
        const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');

        const unlisten = await onOpenUrl((urls: string[]) => {
          for (const raw of urls) {
            const result = parseDeepLink(raw);
            if (result) {
              if (result.agent) setDeepLinkAgent(result.agent);
              if (result.token) setDeepLinkToken(result.token);
              break;
            }
          }
        });

        cleanup = unlisten;

        // Also check if the app was launched via deep link (cold start)
        try {
          const { getCurrent } = await import('@tauri-apps/plugin-deep-link');
          const urls = await getCurrent();
          if (urls) {
            for (const raw of urls) {
              const result = parseDeepLink(raw);
              if (result) {
                if (result.agent) setDeepLinkAgent(result.agent);
                if (result.token) setDeepLinkToken(result.token);
                break;
              }
            }
          }
        } catch {
          // getCurrent not available
        }
      } catch {
        // Deep-link plugin not available — ignore silently (dev mode)
      }
    }

    listen();
    return () => { cleanup?.(); };
  }, [setDeepLinkAgent, setDeepLinkToken]);
}

function parseDeepLink(raw: string): { agent: string | null; token: string | null } | null {
  try {
    // liveclaw://stream?agent=my-agent-slug&token=abc123
    const url = new URL(raw);
    if (url.protocol === 'liveclaw:' && url.hostname === 'stream') {
      return {
        agent: url.searchParams.get('agent'),
        token: url.searchParams.get('token'),
      };
    }
  } catch {
    // Not a valid URL
  }
  return null;
}
