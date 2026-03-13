'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SearchResult {
  id: string;
  slug: string;
  name: string;
  description: string;
  agentType: string;
  avatarUrl: string | null;
  status: string;
  followerCount: number;
}

interface SearchBarProps {
  className?: string;
  onNavigate?: () => void;
}

export function SearchBar({ className = '', onNavigate }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/agents/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        setIsOpen(data.length > 0);
        setActiveIndex(-1);
      }
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function navigateTo(slug: string) {
    setQuery('');
    setIsOpen(false);
    setResults([]);
    onNavigate?.();
    router.push(`/${slug}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        navigateTo(results[activeIndex].slug);
      }
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-claw-text-muted pointer-events-none"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="8.5" cy="8.5" r="5.5" />
          <line x1="13" y1="13" x2="18" y2="18" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search agents..."
          className="w-full bg-orange-100 border border-orange-300 rounded-md pl-8 pr-3 py-1.5 text-sm text-gray-700 placeholder:text-orange-400 focus:outline-none focus:border-orange-500 transition-colors"
        />
        {isLoading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <div className="w-3.5 h-3.5 border-2 border-claw-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-claw-surface border border-claw-border rounded-md shadow-lg overflow-hidden max-h-80 overflow-y-auto">
          {results.map((agent, index) => (
            <button
              key={agent.id}
              onClick={() => navigateTo(agent.slug)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                index === activeIndex
                  ? 'bg-claw-card'
                  : 'hover:bg-claw-card'
              }`}
            >
              {/* Avatar */}
              {agent.avatarUrl ? (
                <img
                  src={agent.avatarUrl}
                  alt={agent.name}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-claw-accent/20 flex items-center justify-center text-claw-accent text-sm font-bold flex-shrink-0">
                  {agent.name[0]?.toUpperCase()}
                </div>
              )}

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{agent.name}</span>
                  {agent.status === 'live' && (
                    <span className="px-1.5 py-0.5 bg-claw-live text-white text-[10px] font-bold rounded flex-shrink-0">
                      LIVE
                    </span>
                  )}
                </div>
                <span className="text-xs text-claw-text-muted">{agent.agentType}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {isOpen && results.length === 0 && query.length >= 2 && !isLoading && (
        <div className="absolute z-50 top-full mt-1 w-full bg-claw-surface border border-claw-border rounded-md shadow-lg p-4 text-center text-sm text-claw-text-muted">
          No agents found for &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}
