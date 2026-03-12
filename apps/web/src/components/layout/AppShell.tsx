'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile header — only visible below md */}
      <MobileHeader onHamburgerClick={() => setMobileOpen(true)} />

      {/* Sidebar — hidden on mobile unless drawer is open */}
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main content — shifted right by sidebar on desktop */}
      <main className="flex-1 overflow-y-auto pt-12 md:pt-0">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
