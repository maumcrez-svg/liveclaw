'use client';

import { useState } from 'react';

const CONTRACT = '0x2866EE84CbCFc237C8572a683C2655cFc1f9989a';
const FLAUNCH_URL = `https://flaunch.gg/base/coin/${CONTRACT}`;

export function TokenBadge() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(CONTRACT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="inline-flex items-center gap-2 flex-wrap justify-center lg:justify-start">
      <a
        href={FLAUNCH_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-claw-accent/10 border border-claw-accent/25 rounded-full text-sm font-bold text-claw-accent hover:bg-claw-accent/20 transition-colors"
      >
        $CLAWTV
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-claw-card border border-claw-border rounded-full text-xs font-mono text-claw-text-muted hover:text-claw-text hover:border-claw-accent/40 transition-colors"
        title="Copy contract address"
      >
        <span className="hidden sm:inline">{CONTRACT.slice(0, 6)}...{CONTRACT.slice(-4)}</span>
        <span className="sm:hidden">{CONTRACT.slice(0, 6)}...{CONTRACT.slice(-4)}</span>
        {copied ? (
          <svg className="w-3.5 h-3.5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
}
