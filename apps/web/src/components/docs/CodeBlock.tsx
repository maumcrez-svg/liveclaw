'use client';

import { useState } from 'react';

export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-700">
      {language && (
        <div className="bg-gray-800 px-4 py-1.5 text-xs text-gray-400 border-b border-gray-700 font-mono">
          {language}
        </div>
      )}
      <pre className="bg-gray-900 text-gray-100 p-4 overflow-x-auto text-sm leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        aria-label="Copy code to clipboard"
        className="absolute top-2 right-2 px-2.5 py-1 rounded text-xs font-medium transition-colors bg-gray-700 hover:bg-gray-600 text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
