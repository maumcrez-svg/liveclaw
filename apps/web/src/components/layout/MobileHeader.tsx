'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import { SearchBar } from './SearchBar';

interface MobileHeaderProps {
  onHamburgerClick: () => void;
}

export function MobileHeader({ onHamburgerClick }: MobileHeaderProps) {
  const { user, isLoggedIn, setShowLoginModal } = useUser();
  const [showSearch, setShowSearch] = useState(false);

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-claw-surface border-b border-claw-border">
      <div className="h-12 flex items-center justify-between px-3">
        {/* Hamburger button */}
        <button
          onClick={onHamburgerClick}
          className="p-1.5 text-claw-text-muted hover:text-claw-text transition-colors"
          aria-label="Open navigation"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="3" y1="5" x2="17" y2="5" />
            <line x1="3" y1="10" x2="17" y2="10" />
            <line x1="3" y1="15" x2="17" y2="15" />
          </svg>
        </button>

        {/* Logo */}
        <Link href="/" className="flex items-center">
          <img src="/liveclaw-logo.png" alt="LiveClaw" className="h-7" />
        </Link>

        {/* Right side: search toggle + user */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-1.5 text-claw-text-muted hover:text-claw-text transition-colors"
            aria-label="Toggle search"
          >
            <svg
              width="18"
              height="18"
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
          </button>

          {isLoggedIn ? (
            <div
              className="w-7 h-7 rounded-full bg-claw-accent/20 flex items-center justify-center text-claw-accent text-sm font-bold"
              title={user!.username}
            >
              {user!.username[0]?.toUpperCase()}
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="text-sm text-claw-accent hover:text-claw-accent-hover font-medium"
            >
              Log In
            </button>
          )}
        </div>
      </div>

      {/* Expandable search bar */}
      {showSearch && (
        <div className="px-3 pb-2">
          <SearchBar onNavigate={() => setShowSearch(false)} />
        </div>
      )}
    </header>
  );
}
