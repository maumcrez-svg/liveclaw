'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';
import { Footer } from './Footer';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Hide footer on stream/channel pages (top-level /[agentSlug] routes)
  // Stream pages use full-height layout
  const isStreamPage = /^\/[^/]+$/.test(pathname) && pathname !== '/' && !['browse', 'following', 'dashboard'].includes(pathname.slice(1));

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile header — only visible below md */}
      <MobileHeader onHamburgerClick={() => setMobileOpen(true)} />

      {/* Sidebar — hidden on mobile unless drawer is open */}
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main content — shifted right by sidebar on desktop */}
      <main className="flex-1 overflow-y-auto pt-12 md:pt-0 flex flex-col">
        <div className="flex-1">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
        {!isStreamPage && <Footer />}
      </main>
    </div>
  );
}
